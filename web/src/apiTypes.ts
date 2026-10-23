import type { AppState, HistoryEntry, Issue, Project } from './types';

/** What the app needs from its data source: the Node server in the hosted build, the browser in the standalone file. */
export interface Api {
  state: () => Promise<AppState>;
  patchProject: (id: string, patch: Partial<Project>) => Promise<Project>;
  createProject: (p: Partial<Project> & { id: string }) => Promise<Project>;
  history: (entity: string, id: string) => Promise<HistoryEntry[]>;
  createIssue: (i: Partial<Issue>) => Promise<Issue>;
  patchIssue: (id: string, patch: Partial<Issue>) => Promise<Issue>;
  deleteIssue: (id: string) => Promise<{ ok: true }>;
  setDataAsOf: (dataAsOf: string) => Promise<AppState['meta']>;
}
