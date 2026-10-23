import type { Api } from './apiTypes';
import { EDITOR, getEditor } from './editor';
import { localApi } from './localApi';

export { EDITOR, getEditor };

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

const httpApi: Api = {
  state: () => call('GET', '/state'),
  patchProject: (id, patch) => call('PATCH', `/projects/${encodeURIComponent(id)}`, patch),
  createProject: (p) => call('POST', '/projects', p),
  history: (entity, id) => call('GET', `/history?entity=${entity}&id=${encodeURIComponent(id)}`),
  createIssue: (i) => call('POST', '/issues', i),
  patchIssue: (id, patch) => call('PATCH', `/issues/${encodeURIComponent(id)}`, patch),
  deleteIssue: (id) => call('DELETE', `/issues/${encodeURIComponent(id)}`),
  setDataAsOf: (dataAsOf) => call('PATCH', '/meta', { dataAsOf }),
};

export const api: Api = __STANDALONE__ ? localApi : httpApi;
