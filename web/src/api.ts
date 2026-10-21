import type { AppState, HistoryEntry, Issue, Project } from './types';

/** Single-user for now: every change is recorded under this name. Replace with the signed-in user when logins are added. */
export const EDITOR = 'Gerhardus Uys';
export const getEditor = () => EDITOR;

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Editor': encodeURIComponent(EDITOR) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  state: () => call<AppState>('GET', '/state'),
  patchProject: (id: string, patch: Partial<Project>) => call<Project>('PATCH', `/projects/${encodeURIComponent(id)}`, patch),
  createProject: (p: Partial<Project> & { id: string }) => call<Project>('POST', '/projects', p),
  history: (entity: string, id: string) => call<HistoryEntry[]>('GET', `/history?entity=${entity}&id=${encodeURIComponent(id)}`),
  createIssue: (i: Partial<Issue>) => call<Issue>('POST', '/issues', i),
  patchIssue: (id: string, patch: Partial<Issue>) => call<Issue>('PATCH', `/issues/${encodeURIComponent(id)}`, patch),
  deleteIssue: (id: string) => call<{ ok: true }>('DELETE', `/issues/${encodeURIComponent(id)}`),
  setDataAsOf: (dataAsOf: string) => call<AppState['meta']>('PATCH', '/meta', { dataAsOf }),
};
