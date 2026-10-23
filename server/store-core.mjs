// Data rules shared by the Node server and the standalone HTML build: validation, edits, change history.
// Pure JavaScript with no Node imports, so it also runs in the browser. Persistence is injected.

const PROJECT_FIELDS = {
  customer: 'string', location: 'string', description: 'string', level: 'string', pm: 'string',
  startDate: 'date', status: 'string', value: 'number', rbp: 'margin', poc: 'ratio', invoiced: 'ratio',
  gates: 'gates', handoverSigned: 'boolean', comment: 'string', healthOverride: 'override',
};
const ISSUE_FIELDS = {
  projectId: 'string', customer: 'string', location: 'string', description: 'string', pm: 'string',
  issue: 'string', nextSteps: 'string', responsible: 'string', status: 'issueStatus', dueDate: 'date',
};
const STATUSES = ['Created', 'Posted', 'Administrative closed', 'Eliminated'];
const GATE_STATES = ['', 'done', 'wip', 'risk', 'deviation', 'na'];
const ISSUE_STATUSES = ['WIP', 'Completed', 'Overdue'];
const MAX_TEXT = 4000;

export class ValidationError extends Error {}

/** The X-Editor header is URL-encoded by the browser ("Gerhardus%20Uys"). */
export function decodeEditor(header) {
  const raw = String(header ?? '');
  let name;
  try { name = decodeURIComponent(raw); } catch { name = raw; }
  return name.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 80);
}

function coerce(kind, v, field) {
  const bad = (m) => { throw new ValidationError(`${field}: ${m}`); };
  switch (kind) {
    case 'string':
      if (typeof v !== 'string') bad('must be text');
      if (v.length > MAX_TEXT) bad('too long');
      if (field === 'status' && !STATUSES.includes(v)) bad(`must be one of ${STATUSES.join(', ')}`);
      return v.trim();
    case 'issueStatus':
      if (!ISSUE_STATUSES.includes(v)) bad(`must be one of ${ISSUE_STATUSES.join(', ')}`);
      return v;
    case 'number':
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) bad('must be a number >= 0');
      return v;
    case 'ratio':
      if (v === null) return null;
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 2) bad('must be a fraction between 0 and 2');
      return v;
    case 'margin': // a margin can be negative on a loss-making project
      if (v === null) return null;
      if (typeof v !== 'number' || !Number.isFinite(v) || v < -2 || v > 2) bad('must be a fraction between -2 and 2');
      return v;
    case 'boolean':
      if (typeof v !== 'boolean') bad('must be true or false');
      return v;
    case 'date':
      if (v === null || v === '') return null;
      if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) bad('must be YYYY-MM-DD');
      return v;
    case 'gates':
      if (!Array.isArray(v) || v.length !== 7 || v.some((g) => !GATE_STATES.includes(g))) bad('must be 7 gate states');
      return v;
    case 'override':
      if (v === null) return null;
      if (typeof v !== 'object' || !['green', 'amber', 'red'].includes(v.health) || typeof v.note !== 'string' || !v.note.trim())
        bad('needs a health (green/amber/red) and a reason');
      return { health: v.health, note: v.note.trim().slice(0, MAX_TEXT), by: String(v.by ?? '').slice(0, 80), at: new Date().toISOString() };
  }
}

function pick(body, spec) {
  const out = {};
  for (const [k, v] of Object.entries(body ?? {})) {
    if (!(k in spec)) throw new ValidationError(`unknown field "${k}"`);
    out[k] = coerce(spec[k], v, k);
  }
  return out;
}

export class StoreCore {
  /** @param doc the whole data document; @param persist called with the document after every change */
  constructor(doc, persist) {
    this.doc = doc;
    this.persist = persist;
    this.doc.history ??= [];
  }

  save() {
    this.persist?.(this.doc);
  }

  log(by, entity, id, action, changes) {
    this.doc.history.push({ at: new Date().toISOString(), by: String(by || 'unknown').slice(0, 80), entity, id, action, changes });
  }

  state() {
    const { history, ...rest } = this.doc;
    return rest;
  }

  history(entity, id) {
    return this.doc.history.filter((h) => h.entity === entity && h.id === id).reverse().slice(0, 200);
  }

  patch(list, id, body, spec, entity, by) {
    const item = this.doc[list].find((x) => x.id === id);
    if (!item) return null;
    const changes = {};
    for (const [k, v] of Object.entries(pick(body, spec))) {
      if (JSON.stringify(item[k] ?? null) !== JSON.stringify(v)) { changes[k] = [item[k] ?? null, v]; item[k] = v; }
    }
    if (Object.keys(changes).length) { item.updatedAt = new Date().toISOString(); this.log(by, entity, id, 'update', changes); this.save(); }
    return item;
  }

  patchProject(id, body, by) { return this.patch('projects', id, body, PROJECT_FIELDS, 'project', by); }
  patchIssue(id, body, by) { return this.patch('issues', id, body, ISSUE_FIELDS, 'issue', by); }

  createProject(body, by) {
    const id = String(body?.id ?? '').trim();
    if (!/^[\w.\-/ ]{3,40}$/.test(id)) throw new ValidationError('id: project number is required (letters, digits, - . /)');
    if (this.doc.projects.some((p) => p.id === id)) throw new ValidationError('id: project number already exists');
    const { id: _ignored, ...rest } = body;
    const item = {
      id, customer: '', location: '', description: '', level: '', pm: '', startDate: null, status: 'Created', value: 0,
      rbp: null, poc: 0, invoiced: 0, gates: ['', '', '', '', '', '', ''], handoverSigned: false, comment: '',
      ...pick(rest, PROJECT_FIELDS), updatedAt: new Date().toISOString(),
    };
    this.doc.projects.push(item);
    this.log(by, 'project', id, 'create', {});
    this.save();
    return item;
  }

  createIssue(body, by) {
    const n = this.doc.issues.reduce((m, i) => Math.max(m, Number(String(i.id).replace(/\D/g, '')) || 0), 0) + 1;
    const item = {
      id: `I-${n}`, projectId: '', customer: '', location: '', description: '', pm: '', issue: '', nextSteps: '',
      responsible: '', status: 'WIP', dueDate: null, ...pick(body, ISSUE_FIELDS), updatedAt: new Date().toISOString(),
    };
    if (!item.issue) throw new ValidationError('issue: describe the issue');
    this.doc.issues.push(item);
    this.log(by, 'issue', item.id, 'create', {});
    this.save();
    return item;
  }

  deleteIssue(id, by) {
    const i = this.doc.issues.findIndex((x) => x.id === id);
    if (i < 0) return false;
    this.doc.issues.splice(i, 1);
    this.log(by, 'issue', id, 'delete', {});
    this.save();
    return true;
  }

  setDataAsOf(date, by) {
    const v = coerce('date', date, 'dataAsOf');
    if (!v) throw new ValidationError('dataAsOf: required');
    this.log(by, 'meta', 'dataAsOf', 'update', { dataAsOf: [this.doc.meta.dataAsOf, v] });
    this.doc.meta.dataAsOf = v;
    this.save();
    return this.doc.meta;
  }
}

const DEFAULT_PROJECT = {
  customer: '', location: '', description: '', level: '', pm: '', startDate: null, status: 'Created', value: 0, rbp: null, poc: 0,
  invoiced: 0, gates: ['', '', '', '', '', '', ''], handoverSigned: false, comment: '',
};
const DEFAULT_ISSUE = { projectId: '', customer: '', location: '', description: '', pm: '', issue: '', nextSteps: '', responsible: '', status: 'WIP', dueDate: null };

/**
 * Checks and cleans a whole data document (a backup file or embedded seed) before it is used.
 * Unknown fields are dropped, known ones are type-checked, missing ones get defaults.
 */
export function validateDoc(raw) {
  const bad = (m) => { throw new ValidationError(`Not a valid dashboard data file: ${m}`); };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) bad('expected an object');
  const { meta, projects, resources, issues, history } = raw;
  if (!meta || typeof meta !== 'object') bad('missing "meta"');
  if (!Array.isArray(meta.gateNames) || meta.gateNames.length !== 7 || meta.gateNames.some((g) => typeof g !== 'string')) bad('meta.gateNames must list 7 gates');
  for (const [name, list] of [['projects', projects], ['resources', resources], ['issues', issues]]) {
    if (!Array.isArray(list)) bad(`"${name}" must be a list`);
    if (list.some((x) => !x || typeof x !== 'object' || Array.isArray(x))) bad(`"${name}" contains an item that is not an object`);
  }

  const known = (o, spec) => Object.fromEntries(Object.entries(o).filter(([k]) => k in spec));
  const ids = new Set();
  const cleanProjects = projects.map((p, i) => {
    if (typeof p.id !== 'string' || !p.id.trim()) bad(`project ${i + 1} has no project number`);
    if (ids.has(p.id)) bad(`project number ${p.id} appears twice`);
    ids.add(p.id);
    const { healthOverride, ...rest } = known(p, PROJECT_FIELDS);
    const out = { id: p.id, ...DEFAULT_PROJECT, ...pick(rest, PROJECT_FIELDS) };
    if (healthOverride) {
      const o = coerce('override', healthOverride, 'healthOverride');
      out.healthOverride = { ...o, by: String(healthOverride.by ?? '').slice(0, 80), at: typeof healthOverride.at === 'string' ? healthOverride.at : o.at };
    }
    if (typeof p.updatedAt === 'string') out.updatedAt = p.updatedAt;
    return out;
  });
  const cleanIssues = issues.map((x, i) => {
    if (typeof x.id !== 'string' || !x.id) bad(`issue ${i + 1} has no id`);
    return { id: x.id, ...DEFAULT_ISSUE, ...pick(known(x, ISSUE_FIELDS), ISSUE_FIELDS), ...(typeof x.updatedAt === 'string' ? { updatedAt: x.updatedAt } : {}) };
  });
  const cleanHistory = Array.isArray(history)
    ? history.filter((h) => h && typeof h === 'object' && typeof h.at === 'string' && typeof h.entity === 'string' && typeof h.id === 'string')
        .map((h) => ({ at: h.at, by: String(h.by ?? '').slice(0, 80), entity: h.entity, id: h.id, action: String(h.action ?? ''), changes: h.changes && typeof h.changes === 'object' ? h.changes : {} }))
    : [];
  return {
    meta: { title: String(meta.title ?? 'Project Dashboard').slice(0, 120), dataAsOf: typeof meta.dataAsOf === 'string' ? meta.dataAsOf : null, importedFrom: meta.importedFrom ? String(meta.importedFrom).slice(0, 200) : undefined, gateNames: meta.gateNames },
    projects: cleanProjects,
    resources,
    issues: cleanIssues,
    history: cleanHistory,
  };
}
