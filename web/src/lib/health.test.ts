import { describe, expect, it } from 'vitest';
import type { Project } from '../types';
import { assess, currentStage, invoiceLag, readyToClose, unbilled } from './health';
import { rowsOf, summarise } from './stats';

const base: Project = {
  id: 'T-1', customer: 'c', location: '', description: '', level: 'L1', pm: 'A B', startDate: null, status: 'Posted',
  value: 1_000_000, rbp: 0.2, poc: 0.5, invoiced: 0.5, gates: ['done', 'done', 'wip', '', '', '', ''], handoverSigned: false, comment: '',
};
const mk = (o: Partial<Project>): Project => ({ ...base, ...o });

describe('assess', () => {
  it('is green when nothing is wrong', () => {
    expect(assess(base).effective).toBe('green');
  });
  it('flags low margin: red under 10%, amber under 12%', () => {
    expect(assess(mk({ rbp: 0.09 })).calculated).toBe('red');
    expect(assess(mk({ rbp: 0.11 })).calculated).toBe('amber');
    expect(assess(mk({ rbp: 0.12 })).calculated).toBe('green');
  });
  it('flags invoicing lag: amber from 15 pts, red from 30 pts', () => {
    expect(assess(mk({ poc: 0.65, invoiced: 0.5 })).calculated).toBe('amber');
    expect(assess(mk({ poc: 0.8, invoiced: 0.5 })).calculated).toBe('red');
  });
  it('does not penalise invoicing ahead of progress', () => {
    expect(invoiceLag(mk({ poc: 0.3, invoiced: 0.5 }))).toBe(0);
  });
  it('flags gate deviation and risk', () => {
    expect(assess(mk({ gates: ['done', 'risk', '', '', '', '', ''] })).calculated).toBe('amber');
    expect(assess(mk({ gates: ['done', 'deviation', '', '', '', '', ''] })).calculated).toBe('red');
  });
  it('reads risk words from the comment, amber only', () => {
    const a = assess(mk({ comment: 'Equipment delayed, waiting for deposit' }));
    expect(a.calculated).toBe('amber');
    expect(a.reasons[0].text).toContain('delayed');
  });
  it('applies the PM override and reports it only when it differs', () => {
    const ov = { health: 'red' as const, note: 'customer dispute', by: 'x', at: '' };
    const a = assess(mk({ healthOverride: ov }));
    expect(a.effective).toBe('red');
    expect(a.calculated).toBe('green');
    expect(a.overridden).toBe(true);
    expect(assess(mk({ healthOverride: { ...ov, health: 'green' } })).overridden).toBe(false);
  });
  it('has no health for archived projects', () => {
    expect(assess(mk({ status: 'Eliminated', rbp: 0.01 })).effective).toBeNull();
  });
});

describe('lifecycle and close-out', () => {
  it('finds the current stage', () => {
    expect(currentStage(base)).toBe(2);
    expect(currentStage(mk({ gates: ['done', 'done', 'done', '', '', '', ''] }))).toBe(3);
    expect(currentStage(mk({ gates: Array(7).fill('done') }))).toBe('complete');
    expect(currentStage(mk({ gates: Array(7).fill('') }))).toBe('untracked');
    expect(currentStage(mk({ gates: Array(7).fill('na') }))).toBe('untracked');
  });
  it('detects projects ready to close', () => {
    expect(readyToClose(mk({ poc: 1, invoiced: 1 }))).toBe(true);
    expect(readyToClose(mk({ poc: 1, invoiced: 0.9 }))).toBe(false);
    expect(readyToClose(mk({ poc: 1, invoiced: 1, status: 'Eliminated' }))).toBe(false);
  });
  it('computes unbilled work', () => {
    expect(unbilled(mk({ poc: 0.8, invoiced: 0.5 }))).toBeCloseTo(300_000);
  });
});

describe('summarise', () => {
  it('counts only open projects and weights by contract value', () => {
    const rows = rowsOf([
      mk({ id: 'a', value: 1_000_000, rbp: 0.3, poc: 0.5, invoiced: 0.5 }),
      mk({ id: 'b', value: 3_000_000, rbp: 0.1, poc: 0.9, invoiced: 0.9, status: 'Created' }),
      mk({ id: 'c', value: 9_000_000, status: 'Eliminated' }),
    ], []);
    const s = summarise(rows);
    expect(s.count).toBe(2);
    expect(s.created).toBe(1);
    expect(s.posted).toBe(1);
    expect(s.value).toBe(4_000_000);
    expect(s.weightedRbp).toBeCloseTo((0.3 * 1 + 0.1 * 3) / 4);
    expect(s.weightedPoc).toBeCloseTo((0.5 * 1 + 0.9 * 3) / 4);
  });
});
