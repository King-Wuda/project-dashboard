import { useEffect, useState } from 'react';
import { getEditor, setEditor } from './api';
import { Drawer } from './components/Drawer';
import { Issues } from './components/Issues';
import { Overview, type Nav } from './components/Overview';
import { Projects } from './components/Projects';
import { Resources } from './components/Resources';
import { TipProvider } from './components/ui';
import { isArchived } from './lib/health';
import { issueView, todayIso } from './lib/issues';
import { date } from './lib/format';
import { useData } from './store';

const TABS: { key: Nav['tab']; label: string }[] = [
  { key: 'overview', label: 'Overview' }, { key: 'projects', label: 'Projects' }, { key: 'issues', label: 'Issues' }, { key: 'resources', label: 'Resources' },
];

function parseHash(): Nav {
  const [path, query = ''] = window.location.hash.replace(/^#\/?/, '').split('?');
  const tab = TABS.find((t) => t.key === path)?.key ?? 'overview';
  return { tab, params: Object.fromEntries(new URLSearchParams(query)) };
}

export function App() {
  const { state, rows, setDataAsOf } = useData();
  const [nav, setNav] = useState<Nav>(parseHash);
  const [open, setOpen] = useState<string | null>(null);
  const [name, setName] = useState(getEditor());
  const [theme, setTheme] = useState<string>(() => { try { return localStorage.getItem('theme') ?? 'auto'; } catch { return 'auto'; } });

  useEffect(() => {
    const on = () => setNav(parseHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch { /* storage unavailable */ }
  }, [theme]);
  useEffect(() => { document.title = state.meta.title; }, [state.meta.title]);

  const go = (n: Nav) => {
    const q = new URLSearchParams(n.params ?? {}).toString();
    window.location.hash = `/${n.tab}${q ? `?${q}` : ''}`;
  };
  const openCount = rows.filter((r) => !isArchived(r.p)).length;

  return (
    <TipProvider>
      <header className="topbar">
        <div className="topbar-in">
          <div className="brand">{state.meta.title}</div>
          <nav className="tabs" aria-label="Sections">
            {TABS.map((t) => (
              <button key={t.key} className="tab" aria-current={nav.tab === t.key ? 'page' : undefined} onClick={() => go({ tab: t.key })}>
                {t.label}
                {t.key === 'projects' && <span className="count">{openCount}</span>}
                {t.key === 'issues' && <span className="count">{state.issues.filter((i) => issueView(i, todayIso()).status !== 'Completed').length}</span>}
              </button>
            ))}
          </nav>
          <div className="top-right">
            <label>Data as of{' '}
              <input type="date" aria-label="Data as of" value={state.meta.dataAsOf ?? ''} onChange={(e) => e.target.value && setDataAsOf(e.target.value)} title={date(state.meta.dataAsOf)} />
            </label>
            <input type="text" placeholder="Your name" aria-label="Your name (recorded with changes)" value={name} onChange={(e) => { setName(e.target.value); setEditor(e.target.value); }} />
            <button className="btn" onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'auto' : 'dark')} aria-label={`Theme: ${theme}`}>
              {theme === 'dark' ? 'Dark' : theme === 'light' ? 'Light' : 'Auto'}
            </button>
          </div>
        </div>
      </header>
      <main>
        {nav.tab === 'overview' && <Overview onOpen={setOpen} onNav={go} />}
        {nav.tab === 'projects' && <Projects params={nav.params ?? {}} onOpen={setOpen} onNew={() => setOpen('new')} onParams={(p) => go({ tab: 'projects', params: p })} />}
        {nav.tab === 'issues' && <Issues onOpenProject={setOpen} />}
        {nav.tab === 'resources' && <Resources onOpenProject={setOpen} />}
      </main>
      {open && <Drawer key={open} id={open} onClose={() => setOpen(null)} />}
    </TipProvider>
  );
}
