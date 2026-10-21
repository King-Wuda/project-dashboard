import { useEffect, useMemo, useState } from 'react';
import { api, getEditor } from '../api';
import { useData } from '../store';
import { assess, invoiceLag, unbilled } from '../lib/health';
import { PROJECT_EDIT_FIELDS, projectPatch } from '../lib/patch';
import { dateTime, money, moneyFull } from '../lib/format';
import { STATUSES, type GateState, type Health, type HistoryEntry, type Project } from '../types';
import { GATE_LABEL, GateGlyph, HEALTH_LABEL, HEALTH_VAR, HealthBadge } from './ui';

const GATE_STATES: GateState[] = ['', 'wip', 'done', 'risk', 'deviation', 'na'];
const EMPTY: Project = {
  id: '', customer: '', location: '', description: '', level: '', pm: '', startDate: null, status: 'Created', value: 0,
  rbp: null, poc: 0, invoiced: 0, gates: ['', '', '', '', '', '', ''], handoverSigned: false, comment: '',
};

const editable = (p: Project) => JSON.stringify(PROJECT_EDIT_FIELDS.map((k) => p[k]));

/** Ratios are edited as whole-number percentages. */
const toPct = (v: number | null) => (v == null ? '' : String(Math.round(v * 1000) / 10));
const fromPct = (s: string): number | null => (s.trim() === '' || Number.isNaN(Number(s)) ? null : Number(s) / 100);

export function Drawer({ id, onClose }: { id: string | 'new'; onClose: () => void }) {
  const { rows, state, updateProject, createProject } = useData();
  const isNew = id === 'new';
  const existing = rows.find((r) => r.p.id === id)?.p;
  const [draft, setDraft] = useState<Project>(existing ?? EMPTY);
  const [pocText, setPocText] = useState(toPct((existing ?? EMPTY).poc));
  const [invText, setInvText] = useState(toPct((existing ?? EMPTY).invoiced));
  const [rbpText, setRbpText] = useState(toPct((existing ?? EMPTY).rbp));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [ovHealth, setOvHealth] = useState<Health>('amber');
  const [ovNote, setOvNote] = useState('');
  const gateNames = state.meta.gateNames;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!isNew) api.history('project', id).then(setHistory).catch(() => setHistory([]));
  }, [id, isNew, existing?.updatedAt]);

  const live = useMemo<Project>(() => ({ ...draft, poc: fromPct(pocText), invoiced: fromPct(invText), rbp: fromPct(rbpText) }), [draft, pocText, invText, rbpText]);
  const a = assess({ ...live, healthOverride: existing?.healthOverride }, gateNames);

  const dirty = isNew || (!!existing && editable(live) !== editable(existing));
  const set = <K extends keyof Project>(k: K, v: Project[K]) => setDraft((d) => ({ ...d, [k]: v }));

  async function save() {
    setBusy(true); setError('');
    try {
      if (isNew) {
        await createProject({ id: live.id.trim(), ...projectPatch(live) });
        onClose();
      } else {
        await updateProject(id, projectPatch(live));
      }
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function applyOverride(clear: boolean) {
    setBusy(true); setError('');
    try {
      await updateProject(id, { healthOverride: clear ? null : { health: ovHealth, note: ovNote, by: getEditor() || 'unknown', at: '' } });
      setOvNote('');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const lag = invoiceLag(live);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={isNew ? 'Add project' : `Project ${id}`}>
        <div className="drawer-head">
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 17, marginBottom: 2 }}>{isNew ? 'Add project' : draft.description || draft.id}</h1>
            {!isNew && <div className="muted">{draft.customer}{draft.location && ` · ${draft.location}`} · <span className="num">{draft.id}</span></div>}
          </div>
          {!isNew && <HealthBadge health={a.effective} overridden={a.overridden} />}
          <button className="x" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="drawer-body">
          {!isNew && existing && a.effective !== null && (
            <section>
              <h3>Health</h3>
              <div className="box">
                <div className="row-flex">
                  <span className="muted">Calculated:</span> <HealthBadge health={a.calculated} />
                  {existing.healthOverride && <><span className="muted">PM override:</span> <HealthBadge health={existing.healthOverride.health} overridden /></>}
                </div>
                <ul className="reasons">
                  {a.reasons.length === 0 && <li className="muted">No risk signals: margin, invoicing, gates and comments are all clear.</li>}
                  {a.reasons.map((r, i) => <li key={i}><span className="d" style={{ background: HEALTH_VAR[r.level === 'red' ? 'red' : 'amber'] }} />{r.text}</li>)}
                </ul>
                {existing.healthOverride && (
                  <p className="muted" style={{ margin: '10px 0 0' }}>
                    <b>Override reason:</b> {existing.healthOverride.note} <span className="faint">— {existing.healthOverride.by || 'unknown'}, {dateTime(existing.healthOverride.at)}</span>
                  </p>
                )}
                <div className="stack" style={{ marginTop: 12 }}>
                  <div className="row-flex">
                    <select aria-label="Override health" value={ovHealth} onChange={(e) => setOvHealth(e.target.value as Health)}>
                      {(['green', 'amber', 'red'] as Health[]).map((h) => <option key={h} value={h}>{HEALTH_LABEL[h]}</option>)}
                    </select>
                    <input type="text" placeholder="Reason for override (required)" aria-label="Override reason" value={ovNote} onChange={(e) => setOvNote(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
                    <button className="btn" disabled={busy || !ovNote.trim()} onClick={() => applyOverride(false)}>{existing.healthOverride ? 'Replace override' : 'Override'}</button>
                  </div>
                  {existing.healthOverride && <button className="btn" disabled={busy} onClick={() => applyOverride(true)}>Remove override, use calculated health</button>}
                </div>
              </div>
            </section>
          )}

          <section>
            <h3>Lifecycle gates</h3>
            <div className="gate-list">
              {gateNames.map((n, i) => (
                <div key={n} className="gate-item">
                  <GateGlyph state={draft.gates[i]} />
                  <span>{i + 1}. {n}</span>
                  <select aria-label={n} value={draft.gates[i]} onChange={(e) => set('gates', draft.gates.map((g, j) => (j === i ? (e.target.value as GateState) : g)))}>
                    {GATE_STATES.map((g) => <option key={g} value={g}>{GATE_LABEL[g]}</option>)}
                  </select>
                </div>
              ))}
              <label className="check" style={{ marginTop: 4 }}>
                <input type="checkbox" checked={draft.handoverSigned} onChange={(e) => set('handoverSigned', e.target.checked)} /> Handover signed
              </label>
            </div>
          </section>

          <section>
            <h3>Financials</h3>
            <div className="fields">
              <label className="field">Contract value (ZAR)
                <input type="number" min={0} step={1000} value={draft.value} onChange={(e) => set('value', Number(e.target.value))} />
              </label>
              <label className="field">RBP %
                <input type="number" min={0} max={100} step={0.1} value={rbpText} onChange={(e) => setRbpText(e.target.value)} />
              </label>
              <label className="field">POC % (progress)
                <input type="number" min={0} max={100} step={1} value={pocText} onChange={(e) => setPocText(e.target.value)} />
              </label>
              <label className="field">Invoiced %
                <input type="number" min={0} max={100} step={1} value={invText} onChange={(e) => setInvText(e.target.value)} />
              </label>
            </div>
            {lag > 0 && (
              <p className="muted" style={{ marginBottom: 0 }}>
                {Math.round(lag * 100)} pts of progress not yet invoiced: <b>{money(unbilled(live))}</b> <span className="faint">({moneyFull(unbilled(live))})</span>
              </p>
            )}
          </section>

          <section>
            <h3>Details</h3>
            <div className="fields">
              <label className="field">Project number
                <input type="text" value={draft.id} disabled={!isNew} onChange={(e) => set('id', e.target.value)} placeholder="e.g. 12345-001-1-01" />
              </label>
              <label className="field">Status
                <select value={draft.status} onChange={(e) => set('status', e.target.value as Project['status'])}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
              </label>
              <label className="field wide">Description
                <input type="text" value={draft.description} onChange={(e) => set('description', e.target.value)} />
              </label>
              <label className="field">Customer
                <input type="text" value={draft.customer} onChange={(e) => set('customer', e.target.value)} />
              </label>
              <label className="field">Location
                <input type="text" value={draft.location} onChange={(e) => set('location', e.target.value)} />
              </label>
              <label className="field">PM
                <input type="text" list="pm-list" value={draft.pm} onChange={(e) => set('pm', e.target.value)} />
                <datalist id="pm-list">{[...new Set(rows.map((r) => r.p.pm))].filter(Boolean).sort().map((p) => <option key={p} value={p} />)}</datalist>
              </label>
              <label className="field">Level
                <select value={draft.level} onChange={(e) => set('level', e.target.value)}>
                  {['', 'L1', 'L2', 'L3', 'Survey'].map((l) => <option key={l} value={l}>{l || 'None'}</option>)}
                </select>
              </label>
              <label className="field">Start date
                <input type="date" value={draft.startDate ?? ''} onChange={(e) => set('startDate', e.target.value || null)} />
              </label>
            </div>
          </section>

          <section>
            <h3>Comment</h3>
            <textarea rows={4} value={draft.comment} onChange={(e) => set('comment', e.target.value)} aria-label="Comment" />
          </section>

          {!isNew && (
            <section>
              <h3>History</h3>
              {history.length === 0 ? <div className="faint">No changes recorded since the dashboard was set up.</div> : (
                <div className="hist">
                  {history.map((h, i) => (
                    <div key={i}>
                      <b>{h.by || 'unknown'}</b> <span className="faint">{dateTime(h.at)}</span>
                      <div>{h.action === 'create' ? 'Created the project' : Object.entries(h.changes).map(([k, [from, to]]) => (
                        <div key={k}>{k === 'healthOverride' ? 'Health override' : k}: <span className="faint">{short(from)}</span> → {short(to)}</div>
                      ))}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        <div className="drawer-foot">
          <button className="btn primary" disabled={busy || !dirty || (isNew && !draft.id.trim())} onClick={save}>{isNew ? 'Add project' : 'Save changes'}</button>
          {!isNew && dirty && <button className="btn" onClick={() => { if (existing) { setDraft(existing); setPocText(toPct(existing.poc)); setInvText(toPct(existing.invoiced)); setRbpText(toPct(existing.rbp)); } }}>Discard</button>}
          {error && <span className="err" role="alert">{error}</span>}
          {!getEditor() && <span className="faint" style={{ marginLeft: 'auto' }}>Tip: enter your name (top right) so changes are attributed.</span>}
        </div>
      </aside>
    </>
  );
}

function short(v: unknown): string {
  if (v == null || v === '') return '–';
  if (typeof v === 'object') {
    const o = v as { health?: string; note?: string };
    return o.health ? `${o.health}: ${o.note}` : JSON.stringify(v);
  }
  const s = String(v);
  return s.length > 70 ? `${s.slice(0, 70)}…` : s;
}
