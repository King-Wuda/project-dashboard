import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { issuePatch, projectPatch } from '../web/src/lib/patch.ts';
import { Store, decodeEditor } from './store.mjs';
import { validateDoc } from './store-core.mjs';

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

describe('margins and whole-document validation', () => {
  it('accepts a negative margin on a loss-making project but not an impossible one', () => {
    const s = store();
    expect(s.patchProject('P-1', { rbp: -0.3345 }, 'me').rbp).toBe(-0.3345);
    expect(s.patchProject('P-1', { rbp: null }, 'me').rbp).toBeNull();
    expect(() => s.patchProject('P-1', { rbp: -468508.62 }, 'me')).toThrow(/between -2 and 2/);
  });
  const gateNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const doc = (over = {}) => ({ meta: { title: 'T', dataAsOf: '2026-10-20', gateNames }, projects: [{ ...project }], resources: [], issues: [{ ...issue }], ...over });
  it('cleans a valid document: drops unknown fields, fills defaults, keeps history', () => {
    const out = validateDoc(doc({ history: [{ at: 'x', by: 'me', entity: 'project', id: 'P-1', action: 'update', changes: {} }] }));
    expect(out.projects[0]).not.toHaveProperty('sourceRow');
    expect(out.issues[0].dueDate).toBeNull();
    expect(out.history).toHaveLength(1);
  });
  it('keeps a stored health override exactly as it was', () => {
    const ov = { health: 'red', note: 'dispute', by: 'Gerhardus Uys', at: '2026-10-01T08:00:00.000Z' };
    expect(validateDoc(doc({ projects: [{ ...project, healthOverride: ov }] })).projects[0].healthOverride).toEqual(ov);
  });
  it.each([
    ['not an object', null],
    ['projects not a list', doc({ projects: 'nope' })],
    ['a project without a number', doc({ projects: [{ ...project, id: '' }] })],
    ['duplicate project numbers', doc({ projects: [project, project] })],
    ['an invalid status', doc({ projects: [{ ...project, status: 'Bogus' }] })],
    ['the wrong number of gates', doc({ meta: { title: 'T', gateNames: ['a'] } })],
  ])('rejects %s', (_name, bad) => {
    expect(() => validateDoc(bad)).toThrow(/Not a valid dashboard data file|must be/);
  });
  it('calls the persist hook after every change', () => {
    const calls = [];
    const dir = mkdtempSync(join(tmpdir(), 'dash-'));
    writeFileSync(join(dir, 'seed.json'), JSON.stringify(doc()));
    const s = new Store(dir, [join(dir, 'seed.json')]);
    s.persist = (d) => calls.push(d.projects.length);
    s.createProject({ id: 'P-2' }, 'me');
    expect(calls).toEqual([2]);
  });
});
