import type { Issue, Project } from '../types';

/** Fields the server accepts when updating a project (see PROJECT_FIELDS in server/store.mjs). */
export const PROJECT_EDIT_FIELDS = [
  'customer', 'location', 'description', 'level', 'pm', 'startDate', 'status', 'value', 'rbp', 'poc', 'invoiced', 'gates', 'handoverSigned', 'comment',
] as const;

/** Fields the server accepts when updating an issue (see ISSUE_FIELDS in server/store.mjs). */
export const ISSUE_EDIT_FIELDS = ['projectId', 'customer', 'location', 'description', 'pm', 'issue', 'nextSteps', 'responsible', 'status', 'dueDate'] as const;

function pick<T extends object, K extends keyof T>(o: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) if (k in o) out[k] = o[k];
  return out;
}

/** Only editable fields: imported or stored records carry extras (id, updatedAt, sourceRow) the API rejects. */
export const projectPatch = (p: Project) => pick(p, PROJECT_EDIT_FIELDS);
export const issuePatch = (i: Partial<Issue>) => pick(i, ISSUE_EDIT_FIELDS);

/** Ratios (0.8636) are shown and typed as whole-number percentages with one decimal (86.4). */
export const toPct = (v: number | null | undefined) => (v == null ? '' : String(Math.round(v * 1000) / 10));
export const fromPct = (s: string): number | null => (s.trim() === '' || Number.isNaN(Number(s)) ? null : Number(s) / 100);

/**
 * The ratio to save for a percentage input. Untouched text keeps the stored value exactly,
 * because the display is rounded and writing it back would silently change the figure.
 */
export const ratioFromText = (text: string, stored: number | null | undefined): number | null =>
  text === toPct(stored) ? (stored ?? null) : fromPct(text);

/** Only the fields whose values differ from the stored record. */
export function changedFields<T extends object>(next: T, prev: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(next) as (keyof T)[]) {
    if (JSON.stringify(next[k]) !== JSON.stringify(prev[k])) out[k] = next[k];
  }
  return out;
}
