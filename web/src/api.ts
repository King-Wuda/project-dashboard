import type { AppState, HistoryEntry, Issue, Project } from './types';

let editor = '';
try { editor = localStorage.getItem('editor') ?? ''; } catch { /* storage unavailable */ }
export const getEditor = () => editor;
export function setEditor(name: string) {
  editor = name;
  try { localStorage.setItem('editor', name); } catch { /* storage unavailable */ }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Editor': encodeURIComponent(editor) },
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
