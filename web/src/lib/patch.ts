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
