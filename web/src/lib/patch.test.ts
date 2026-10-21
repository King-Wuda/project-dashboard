import { describe, expect, it } from 'vitest';
import type { Project } from '../types';
import { changedFields, fromPct, projectPatch, ratioFromText, toPct } from './patch';

const stored: Project = {
  id: 'T-1', customer: 'c', location: '', description: 'd', level: 'L1', pm: 'A B', startDate: null, status: 'Posted', value: 1_000_000,
  rbp: 0.0255, poc: 0.8636320000000001, invoiced: 0.7667967330989772, gates: ['', '', '', '', '', '', ''], handoverSigned: false, comment: 'old',
  updatedAt: 'x',
} as Project;

describe('percentage inputs', () => {
  it('keeps the stored value exactly when the text is untouched', () => {
    expect(ratioFromText(toPct(stored.poc), stored.poc)).toBe(stored.poc);
    expect(ratioFromText(toPct(stored.rbp), stored.rbp)).toBe(0.0255);
  });
  it('uses what the user typed once they change it', () => {
    expect(ratioFromText('90', stored.poc)).toBe(0.9);
    expect(ratioFromText('', stored.poc)).toBeNull();
  });
  it('handles a new project with no stored value', () => {
    expect(ratioFromText('', null)).toBeNull();
    expect(ratioFromText('0', undefined)).toBe(0);
    expect(fromPct('abc')).toBeNull();
  });
});

describe('changedFields', () => {
  it('sends only the comment when only the comment changed, leaving precise figures alone', () => {
    const live = { ...stored, comment: 'new', poc: ratioFromText(toPct(stored.poc), stored.poc), rbp: ratioFromText(toPct(stored.rbp), stored.rbp) };
    expect(changedFields(projectPatch(live), projectPatch(stored))).toEqual({ comment: 'new' });
  });
  it('sends nothing when nothing changed', () => {
    expect(changedFields(projectPatch(stored), projectPatch(stored))).toEqual({});
  });
  it('detects a changed gate', () => {
    const live = { ...stored, gates: ['done', '', '', '', '', '', ''] as Project['gates'] };
    expect(Object.keys(changedFields(projectPatch(live), projectPatch(stored)))).toEqual(['gates']);
  });
});
