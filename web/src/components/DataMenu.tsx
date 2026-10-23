import { useEffect, useRef, useState } from 'react';
import { standalone } from '../localApi';

/** Backup / restore / reset for the standalone HTML file. */
export function DataMenu() {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  function exportBackup() {
    const url = URL.createObjectURL(new Blob([standalone.backupText()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  async function restore(f: File | undefined) {
    if (!f) return;
    try {
      standalone.restore(await f.text());
      window.location.reload();
    } catch (e) { setMsg((e as Error).message); }
  }

  function reset() {
    if (!window.confirm('Discard every change made in this browser and go back to the data this file shipped with?')) return;
    standalone.reset();
    window.location.reload();
  }

  return (
    <div className="menu-wrap" ref={box}>
      <button className="btn" aria-haspopup="menu" aria-expanded={open} onClick={() => { setOpen(!open); setMsg(''); }}>Data ▾</button>
      {open && (
        <div className="menu" role="menu">
          <button role="menuitem" onClick={exportBackup}>Export backup (.json)</button>
          <button role="menuitem" onClick={() => file.current?.click()}>Restore from backup…</button>
          <button role="menuitem" className="danger" onClick={reset}>Reset to original data</button>
          {msg && <div className="err" role="alert" style={{ padding: '6px 10px' }}>{msg}</div>}
          <div className="faint" style={{ padding: '6px 10px', fontSize: 12 }}>The backup contains all project data. Share it only with people who should see it.</div>
        </div>
      )}
      <input ref={file} type="file" accept=".json,application/json" hidden onChange={(e) => { void restore(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}
