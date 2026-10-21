import { useMemo, useState, type ReactNode } from 'react';
import { useData } from '../store';
import { date } from '../lib/format';
import { dueText, issueOrder, issueView, todayIso } from '../lib/issues';
import { issuePatch } from '../lib/patch';
import type { Issue, IssueStatus } from '../types';
import { GateGlyph, IconCheck, IconWarn } from './ui';

const STATUSES: IssueStatus[] = ['WIP', 'Overdue', 'Completed'];
const ICON: Record<IssueStatus, ReactNode> = {
  WIP: <GateGlyph state="wip" />,
  Overdue: <span style={{ color: 'var(--crit)', display: 'inline-flex' }}><IconWarn /></span>,
  Completed: <span style={{ color: 'var(--good)', display: 'inline-flex' }}><IconCheck /></span>,
};
const BLANK: Partial<Issue> = { projectId: '', issue: '', nextSteps: '', responsible: '', pm: '', status: 'WIP' };

export function Issues({ onOpenProject }: { onOpenProject: (id: string) => void }) {
  const { state, rows, createIssue, updateIssue, removeIssue } = useData();
  const [filter, setFilter] = useState<'open' | 'all' | IssueStatus>('open');
  const [editing, setEditing] = useState<Partial<Issue> | null>(null);
  const [error, setError] = useState('');
  const today = todayIso();

  const views = useMemo(() => new Map(state.issues.map((i) => [i.id, issueView(i, today)])), [state.issues, today]);
  const list = useMemo(
    () => state.issues
      .filter((i) => { const st = views.get(i.id)!.status; return filter === 'all' ? true : filter === 'open' ? st !== 'Completed' : st === filter; })
      .sort((a, b) => issueOrder(a, today) - issueOrder(b, today)),
    [state.issues, views, filter, today],
  );
  const counts = (s: IssueStatus) => [...views.values()].filter((v) => v.status === s).length;

  async function save() {
    if (!editing) return;
    setError('');
    try {
      const p = rows.find((r) => r.p.id === editing.projectId)?.p;
      const body = issuePatch({ ...editing, ...(p ? { customer: p.customer, location: p.location, description: p.description, pm: editing.pm || p.pm } : {}) });
      if (editing.id) await updateIssue(editing.id, body); else await createIssue(body);
      setEditing(null);
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <>
      <h1>Issue log</h1>
      <p className="muted" style={{ margin: '0 0 16px' }}>Commercial and delivery issues raised in the project review meeting.</p>
      <div className="filters">
        {(['open', 'all', ...STATUSES] as const).map((f) => (
          <button key={f} className={`btn${filter === f ? ' primary' : ''}`} onClick={() => setFilter(f)}>
            {f === 'open' ? 'Open' : f === 'all' ? 'All' : f} {f !== 'open' && f !== 'all' && <span style={{ opacity: 0.75 }}>({counts(f)})</span>}
          </button>
        ))}
        <span className="spacer" />
        <button className="btn primary" onClick={() => setEditing({ ...BLANK })}>+ Add issue</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Status</th><th>Due</th><th>Project</th><th>PM</th><th>Issue</th><th>Next steps</th><th>Responsible</th><th /></tr></thead>
          <tbody>
            {list.map((i) => {
              const v = views.get(i.id)!;
              return (
              <tr key={i.id} style={{ cursor: 'default' }}>
                <td><span className="pill neutral">{ICON[v.status]}{v.status}</span></td>
                <td>
                  {i.dueDate ? <><div className="num">{date(i.dueDate)}</div><div className={v.daysLate != null ? 'err' : 'faint'} style={{ fontSize: 12 }}>{dueText(v)}</div></> : <span className="faint">No due date</span>}
                </td>
                <td className="proj">
                  {rows.some((r) => r.p.id === i.projectId)
                    ? <button className="btn" style={{ padding: '0 8px', minHeight: 24 }} onClick={() => onOpenProject(i.projectId)}>{i.projectId}</button>
                    : <span className="num">{i.projectId || '–'}</span>}
                  <div className="faint" style={{ whiteSpace: 'normal', marginTop: 2 }}>{i.customer}{i.location && ` · ${i.location}`}</div>
                </td>
                <td>{i.pm}</td>
                <td className="wrap sm">{i.issue}</td>
                <td className="wrap sm">{i.nextSteps}</td>
                <td className="wrap sm" style={{ minWidth: 120 }}>{i.responsible}</td>
                <td style={{ width: 1 }}>
                  <button className="btn" onClick={() => setEditing(i)}>Edit</button>{' '}
                  <button className="btn danger" onClick={() => { if (window.confirm('Delete this issue? This cannot be undone.')) removeIssue(i.id); }}>Delete</button>
                </td>
              </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={9} className="empty">No issues in this view.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <>
          <div className="scrim" onClick={() => setEditing(null)} />
          <aside className="drawer" role="dialog" aria-modal="true" aria-label="Issue">
            <div className="drawer-head"><h1 style={{ fontSize: 17 }}>{editing.id ? `Edit ${editing.id}` : 'Add issue'}</h1><button className="x" onClick={() => setEditing(null)} aria-label="Close">×</button></div>
            <div className="drawer-body">
              <div className="fields">
                <label className="field wide">Project
                  <input type="text" list="proj-list" value={editing.projectId ?? ''} onChange={(e) => setEditing({ ...editing, projectId: e.target.value })} placeholder="Project number" />
                  <datalist id="proj-list">{rows.filter((r) => r.p.status === 'Posted' || r.p.status === 'Created').map((r) => <option key={r.p.id} value={r.p.id}>{r.p.description}</option>)}</datalist>
                </label>
                <label className="field wide">Issue<textarea rows={3} value={editing.issue ?? ''} onChange={(e) => setEditing({ ...editing, issue: e.target.value })} /></label>
                <label className="field wide">Next steps<textarea rows={3} value={editing.nextSteps ?? ''} onChange={(e) => setEditing({ ...editing, nextSteps: e.target.value })} /></label>
                <label className="field">Responsible<input type="text" value={editing.responsible ?? ''} onChange={(e) => setEditing({ ...editing, responsible: e.target.value })} /></label>
                <label className="field">Due date
                  <input type="date" value={editing.dueDate ?? ''} onChange={(e) => setEditing({ ...editing, dueDate: e.target.value || null })} />
                </label>
                <label className="field">Status
                  <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as IssueStatus })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
                </label>
                <p className="faint wide" style={{ margin: 0, fontSize: 12, gridColumn: '1 / -1' }}>
                  With a due date set, an open issue shows as Overdue automatically once that date has passed. Choose Completed to close it.
                </p>
              </div>
            </div>
            <div className="drawer-foot">
              <button className="btn primary" disabled={!(editing.issue ?? '').trim()} onClick={save}>Save</button>
              <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
              {error && <span className="err" role="alert">{error}</span>}
            </div>
          </aside>
        </>
      )}
    </>
  );
}
