import { describe, expect, it } from 'vitest';
import type { Issue } from '../types';
import { daysBetween, dueText, issueOrder, issueView, todayIso } from './issues';

const mk = (o: Partial<Issue>): Issue => ({ id: 'I-1', projectId: '', customer: '', location: '', description: '', pm: '', issue: 'x', nextSteps: '', responsible: '', status: 'WIP', dueDate: null, ...o });
const TODAY = '2026-10-21';

describe('issueView', () => {
  it('turns an open issue overdue once its due date has passed', () => {
    const v = issueView(mk({ dueDate: '2026-10-05' }), TODAY);
    expect(v).toEqual({ status: 'Overdue', daysLate: 16, daysLeft: null });
    expect(dueText(v)).toBe('16 days late');
  });
  it('is not overdue on the due date itself', () => {
    const v = issueView(mk({ dueDate: TODAY }), TODAY);
    expect(v.status).toBe('WIP');
    expect(dueText(v)).toBe('Due today');
  });
  it('counts days left, singular and plural', () => {
    expect(dueText(issueView(mk({ dueDate: '2026-10-22' }), TODAY))).toBe('Due in 1 day');
    expect(dueText(issueView(mk({ dueDate: '2026-10-25' }), TODAY))).toBe('Due in 4 days');
    expect(dueText(issueView(mk({ dueDate: '2026-10-20' }), TODAY))).toBe('1 day late');
  });
  it('lets the date decide when one is set, even if status was set to Overdue by hand', () => {
    expect(issueView(mk({ status: 'Overdue', dueDate: '2026-12-01' }), TODAY).status).toBe('WIP');
  });
  it('keeps the hand-set status when there is no due date (including imported issues)', () => {
    expect(issueView(mk({ status: 'Overdue' }), TODAY).status).toBe('Overdue');
    expect(issueView(mk({ status: 'WIP', dueDate: undefined }), TODAY).status).toBe('WIP');
  });
  it('never reopens a completed issue, however old its due date', () => {
    expect(issueView(mk({ status: 'Completed', dueDate: '2020-01-01' }), TODAY).status).toBe('Completed');
  });
});

describe('ordering and dates', () => {
  it('sorts most-late first, then nearest due, then undated, completed last', () => {
    const items = [
      mk({ id: 'done', status: 'Completed', dueDate: '2026-01-01' }),
      mk({ id: 'undated' }),
      mk({ id: 'soon', dueDate: '2026-10-23' }),
      mk({ id: 'later', dueDate: '2026-12-01' }),
      mk({ id: 'late5', dueDate: '2026-10-16' }),
      mk({ id: 'late20', dueDate: '2026-10-01' }),
    ];
    expect(items.sort((a, b) => issueOrder(a, TODAY) - issueOrder(b, TODAY)).map((i) => i.id)).toEqual(['late20', 'late5', 'soon', 'later', 'undated', 'done']);
  });
  it('counts calendar days across month ends and DST changes', () => {
    expect(daysBetween('2026-10-31', '2026-11-01')).toBe(1);
    expect(daysBetween('2026-03-28', '2026-04-05')).toBe(8);
  });
  it('formats today in local time', () => {
    expect(todayIso(new Date(2026, 9, 21, 23, 59))).toBe('2026-10-21');
  });
});
