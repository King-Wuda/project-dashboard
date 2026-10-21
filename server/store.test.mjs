import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { issuePatch, projectPatch } from '../web/src/lib/patch.ts';
import { Store, decodeEditor } from './store.mjs';

const project = { id: 'P-1', customer: 'c', location: '', description: 'd', level: 'L1', pm: 'A B', startDate: null, status: 'Posted', value: 1, rbp: 0.2, poc: 0.5, invoiced: 0.5, gates: ['', '', '', '', '', '', ''], handoverSigned: false, comment: '', sourceRow: 9 };
const issue = { id: 'I-1', projectId: 'P-1', customer: 'c', location: '', description: 'd', pm: 'A B', issue: 'x', nextSteps: '', responsible: '', status: 'WIP' };

function store() {
  const dir = mkdtempSync(join(tmpdir(), 'dash-'));
  writeFileSync(join(dir, 'seed.json'), JSON.stringify({ meta: { title: 't', gateNames: [] }, projects: [project], resources: [], issues: [issue] }));
  return new Store(dir, [join(dir, 'seed.json')]);
}

describe('saving edits made in the UI', () => {
  it('saves an imported project even though it carries extra fields', () => {
    const s = store();
    const edited = { ...s.doc.projects[0], comment: 'updated', updatedAt: 'x' };
    expect(Object.keys(projectPatch(edited))).not.toContain('sourceRow');
    expect(s.patchProject('P-1', projectPatch(edited), 'me').comment).toBe('updated');
  });
  it('saves an issue that was already edited once (has updatedAt)', () => {
    const s = store();
    const created = s.createIssue({ issue: 'new' }, 'me');
    expect(created.updatedAt).toBeTruthy();
    const out = s.patchIssue(created.id, issuePatch({ ...created, status: 'Overdue' }), 'me');
    expect(out.status).toBe('Overdue');
    expect(s.history('issue', created.id)[0].changes.status).toEqual(['WIP', 'Overdue']);
  });
  it('still rejects unknown fields sent directly', () => {
    expect(() => store().patchProject('P-1', { bogus: 1 }, 'me')).toThrow(/unknown field/);
  });
  it('stores, changes and clears an issue due date; rejects a malformed one', () => {
    const s = store();
    const created = s.createIssue({ issue: 'with date', dueDate: '2026-11-30' }, 'me');
    expect(created.dueDate).toBe('2026-11-30');
    expect(s.createIssue({ issue: 'without date' }, 'me').dueDate).toBeNull();
    expect(s.patchIssue(created.id, issuePatch({ ...created, dueDate: '2026-12-15' }), 'me').dueDate).toBe('2026-12-15');
    expect(s.patchIssue(created.id, { dueDate: null }, 'me').dueDate).toBeNull();
    expect(s.history('issue', created.id)[0].changes.dueDate).toEqual(['2026-12-15', null]);
    expect(() => s.patchIssue(created.id, { dueDate: '30/11/2026' }, 'me')).toThrow(/YYYY-MM-DD/);
  });
});

describe('decodeEditor', () => {
  it('decodes the URL-encoded name the browser sends', () => {
    expect(decodeEditor(encodeURIComponent('Gerhardus Uys'))).toBe('Gerhardus Uys');
  });
  it('copes with missing, malformed and oversized values', () => {
    expect(decodeEditor(undefined)).toBe('');
    expect(decodeEditor('100%')).toBe('100%');
    expect(decodeEditor('a'.repeat(200))).toHaveLength(80);
  });
});
