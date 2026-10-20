import { useMemo, useState, type ReactNode } from 'react';
import { useData } from '../store';
import { isArchived, unbilled, type Stage } from '../lib/health';
import { money, moneyFull, pct } from '../lib/format';
import { attention, summarise, type Row } from '../lib/stats';
import { STATUSES, type Health } from '../types';
import { Card, HEALTH_LABEL, HEALTH_VAR, HealthBadge, Kpi, useTip } from './ui';

export interface Nav {
  tab: 'overview' | 'projects' | 'issues' | 'resources';
  params?: Record<string, string>;
}

const HEALTHS: Health[] = ['red', 'amber', 'green'];

export function Overview({ onOpen, onNav }: { onOpen: (id: string) => void; onNav: (n: Nav) => void }) {
  const { rows, state } = useData();
  const [pm, setPm] = useState('');
  const [level, setLevel] = useState('');
  const gateNames = state.meta.gateNames;

  const pms = useMemo(() => [...new Set(rows.filter((r) => !isArchived(r.p)).map((r) => r.p.pm))].sort(), [rows]);
  const levels = useMemo(() => [...new Set(rows.filter((r) => !isArchived(r.p)).map((r) => r.p.level))].sort(), [rows]);
  const scoped = useMemo(() => rows.filter((r) => (!pm || r.p.pm === pm) && (!level || r.p.level === level)), [rows, pm, level]);
  const s = useMemo(() => summarise(scoped), [scoped]);
  const archived = rows.filter((r) => isArchived(r.p)).length;

  const goto = (params: Record<string, string>) => onNav({ tab: 'projects', params: { ...(pm ? { pm } : {}), ...(level ? { level } : {}), ...params } });

  return (
    <>
      <h1>Portfolio overview</h1>
      <p className="muted" style={{ margin: '0 0 16px' }}>Open projects only. {archived} closed or eliminated projects are archived and kept under Projects.</p>
      <div className="filters">
        <label>PM
          <select value={pm} onChange={(e) => setPm(e.target.value)}>
            <option value="">All PMs</option>
            {pms.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
        <label>Level
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">All levels</option>
            {levels.map((l) => <option key={l} value={l}>{l || 'No level'}</option>)}
          </select>
        </label>
        {(pm || level) && <button className="btn" onClick={() => { setPm(''); setLevel(''); }}>Clear filters</button>}
      </div>

      <div className="grid g-kpi" style={{ marginBottom: 16 }}>
        <Kpi label="Open projects" value={s.count} note={`${s.posted} posted · ${s.created} created`} />
        <Kpi label="Contract value" value={money(s.value)} note={moneyFull(s.value)} />
        <Kpi label="Weighted RBP" value={pct(s.weightedRbp, 1)} note="Weighted by contract value" />
        <Kpi label="Weighted progress" value={pct(s.weightedPoc, 0)} note="POC, weighted by contract value" />
        <Kpi label="Done, not yet invoiced" value={money(s.unbilled)} note="Progress ahead of invoicing" />
      </div>

      <div className="grid g-2" style={{ marginBottom: 16 }}>
        <HealthCard s={s} onPick={(h) => goto({ health: h })} />
        <StageCard stages={s.stages} gateNames={gateNames} onPick={(st) => goto({ stage: String(st) })} />
      </div>

      <div className="grid g-3-2" style={{ marginBottom: 16 }}>
        <PmCard s={s} onPick={(name) => onNav({ tab: 'projects', params: { ...(level ? { level } : {}), pm: name } })} />
        <div className="grid" style={{ alignContent: 'start' }}>
          <StatusCard rows={scoped} onPick={(st) => goto({ status: st })} />
          <LevelCard s={s} onPick={(l) => onNav({ tab: 'projects', params: { ...(pm ? { pm } : {}), level: l } })} />
        </div>
      </div>

      <Attention rows={scoped} onOpen={onOpen} />
    </>
  );
}

type Sum = ReturnType<typeof summarise>;

function HealthCard({ s, onPick }: { s: Sum; onPick: (h: Health) => void }) {
  const { show, hide } = useTip();
  const total = s.count || 1;
  return (
    <Card
      title="Project health"
      sub={`Calculated from margin, invoicing, gates and comments${s.overrides ? ` · ${s.overrides} overridden by PM` : ''}`}
      table={
        <table>
          <thead><tr><th>Health</th><th className="r">Projects</th><th className="r">Contract value</th></tr></thead>
          <tbody>{HEALTHS.map((h) => <tr key={h}><td><HealthBadge health={h} /></td><td className="r num">{s.health[h].count}</td><td className="r num">{money(s.health[h].value)}</td></tr>)}</tbody>
        </table>
      }
    >
      <div className="track" style={{ height: 22, marginBottom: 14 }} role="img" aria-label={HEALTHS.map((h) => `${HEALTH_LABEL[h]} ${s.health[h].count}`).join(', ')}>
        {HEALTHS.map((h) => s.health[h].count > 0 && (
          <div key={h} className="seg-fill" style={{ width: `${(s.health[h].count / total) * 100}%`, background: HEALTH_VAR[h] }}
            onPointerMove={(e) => show(e, <><b>{s.health[h].count} projects</b><div className="muted">{HEALTH_LABEL[h]} · {money(s.health[h].value)}</div></>)} onPointerLeave={hide} />
        ))}
      </div>
      <div className="bars">
        {HEALTHS.map((h) => (
          <button key={h} className="brow hover-row" style={{ background: 'none', border: 0, textAlign: 'left', gridTemplateColumns: '120px 1fr auto' }} onClick={() => onPick(h)}>
            <HealthBadge health={h} />
            <span className="faint num">{money(s.health[h].value)}</span>
            <span className="val"><b>{s.health[h].count}</b> <span className="faint">({Math.round((s.health[h].count / total) * 100)}%)</span></span>
          </button>
        ))}
      </div>
    </Card>
  );
}

function StageCard({ stages, gateNames, onPick }: { stages: Sum['stages']; gateNames: string[]; onPick: (s: Stage) => void }) {
  const { show, hide } = useTip();
  const order: Stage[] = ['untracked', ...gateNames.map((_, i) => i), 'complete'];
  const label = (st: Stage) => (st === 'untracked' ? 'No gate data yet' : st === 'complete' ? 'All gates complete' : `${st + 1}. ${gateNames[st]}`);
  const max = Math.max(1, ...order.map((o) => stages.get(o) ?? 0));
  return (
    <Card
      title="Lifecycle stage"
      sub="Open projects by the gate they are currently in"
      table={
        <table>
          <thead><tr><th>Stage</th><th className="r">Projects</th></tr></thead>
          <tbody>{order.map((o) => <tr key={String(o)}><td>{label(o)}</td><td className="r num">{stages.get(o) ?? 0}</td></tr>)}</tbody>
        </table>
      }
    >
      <div className="bars">
        {order.map((o) => {
          const n = stages.get(o) ?? 0;
          const faint = o === 'untracked';
          return (
            <div key={String(o)} className="brow hover-row" style={{ gridTemplateColumns: 'minmax(120px, 210px) 1fr 32px' }} tabIndex={0}
              onClick={() => onPick(o)} onPointerMove={(e) => show(e, <><b>{n} projects</b><div className="muted">{label(o)}</div></>)} onPointerLeave={hide} onFocus={() => {}}>
              <span className="name" title={label(o)}>{label(o)}</span>
              <div className="track"><div className="seg-fill" style={{ width: `${(n / max) * 100}%`, background: faint ? 'var(--line-strong)' : 'var(--seq-2)' }} /></div>
              <span className="val num" style={{ minWidth: 0 }}>{n}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function PmCard({ s, onPick }: { s: Sum; onPick: (pm: string) => void }) {
  const { show, hide } = useTip();
  const max = Math.max(1, ...s.byPm.map((p) => p.value));
  return (
    <Card
      title="Contract value by PM"
      sub="Open projects, split by health"
      table={
        <table>
          <thead><tr><th>PM</th><th className="r">Projects</th><th className="r">Value</th><th className="r">Critical</th><th className="r">At risk</th></tr></thead>
          <tbody>{s.byPm.map((p) => <tr key={p.pm}><td>{p.pm}</td><td className="r num">{p.count}</td><td className="r num">{money(p.value)}</td><td className="r num">{money(p.byHealth.red)}</td><td className="r num">{money(p.byHealth.amber)}</td></tr>)}</tbody>
        </table>
      }
    >
      <div className="bars">
        {s.byPm.map((p) => (
          <div key={p.pm} className="brow hover-row" style={{ gridTemplateColumns: 'minmax(110px, 170px) 1fr 110px' }}>
            <button className="name" onClick={() => onPick(p.pm)} title={`Show ${p.pm}'s projects`}>{p.pm}</button>
            <div className="track" style={{ background: 'transparent' }}>
              {HEALTHS.map((h) => p.byHealth[h] > 0 && (
                <div key={h} className="seg-fill" style={{ width: `${(p.byHealth[h] / max) * 100}%`, background: HEALTH_VAR[h] }}
                  onPointerMove={(e) => show(e, <><b>{money(p.byHealth[h])}</b><div className="muted">{p.pm} · {HEALTH_LABEL[h]}</div></>)} onPointerLeave={hide} />
              ))}
            </div>
            <span className="val num">{money(p.value)} <span className="faint">· {p.count}</span></span>
          </div>
        ))}
      </div>
      <div className="legend" aria-label="Legend">
        {HEALTHS.map((h) => <span key={h}><i className="status-dot" style={{ background: HEALTH_VAR[h], marginRight: 0 }} />{HEALTH_LABEL[h]}</span>)}
        <span className="faint">Right: value · projects</span>
      </div>
    </Card>
  );
}

function StatusCard({ rows, onPick }: { rows: Row[]; onPick: (st: string) => void }) {
  return (
    <Card title="SAP status" sub="All projects, including archived">
      <table>
        <thead><tr><th>Status</th><th className="r">Projects</th><th className="r">Contract value</th></tr></thead>
        <tbody>
          {STATUSES.map((st) => {
            const m = rows.filter((r) => r.p.status === st);
            return (
              <tr key={st} onClick={() => onPick(st)}>
                <td>{st}{(st === 'Administrative closed' || st === 'Eliminated') && <span className="faint"> · archived</span>}</td>
                <td className="r num">{m.length}</td>
                <td className="r num">{money(m.reduce((a, r) => a + r.p.value, 0))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function LevelCard({ s, onPick }: { s: Sum; onPick: (l: string) => void }) {
  return (
    <Card title="By project level" sub="Open projects">
      <table>
        <thead><tr><th>Level</th><th className="r">Projects</th><th className="r">Contract value</th></tr></thead>
        <tbody>{s.byLevel.map((l) => <tr key={l.level} onClick={() => onPick(l.level === 'No level' ? '' : l.level)}><td>{l.level}</td><td className="r num">{l.count}</td><td className="r num">{money(l.value)}</td></tr>)}</tbody>
      </table>
    </Card>
  );
}

function Attention({ rows, onOpen }: { rows: Row[]; onOpen: (id: string) => void }) {
  const lists = useMemo(() => ({
    red: attention.red(rows), unbilled: attention.unbilled(rows), close: attention.readyToClose(rows), untracked: attention.untracked(rows),
  }), [rows]);
  const tabs = [
    { key: 'red', label: 'Critical', hint: 'Health is red', n: lists.red.length },
    { key: 'unbilled', label: 'Cash: done, not invoiced', hint: 'Progress ahead of invoicing, largest first', n: lists.unbilled.length },
    { key: 'close', label: 'Ready to close', hint: '100% complete and 100% invoiced, still open', n: lists.close.length },
    { key: 'untracked', label: 'No gate data', hint: 'Open projects with no lifecycle gates recorded', n: lists.untracked.length },
  ] as const;
  const [tab, setTab] = useState<(typeof tabs)[number]['key']>('red');
  const cur = tabs.find((t) => t.key === tab)!;
  const items = lists[tab];
  const detail = (r: Row): ReactNode => {
    if (tab === 'unbilled') return <><b>{money(unbilled(r.p))}</b><div className="faint">{pct(r.p.poc)} done · {pct(r.p.invoiced)} invoiced</div></>;
    return <><b>{money(r.p.value)}</b><div className="faint">{r.p.level || '–'}</div></>;
  };
  return (
    <Card title="Needs attention" sub={cur.hint}>
      <div className="filters" role="tablist" style={{ marginBottom: 8 }}>
        {tabs.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} className={`btn${tab === t.key ? ' primary' : ''}`} onClick={() => setTab(t.key)}>
            {t.label} <span style={{ opacity: 0.75 }}>({t.n})</span>
          </button>
        ))}
      </div>
      {items.length === 0 ? <div className="empty">Nothing here.</div> : (
        <div className="alist">
          {items.slice(0, 12).map((r) => (
            <button key={r.p.id} onClick={() => onOpen(r.p.id)}>
              <div style={{ minWidth: 0 }}>
                <div className="t">{r.p.description || r.p.id} <span className="faint">· {r.p.customer}</span></div>
                <div className="s">{r.p.id} · {r.p.pm || 'No PM'}{r.p.comment ? ` · ${r.p.comment}` : ''}</div>
              </div>
              <div className="v">{detail(r)}</div>
            </button>
          ))}
          {items.length > 12 && <div className="faint" style={{ padding: '8px 4px' }}>+ {items.length - 12} more in Projects</div>}
        </div>
      )}
    </Card>
  );
}
