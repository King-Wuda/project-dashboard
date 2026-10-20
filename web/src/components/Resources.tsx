import { useMemo } from 'react';
import { useData } from '../store';
import { useTip, Card } from './ui';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Sortable key for "Q4 '26" or "Dec '26" (a month sorts just after its quarter); anything else (TBC) sorts last. */
export function handoverKey(s: string): number {
  const q = s.match(/Q([1-4])\s*'?\s*(\d{2})/i);
  if (q) return Number(q[2]) * 10 + Number(q[1]);
  const m = s.match(/([a-z]{3})[a-z]*\s*'?\s*(\d{2})/i);
  const mi = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
  return m && mi >= 0 ? Number(m[2]) * 10 + Math.ceil((mi + 1) / 3) + 0.5 : 9999;
}

export function Resources({ onOpenProject }: { onOpenProject: (id: string) => void }) {
  const { state, rows } = useData();
  const { show, hide } = useTip();
  const list = state.resources;
  const known = new Set(rows.map((r) => r.p.id));

  const handover = useMemo(() => {
    const m = new Map<string, number>();
    list.forEach((r) => m.set(r.handover || 'TBC', (m.get(r.handover || 'TBC') ?? 0) + 1));
    return [...m.entries()].sort((a, b) => handoverKey(a[0]) - handoverKey(b[0]));
  }, [list]);
  const max = Math.max(1, ...handover.map(([, n]) => n));
  const byPm = useMemo(() => {
    const m = new Map<string, typeof list>();
    list.forEach((r) => m.set(r.pm || 'Unassigned', [...(m.get(r.pm || 'Unassigned') ?? []), r]));
    return [...m.entries()];
  }, [list]);

  return (
    <>
      <h1>Resource planner</h1>
      <p className="muted" style={{ margin: '0 0 16px' }}>Contractors and internal resources for live and upcoming projects. Read-only in this version.</p>
      <div className="grid g-3-2" style={{ marginBottom: 16 }}>
        <Card title="Planned handover" sub="Projects by handover quarter">
          <div className="bars">
            {handover.map(([q, n]) => (
              <div key={q} className="brow hover-row" style={{ gridTemplateColumns: '70px 1fr 28px' }}
                onPointerMove={(e) => show(e, <b>{n} project{n === 1 ? '' : 's'} · {q}</b>)} onPointerLeave={hide}>
                <span className="name">{q}</span>
                <div className="track"><div className="seg-fill" style={{ width: `${(n / max) * 100}%`, background: 'var(--seq-2)' }} /></div>
                <span className="val num" style={{ minWidth: 0 }}>{n}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Pipeline" sub="Entries without a project number yet">
          <div className="kpi"><div className="value">{list.filter((r) => !r.projectId).length}</div><div className="note">of {list.length} planned projects</div></div>
        </Card>
      </div>
      {byPm.map(([pm, items]) => (
        <section key={pm} style={{ marginBottom: 16 }}>
          <h3>{pm} <span className="faint">· {items.length}</span></h3>
          <div className="table-wrap" style={{ maxHeight: 'none' }}>
            <table>
              <thead><tr><th>Project</th><th>Level</th><th>Phase</th><th>Piping</th><th>Electrician</th><th>Panel builder</th><th>Internal</th><th>Cladding</th><th>Handover</th><th>Comment</th></tr></thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={i} style={{ cursor: 'default' }}>
                    <td className="wrap" style={{ minWidth: 220 }}>
                      {r.projectId && known.has(r.projectId)
                        ? <button className="btn" style={{ padding: '0 8px', minHeight: 24, marginRight: 6 }} onClick={() => onOpenProject(r.projectId)}>{r.projectId}</button>
                        : <span className="faint num">{r.projectId || 'Pipeline'} </span>}
                      <div>{r.description}</div>
                      <div className="faint">{r.customer}{r.location && ` · ${r.location}`}</div>
                    </td>
                    <td>{r.level || '–'}</td>
                    <td><span className="pill neutral">{r.phase || '–'}</span></td>
                    <td>{r.pipingContractor || '–'}</td><td>{r.electrician || '–'}</td><td>{r.panelBuilder || '–'}</td>
                    <td>{r.internal.length ? r.internal.join(', ') : '–'}</td><td>{r.claddingContractor || '–'}</td>
                    <td className="num">{r.handover || '–'}</td><td className="wrap">{r.comment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
