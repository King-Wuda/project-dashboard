import type { Issue, IssueStatus } from '../types';

export interface IssueView {
  status: IssueStatus;
  /** Whole days past the due date (only when overdue because of the date). */
  daysLate: number | null;
  /** Whole days until the due date (0 = due today); null when no due date or already late. */
  daysLeft: number | null;
}

/** Today's date in the viewer's timezone as YYYY-MM-DD. */
export function todayIso(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Whole days from one YYYY-MM-DD date to another (calendar days, DST-safe). */
export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/**
 * The status to show for an issue. Completed always wins. With a due date, the date decides:
 * past it means Overdue, otherwise WIP. Without a due date, the status set by hand is used.
 */
export function issueView(i: Pick<Issue, 'status' | 'dueDate'>, today: string): IssueView {
  if (i.status === 'Completed') return { status: 'Completed', daysLate: null, daysLeft: null };
  if (!i.dueDate) return { status: i.status, daysLate: null, daysLeft: null };
  const left = daysBetween(today, i.dueDate);
  return left < 0 ? { status: 'Overdue', daysLate: -left, daysLeft: null } : { status: 'WIP', daysLate: null, daysLeft: left };
}

/** Sort key: overdue first (most late first), then by nearest due date, undated next, completed last. */
export function issueOrder(i: Issue, today: string): number {
  const v = issueView(i, today);
  if (v.status === 'Completed') return 1e9;
  if (v.daysLate != null) return -v.daysLate;
  if (v.daysLeft != null) return v.daysLeft;
  return v.status === 'Overdue' ? -0.5 : 1e6; // manually overdue without a date sits just below dated overdue items
}

export function dueText(v: IssueView): string {
  if (v.daysLate != null) return `${v.daysLate} day${v.daysLate === 1 ? '' : 's'} late`;
  if (v.daysLeft === 0) return 'Due today';
  if (v.daysLeft != null) return `Due in ${v.daysLeft} day${v.daysLeft === 1 ? '' : 's'}`;
  return '';
}
