// Data layer for the standalone HTML file: the seed data is embedded in the page, edits are kept in this browser's
// localStorage, and the same validation and history rules as the server run here (shared store-core).
import { StoreCore, validateDoc } from '../../server/store-core.mjs';
import type { Api } from './apiTypes';
import { EDITOR } from './editor';
import type { AppState } from './types';

const SEED_ELEMENT = 'seed-data';
let core: StoreCore | null = null;
let seedText = '';
let key = '';
let storageOk = true;

/** Small stable hash, so a rebuilt file with the same data keeps the edits already saved in the browser. */
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function readSeed() {
  const el = document.getElementById(SEED_ELEMENT);
  if (!el?.textContent) throw new Error('This file has no data embedded in it. Rebuild it with "npm run build:html".');
  seedText = el.textContent;
  const raw = JSON.parse(seedText) as { meta?: { builtAt?: string }; projects?: unknown; issues?: unknown; resources?: unknown };
  key = `hrs-dashboard:v1:${hash(JSON.stringify([raw.projects, raw.issues, raw.resources]))}`;
  return { doc: validateDoc(raw), builtAt: raw.meta?.builtAt ?? null };
}

function persist(doc: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(doc));
    storageOk = true;
  } catch {
    storageOk = false;
  }
}

function init(): StoreCore {
  if (core) return core;
  const seed = readSeed();
  let doc = seed.doc;
  try {
    const saved = localStorage.getItem(key);
    if (saved) doc = validateDoc(JSON.parse(saved));
  } catch {
    // Unreadable or blocked storage: fall back to the embedded data.
  }
  doc.meta.builtAt = seed.builtAt ?? undefined;
  core = new StoreCore(doc, (d: { meta: { builtAt?: string } }) => persist(d));
  // Check up front whether the browser lets us save, so the banner can warn straight away.
  persist(core.doc);
  return core;
}

const done = <T>(f: () => T): Promise<T> => {
  try {
    return Promise.resolve(f());
  } catch (e) {
    return Promise.reject(e);
  }
};

export const localApi: Api = {
  state: () => done(() => init().state() as AppState),
  patchProject: (id, patch) => done(() => {
    const p = init().patchProject(id, patch, EDITOR);
    if (!p) throw new Error('project not found');
    return p;
  }),
  createProject: (p) => done(() => init().createProject(p, EDITOR)),
  history: (entity, id) => done(() => init().history(entity, id)),
  createIssue: (i) => done(() => init().createIssue(i, EDITOR)),
  patchIssue: (id, patch) => done(() => {
    const i = init().patchIssue(id, patch, EDITOR);
    if (!i) throw new Error('issue not found');
    return i;
  }),
  deleteIssue: (id) => done(() => {
    if (!init().deleteIssue(id, EDITOR)) throw new Error('issue not found');
    return { ok: true as const };
  }),
  setDataAsOf: (d) => done(() => init().setDataAsOf(d, EDITOR)),
};

/** Backup, restore and reset for the standalone file. */
export const standalone = {
  /** False if the browser is blocking localStorage, in which case changes last only until the tab is closed. */
  canSave: () => storageOk,
  builtAt: () => (core?.doc.meta.builtAt as string | undefined) ?? null,
  backupText: () => JSON.stringify(init().doc, null, 1),
  /** Replace all data with a backup file's contents, then the caller reloads. */
  restore(text: string) {
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { throw new Error('That file is not valid JSON.'); }
    const doc = validateDoc(raw);
    init();
    persist(doc);
    if (!storageOk) throw new Error('This browser is blocking local storage, so restored data would be lost. Open the file in Chrome or Edge instead.');
  },
  /** Throw away this browser's edits and go back to the data embedded in the file. */
  reset() {
    init();
    try { localStorage.removeItem(key); } catch { /* nothing to remove */ }
    core = null;
  },
};
