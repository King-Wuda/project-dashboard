import { useMemo, useState } from 'react';
import { useData } from '../store';
import { isArchived } from '../lib/health';
import { date, money, pct } from '../lib/format';
import type { Row } from '../lib/stats';
import { STATUSES } from '../types';
import { GateDots, HealthBadge, MiniProgress } from './ui';

type SortKey = 'id' | 'customer' | 'description' | 'level' | 'pm' | 'startDate' | 'status' | 'value' | 'rbp' | 'poc' | 'invoiced' | 'health';
const HEALTH_RANK = { red: 0, amber: 1, green: 2 } as const;

function sortValue(r: Row, k: SortKey): string | number {
  if (k === 'health') return r.health ? HEALTH_RANK[r.health] : 9;
  const v = r.p[k];
  return v == null ? -1 : (v as string | number);
}

function csvCell(v: unknown): string {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stop spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function Projects({ params, onOpen, onNew, onParams }: {
  params: Record<string, string>;
  onOpen: (id: string) => void;
  onNew: () => void;
  onParams: (p: Record<string, string>) => void;
}) {
  const { rows, state } = useData();
  const gateNames = state.meta.gateNames;
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'health', dir: 1 });
  const [q, setQ] = useState(params.q ?? '');

  const set = (k: string, v: string) => {
    const next = { ...params };
    if (v) next[k] = v; else delete next[k];
    onParams(next);
  };
  const status = params.status ?? 'open';

  const pms = useMemo(() => [...new Set(rows.map((r) => r.p.pm))].filter(Boolean).sort(), [rows]);
  const levels = useMemo(() => [...new Set(rows.map((r) => r.p.level))].sort(), [rows]);
  const archivedCount = rows.filter((r) => isArchived(r.p)).length;

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = rows.filter((r) => {
      const { p } = r;
      if (status === 'open' ? isArchived(p) : status !== 'all' && p.status !== status) return false;
      if (params.pm && p.pm !== params.pm) return false;
      if (params.level !== undefined && params.level !== 'all' && p.level !== params.level) return false;
      if (params.health && r.health !== params.health) return false;
      if (params.stage !== undefined && String(r.stage) !== params.stage) return false;
      if (needle && ![p.id, p.customer, p.location, p.description, p.pm, p.comment].some((s) => s.toLowerCase().includes(needle))) return false;
      return true;
    });
    const { k, dir } = sort;
    return list.sort((a, b) => {
      const x = sortValue(a, k), y = sortValue(b, k);
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
      return c ? c * dir : b.p.value - a.p.value;
    });
  }, [rows, params, q, status, sort]);

  const head = (k: SortKey, label: string, cls = '') => (
    <th className={cls} aria-sort={sort.k === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => setSort((s) => (s.k === k ? { k, dir: (-s.dir) as 1 | -1 } : { k, dir: 1 }))}>
        {label}<span aria-hidden="true">{sort.k === k ? (sort.dir === 1 ? '▲' : '▼') : ''}</span>
      </button>
    </th>
  );

  function exportCsv() {
    const cols = ['Project no', 'Customer', 'Location', 'Description', 'Level', 'PM', 'Start date', 'Status', 'Contract value ZAR', 'RBP %', 'POC %', 'Invoiced %', 'Health', 'Overridden', ...gateNames, 'Handover signed', 'Comment'];
    const lines = [cols.map(csvCell).join(',')];
    for (const r of shown) {
      const p = r.p;
      lines.push([p.id, p.customer, p.location, p.description, p.level, p.pm, p.startDate, p.status, p.value, p.rbp, p.poc, p.invoiced, r.health ?? 'archived', r.overridden ? 'yes' : '',
        ...p.gates, p.handoverSigned ? 'yes' : '', p.comment].map(csvCell).join(','));
    }
    const url = URL.createObjectURL(new Blob([`﻿${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `projects-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const stageLabel = params.stage === undefined ? '' : params.stage === 'untracked' ? 'No gate data' : params.stage === 'complete' ? 'All gates complete' : gateNames[Number(params.stage)];

  return (
    <>
      <h1>Projects</h1>
      <div className="filters" style={{ marginTop: 12 }}>
        <input type="search" placeholder="Search project, customer, PM, comment…" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 280 }} />
        <label>Status
          <select value={status} onChange={(e) => set('status', e.target.value === 'open' ? '' : e.target.value)}>
            <option value="open">Open (Created + Posted)</option>
            <option value="all">All, incl. archived ({archivedCount})</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label>PM
          <select value={params.pm ?? ''} onChange={(e) => set('pm', e.target.value)}>
            <option value="">All</option>
            {pms.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
        <label>Level
          <select value={params.level ?? 'all'} onChange={(e) => set('level', e.target.value === 'all' ? '' : e.target.value)}>
            <option value="all">All</option>
            {levels.map((l) => <option key={l} value={l}>{l || 'No level'}</option>)}
          </select>
        </label>
        <label>Health
          <select value={params.health ?? ''} onChange={(e) => set('health', e.target.value)}>
            <option value="">All</option><option value="red">Critical</option><option value="amber">At risk</option><option value="green">On track</option>
          </select>
        </label>
        {stageLabel && <button className="btn" onClick={() => set('stage', '')}>Stage: {stageLabel} ✕</button>}
        <span className="spacer" />
        <button className="btn" onClick={exportCsv}>Export CSV</button>
        <button className="btn primary" onClick={onNew}>+ Add project</button>
      </div>
      <p className="count-line">{shown.length} projects · {money(shown.reduce((a, r) => a + r.p.value, 0))}</p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {head('id', 'Project no', 'sticky')}{head('description', 'Project')}{head('health', 'Health')}{head('pm', 'PM')}{head('level', 'Level')}{head('status', 'Status')}
              <th>Lifecycle gates</th>
              {head('value', 'Contract value', 'r')}{head('rbp', 'RBP', 'r')}{head('poc', 'POC')}{head('invoiced', 'Invoiced')}{head('startDate', 'Start')}
              <th>Handover</th><th>Comment</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const p = r.p;
              return (
                <tr key={p.id} onClick={() => onOpen(p.id)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(p.id); }}>
                  <td className="sticky num">{p.id}</td>
                  <td className="wrap proj"><div>{p.description || '–'}</div><div className="faint">{p.customer}{p.location && ` · ${p.location}`}</div></td>
                  <td><HealthBadge health={r.health} overridden={r.overridden} /></td>
                  <td>{p.pm || '–'}</td>
                  <td>{p.level || '–'}</td>
                  <td><span className="muted">{p.status}</span></td>
                  <td><GateDots gates={p.gates} names={gateNames} /></td>
                  <td className="r num">{money(p.value)}</td>
                  <td className="r num">{pct(p.rbp, 1)}</td>
                  <td><MiniProgress value={p.poc} /></td>
                  <td><MiniProgress value={p.invoiced} /></td>
                  <td>{date(p.startDate)}</td>
                  <td>{p.handoverSigned ? '✓ Signed' : <span className="faint">–</span>}</td>
                  <td className="wrap"><div className="clamp" title={p.comment}>{p.comment}</div></td>
                </tr>
              );
            })}
            {shown.length === 0 && <tr><td colSpan={14} className="empty">No projects match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
