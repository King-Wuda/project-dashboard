// JSON-file store: one document, atomic writes, append-only change history.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const PROJECT_FIELDS = {
  customer: 'string', location: 'string', description: 'string', level: 'string', pm: 'string',
  startDate: 'date', status: 'string', value: 'number', rbp: 'ratio', poc: 'ratio', invoiced: 'ratio',
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

export class Store {
  constructor(dir, seedPaths) {
    this.file = join(dir, 'store.json');
    mkdirSync(dir, { recursive: true });
    if (existsSync(this.file)) {
      this.doc = JSON.parse(readFileSync(this.file, 'utf8'));
    } else {
      const seed = seedPaths.find(existsSync);
      if (!seed) throw new Error(`No seed data found (looked in: ${seedPaths.join(', ')})`);
      this.doc = JSON.parse(readFileSync(seed, 'utf8'));
      this.doc.meta.seededFrom = seed;
      this.doc.history = [];
      this.save();
    }
    this.doc.history ??= [];
  }

  save() {
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.doc));
    renameSync(tmp, this.file);
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
