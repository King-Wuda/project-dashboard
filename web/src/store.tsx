import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import { rowsOf, type Row } from './lib/stats';
import type { AppState, Issue, Project } from './types';

interface Ctx {
  state: AppState;
  rows: Row[];
  updateProject: (id: string, patch: Partial<Project>) => Promise<void>;
  createProject: (p: Partial<Project> & { id: string }) => Promise<void>;
  createIssue: (i: Partial<Issue>) => Promise<void>;
  updateIssue: (id: string, patch: Partial<Issue>) => Promise<void>;
  removeIssue: (id: string) => Promise<void>;
  setDataAsOf: (d: string) => Promise<void>;
}

const C = createContext<Ctx | null>(null);
export const useData = () => {
  const c = useContext(C);
  if (!c) throw new Error('useData outside provider');
  return c;
};

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.state().then(setState).catch((e: Error) => setError(e.message));
  }, []);

  const rows = useMemo(() => (state ? rowsOf(state.projects, state.meta.gateNames) : []), [state]);

  const updateProject = useCallback(async (id: string, patch: Partial<Project>) => {
    const next = await api.patchProject(id, patch);
    setState((s) => s && { ...s, projects: s.projects.map((p) => (p.id === id ? next : p)) });
  }, []);
  const createProject = useCallback(async (p: Partial<Project> & { id: string }) => {
    const next = await api.createProject(p);
    setState((s) => s && { ...s, projects: [...s.projects, next] });
  }, []);
  const createIssue = useCallback(async (i: Partial<Issue>) => {
    const next = await api.createIssue(i);
    setState((s) => s && { ...s, issues: [...s.issues, next] });
  }, []);
  const updateIssue = useCallback(async (id: string, patch: Partial<Issue>) => {
    const next = await api.patchIssue(id, patch);
    setState((s) => s && { ...s, issues: s.issues.map((i) => (i.id === id ? next : i)) });
  }, []);
  const removeIssue = useCallback(async (id: string) => {
    await api.deleteIssue(id);
    setState((s) => s && { ...s, issues: s.issues.filter((i) => i.id !== id) });
  }, []);
  const setDataAsOf = useCallback(async (d: string) => {
    const meta = await api.setDataAsOf(d);
    setState((s) => s && { ...s, meta });
  }, []);

  if (error) return <div className="boot">Could not load data: {error}</div>;
  if (!state) return <div className="boot">Loading…</div>;
  return <C.Provider value={{ state, rows, updateProject, createProject, createIssue, updateIssue, removeIssue, setDataAsOf }}>{children}</C.Provider>;
}
