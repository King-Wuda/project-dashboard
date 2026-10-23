// Builds ONE self-contained HTML file (no server, no install) with the data embedded.
//
//   npm run build:html                              demo data   -> dist-html/dashboard-demo.html
//   npm run build:html -- --data data/seed.json     real data   -> dist-html/dashboard-private.html
//
// Options: --data <seed.json|store.json>   data to embed (default: demo/seed.demo.json)
//          --out <file>                    output path
// A build made with --data contains real project data: share it only with the people who may see it.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { validateDoc } from '../server/store-core.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

const dataPath = resolve(root, opt('--data') ?? 'demo/seed.demo.json');
const isDemo = !opt('--data');
const out = resolve(root, opt('--out') ?? (isDemo ? 'dist-html/dashboard-demo.html' : 'dist-html/dashboard-private.html'));

// Check the data before embedding it, so a bad file fails here and not in someone's browser.
const doc = validateDoc(JSON.parse(readFileSync(dataPath, 'utf8')));
doc.meta.builtAt = new Date().toISOString();
doc.history = [];

const tmpDir = join(root, 'dist-html', '.build');
await build({ root: join(root, 'web'), configFile: join(root, 'vite.standalone.config.ts'), logLevel: 'warn', build: { outDir: tmpDir, emptyOutDir: true } });

let html = readFileSync(join(tmpDir, 'index.html'), 'utf8');
const asset = (href) => readFileSync(join(tmpDir, href.replace(/^\.?\//, '')), 'utf8');
// Replacer functions (not strings) so "$&"-style sequences in the bundle are never interpreted.
html = html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_, href) => `<style>\n${asset(href)}\n</style>`);
html = html.replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g, (_, src) => `<script type="module">\n${asset(src).replace(/<\/script/gi, '<\\/script')}\n</script>`);
if (/(?:src|href)="\.?\/?assets\//.test(html)) throw new Error('Build left an external asset reference; the file would not be self-contained.');

// Keep the JSON from ending the script element early; also escape the two characters older parsers treat as line breaks.
const seed = JSON.stringify(doc).replace(/</g, '\\u003c').split(String.fromCharCode(0x2028)).join('\\u2028').split(String.fromCharCode(0x2029)).join('\\u2029');
html = html.replace('</body>', () => `<script id="seed-data" type="application/json">${seed}</script>\n</body>`);
html = html.replace(/<title>[^<]*<\/title>/, () => `<title>${doc.meta.title.replace(/[<&>]/g, '')}</title>`);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
rmSync(tmpDir, { recursive: true, force: true });
console.log(`${isDemo ? 'Demo' : 'PRIVATE (contains real data)'} build: ${out}  (${(html.length / 1024).toFixed(0)} KB, ${doc.projects.length} projects)`);
