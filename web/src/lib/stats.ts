import type { Health, Project } from '../types';
import { assess, currentStage, isArchived, readyToClose, unbilled, type Stage } from './health';

export interface Row {
  p: Project;
  health: Health | null;
  calculated: Health | null;
  overridden: boolean;
  stage: Stage | null;
}

export function rowsOf(projects: Project[], gateNames: string[]): Row[] {
  return projects.map((p) => {
    const a = assess(p, gateNames);
    return { p, health: a.effective, calculated: a.calculated, overridden: a.overridden, stage: isArchived(p) ? null : currentStage(p) };
  });
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export interface Summary {
  count: number;
  created: number;
  posted: number;
  value: number;
  weightedRbp: number | null;
  weightedPoc: number | null;
  unbilled: number;
  health: Record<Health, { count: number; value: number }>;
  overrides: number;
  byPm: { pm: string; count: number; value: number; byHealth: Record<Health, number> }[];
  byLevel: { level: string; count: number; value: number }[];
  stages: Map<Stage, number>;
}

/** Summary of the open (non-archived) rows passed in. */
export function summarise(rows: Row[]): Summary {
  const open = rows.filter((r) => !isArchived(r.p));
  const value = sum(open.map((r) => r.p.value));
  const w = (f: (p: Project) => number | null) => {
    const base = sum(open.filter((r) => f(r.p) != null).map((r) => r.p.value));
    return base ? sum(open.filter((r) => f(r.p) != null).map((r) => (f(r.p) as number) * r.p.value)) / base : null;
  };
  const health = { green: { count: 0, value: 0 }, amber: { count: 0, value: 0 }, red: { count: 0, value: 0 } };
  const pm = new Map<string, Summary['byPm'][number]>();
  const level = new Map<string, { count: number; value: number }>();
  const stages = new Map<Stage, number>();
  for (const r of open) {
    if (r.health) { health[r.health].count++; health[r.health].value += r.p.value; }
    const e = pm.get(r.p.pm || 'Unassigned') ?? { pm: r.p.pm || 'Unassigned', count: 0, value: 0, byHealth: { green: 0, amber: 0, red: 0 } };
    e.count++; e.value += r.p.value; if (r.health) e.byHealth[r.health] += r.p.value;
    pm.set(e.pm, e);
    const l = level.get(r.p.level || 'No level') ?? { count: 0, value: 0 };
    l.count++; l.value += r.p.value; level.set(r.p.level || 'No level', l);
    if (r.stage != null) stages.set(r.stage, (stages.get(r.stage) ?? 0) + 1);
  }
  return {
    count: open.length,
    created: open.filter((r) => r.p.status === 'Created').length,
    posted: open.filter((r) => r.p.status === 'Posted').length,
    value,
    weightedRbp: w((p) => p.rbp),
    weightedPoc: w((p) => p.poc),
    unbilled: sum(open.map((r) => unbilled(r.p))),
    health,
    overrides: open.filter((r) => r.overridden).length,
    byPm: [...pm.values()].sort((a, b) => b.value - a.value),
    byLevel: [...level.entries()].map(([l, v]) => ({ level: l, ...v })).sort((a, b) => a.level.localeCompare(b.level)),
    stages,
  };
}

export const attention = {
  red: (rows: Row[]) => rows.filter((r) => r.health === 'red').sort((a, b) => b.p.value - a.p.value),
  readyToClose: (rows: Row[]) => rows.filter((r) => readyToClose(r.p)),
  unbilled: (rows: Row[]) => rows.filter((r) => !isArchived(r.p) && unbilled(r.p) > 0).sort((a, b) => unbilled(b.p) - unbilled(a.p)),
  untracked: (rows: Row[]) => rows.filter((r) => r.stage === 'untracked').sort((a, b) => b.p.value - a.p.value),
};
