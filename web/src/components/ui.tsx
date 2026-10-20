import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { GateState, Health } from '../types';

/* ---------- icons ---------- */
const svg = (children: ReactNode, size = 14) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
export const IconCheck = () => svg(<><circle cx="8" cy="8" r="6.2" /><path d="M5.2 8.2l2 2 3.6-4" /></>);
export const IconWarn = () => svg(<><path d="M8 2.2l6 10.6H2z" /><path d="M8 6.6v3M8 11.4v.1" /></>);
export const IconAlert = () => svg(<><circle cx="8" cy="8" r="6.2" /><path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4" /></>);

export const HEALTH_LABEL: Record<Health, string> = { green: 'On track', amber: 'At risk', red: 'Critical' };
const HEALTH_ICON: Record<Health, ReactNode> = { green: <IconCheck />, amber: <IconWarn />, red: <IconAlert /> };
export const HEALTH_VAR: Record<Health, string> = { green: 'var(--good)', amber: 'var(--warn)', red: 'var(--crit)' };

export function HealthBadge({ health, overridden }: { health: Health | null; overridden?: boolean }) {
  if (!health) return <span className="pill neutral">Archived</span>;
  return (
    <span className={`pill ${health}${overridden ? ' ov' : ''}`} title={overridden ? 'Set by PM override' : 'Calculated'}>
      {HEALTH_ICON[health]}
      {HEALTH_LABEL[health]}
      {overridden && <span aria-label="overridden"> ✎</span>}
    </span>
  );
}

/* ---------- gates ---------- */
export const GATE_LABEL: Record<GateState, string> = {
  '': 'Not started', done: 'Done', wip: 'In progress', risk: 'Off track / risk', deviation: 'Deviation', na: 'Not applicable',
};

export function GateGlyph({ state }: { state: GateState }) {
  const cls = state === '' ? 'none' : state;
  let body: ReactNode;
  switch (state) {
    case 'done': body = <><circle cx="8" cy="8" r="6.5" fill="currentColor" stroke="none" /><path d="M5.2 8.2l2 2 3.6-4" stroke="var(--surface)" /></>; break;
    case 'wip': body = <><circle cx="8" cy="8" r="6" /><path d="M8 2v12a6 6 0 0 1 0-12z" fill="currentColor" stroke="none" /></>; break;
    case 'risk': body = <><path d="M8 2l6.2 11H1.8z" fill="currentColor" stroke="none" /><path d="M8 6.5v3M8 11.2v.1" stroke="var(--surface)" /></>; break;
    case 'deviation': body = <><circle cx="8" cy="8" r="6.5" fill="currentColor" stroke="none" /><path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" stroke="var(--surface)" /></>; break;
    case 'na': body = <path d="M4 8h8" />; break;
    default: body = <circle cx="8" cy="8" r="6" strokeDasharray="2 2.4" />;
  }
  return <span className={`gate ${cls}`}>{svg(body, 14)}</span>;
}

export function GateDots({ gates, names }: { gates: GateState[]; names: string[] }) {
  const { show, hide } = useTip();
  return (
    <span className="gates" role="img" aria-label={gates.map((g, i) => `${names[i]}: ${GATE_LABEL[g]}`).join('; ')}>
      {gates.map((g, i) => (
        <span key={i} onPointerMove={(e) => show(e, <><b>{names[i]}</b><div className="muted">{GATE_LABEL[g]}</div></>)} onPointerLeave={hide}>
          <GateGlyph state={g} />
        </span>
      ))}
    </span>
  );
}

/* ---------- tooltip ---------- */
interface TipApi {
  show: (e: { clientX: number; clientY: number }, content: ReactNode) => void;
  hide: () => void;
}
const TipCtx = createContext<TipApi>({ show: () => {}, hide: () => {} });
export const useTip = () => useContext(TipCtx);

export function TipProvider({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<{ x: number; y: number; content: ReactNode } | null>(null);
  const show = useCallback((e: { clientX: number; clientY: number }, content: ReactNode) => setTip({ x: e.clientX, y: e.clientY, content }), []);
  const hide = useCallback(() => setTip(null), []);
  const left = tip ? Math.min(tip.x + 14, window.innerWidth - 300) : 0;
  return (
    <TipCtx.Provider value={{ show, hide }}>
      {children}
      {tip && <div className="tip" role="tooltip" style={{ left, top: tip.y + 14 }}>{tip.content}</div>}
    </TipCtx.Provider>
  );
}

/* ---------- card with chart/table toggle ---------- */
export function Card({ title, sub, children, table, className = '' }: { title: string; sub?: string; children: ReactNode; table?: ReactNode; className?: string }) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  return (
    <section className={`card ${className}`}>
      <div className="card-head">
        <div>
          <h2>{title}</h2>
          {sub && <div className="sub">{sub}</div>}
        </div>
        {table && (
          <div className="seg" role="group" aria-label={`${title} view`}>
            <button aria-pressed={view === 'chart'} onClick={() => setView('chart')}>Chart</button>
            <button aria-pressed={view === 'table'} onClick={() => setView('table')}>Table</button>
          </div>
        )}
      </div>
      {table && view === 'table' ? table : children}
    </section>
  );
}

export function Kpi({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="card kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {note && <div className="note">{note}</div>}
    </div>
  );
}

export function MiniProgress({ value }: { value: number | null }) {
  if (value == null) return <span className="faint">–</span>;
  return (
    <span className="num">
      <span className="mini-bar"><i style={{ width: `${Math.min(100, value * 100)}%` }} /></span>
      {Math.round(value * 100)}%
    </span>
  );
}
