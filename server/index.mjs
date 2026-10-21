// Serves the built web app (dist/) and the JSON API. No dependencies beyond Node itself.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store, ValidationError, decodeEditor } from './store.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? '127.0.0.1';
const dist = join(root, 'dist');
const store = new Store(process.env.DATA_DIR ?? join(root, 'data'), [
  join(process.env.DATA_DIR ?? join(root, 'data'), 'seed.json'),
  join(root, 'demo', 'seed.demo.json'),
]);

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((ok, fail) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > 1_000_000) { fail(new ValidationError('request too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { ok(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { fail(new ValidationError('invalid JSON')); } });
    req.on('error', fail);
  });
}

async function api(req, res, url) {
  const by = decodeEditor(req.headers['x-editor']);
  const parts = url.pathname.split('/').filter(Boolean).slice(1).map(decodeURIComponent); // after "api"
  const [kind, id, sub] = parts;
  const m = req.method;
  if (kind === 'state' && m === 'GET') return send(res, 200, store.state());
  if (kind === 'history' && m === 'GET') return send(res, 200, store.history(url.searchParams.get('entity') ?? 'project', url.searchParams.get('id') ?? ''));
  if (kind === 'meta' && m === 'PATCH') return send(res, 200, store.setDataAsOf((await readBody(req)).dataAsOf, by));
  if (kind === 'projects' && !id && m === 'POST') return send(res, 201, store.createProject(await readBody(req), by));
  if (kind === 'projects' && id && !sub && m === 'PATCH') {
    const item = store.patchProject(id, await readBody(req), by);
    return item ? send(res, 200, item) : send(res, 404, { error: 'project not found' });
  }
  if (kind === 'issues' && !id && m === 'POST') return send(res, 201, store.createIssue(await readBody(req), by));
  if (kind === 'issues' && id && m === 'PATCH') {
    const item = store.patchIssue(id, await readBody(req), by);
    return item ? send(res, 200, item) : send(res, 404, { error: 'issue not found' });
  }
  if (kind === 'issues' && id && m === 'DELETE') return store.deleteIssue(id, by) ? send(res, 200, { ok: true }) : send(res, 404, { error: 'issue not found' });
  return send(res, 404, { error: 'not found' });
}

function serveStatic(res, pathname) {
  const rel = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(dist, rel);
  if (!file.startsWith(dist)) return send(res, 403, 'forbidden', 'text/plain');
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(dist, 'index.html');
  if (!existsSync(file)) return send(res, 503, 'Web app not built yet: run "npm run build" (or "npm run dev" for development).', 'text/plain');
  send(res, 200, readFileSync(file), MIME[extname(file)] ?? 'application/octet-stream');
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    return serveStatic(res, url.pathname);
  } catch (e) {
    if (e instanceof ValidationError) return send(res, 400, { error: e.message });
    console.error(e);
    return send(res, 500, { error: 'server error' });
  }
}).listen(port, host, () => console.log(`Project dashboard on http://${host}:${port}  (data: ${store.file})`));
