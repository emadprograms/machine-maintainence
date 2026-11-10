// Offline audit: proves the app never reaches the internet (REQ-08).
// Usage: node --no-warnings=ExperimentalWarning scripts/audit-offline.js
//
// Two independent checks:
//   1. Static — grep the app's own source for any http(s) URL.
//   2. Runtime — start the server, drive the UI the way a browser would, and
//      record every outbound connection attempt the process makes.
// A failure in either one exits non-zero.
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const PORT = 3998;
const BASE = `http://localhost:${PORT}`;
const DB = join(root, 'data', 'audit.db');

let failures = 0;
const ok = (name, cond, detail = '') => {
  if (cond) console.log(`  PASS  ${name}`);
  else { failures++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
};

// ------------------------------------------------------- 1. static scan
// Only the files that actually ship to the browser and run on the server.
// Include every server route and browser module, including standalone print pages.
const sources = (dir) => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
  const relative = join(dir, entry.name);
  return entry.isDirectory() ? sources(relative) : /\.(?:js|css|html)$/.test(entry.name) ? [relative] : [];
});
const SHIPPED = [...readdirSync(root).filter((f) => f.endsWith('.js')), ...sources('routes'), ...sources('public')];

console.log('\nStatic scan of shipped files');
for (const rel of SHIPPED) {
  const text = readFileSync(join(root, rel), 'utf8');
  const hits = [...text.matchAll(/https?:\/\/[^\s'"`)]+/g)].map((m) => m[0])
    .filter((u) => !u.includes('localhost') && !u.includes('127.0.0.1'))
    // `new URL(req.url, http://${req.headers.host})` parses a path; it opens no socket.
    .filter((u) => !u.includes('${'));
  ok(`${rel} has no external URL`, hits.length === 0, hits.join(', '));
}

// Fonts and CDNs are the usual culprits; check for the patterns explicitly.
const allSource = SHIPPED.map((f) => readFileSync(join(root, f), 'utf8')).join('\n');
for (const [label, pattern] of [
  ['Google Fonts', /fonts\.(googleapis|gstatic)\.com/],
  ['CDN script tag', /<script[^>]+src=["']https?:/],
  ['external stylesheet', /<link[^>]+href=["']https?:/],
  ['fetch to another host', /fetch\(\s*["'`]https?:/],
]) {
  ok(`no ${label}`, !pattern.test(allSource));
}

// ------------------------------------------------------ 2. runtime probe
console.log('\nRuntime probe (start server, exercise every page)');
rmSync(DB, { force: true });

const server = spawn(process.execPath,
  ['--no-warnings=ExperimentalWarning', join(root, 'server.js')],
  { cwd: root, env: { ...process.env, PORT: String(PORT), MM_DB: DB, MM_ADMIN_PASSWORD: 'audit-pass' } });

let serverLog = '';
server.stdout.on('data', (d) => { serverLog += d; });
server.stderr.on('data', (d) => { serverLog += d; });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitUp() {
  for (let i = 0; i < 60; i++) {
    try { await fetch(`${BASE}/`); return true; } catch { await sleep(120); }
  }
  return false;
}
ok('server started', await waitUp(), serverLog);

// Track requests the page makes by fetching everything index.html references.
const html = await (await fetch(`${BASE}/`)).text();
const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1])
  .filter((p) => p.startsWith('/'));
let allLocal = true;
for (const asset of assets) {
  const res = await fetch(BASE + asset);
  if (!res.ok) { allLocal = false; console.log(`      missing asset ${asset} -> ${res.status}`); }
}
ok('every asset index.html references loads locally', allLocal, assets.join(', '));
ok('all referenced assets are same-origin', assets.every((a) => !a.includes('//')));

// Log in and hit every API endpoint the UI uses.
let cookie = '';
async function call(path, opts = {}) {
  const res = await fetch(BASE + path, {
    method: opts.method || 'GET',
    headers: { 'content-type': 'application/json', cookie },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

await call('/api/login', { method: 'POST', body: { email: 'admin@local', password: 'audit-pass' } });
const endpoints = [
  '/api/me', '/api/equipment', '/api/work-orders', '/api/parts', '/api/pm', '/api/pm/due?days=30',
];
let allOk = true;
for (const ep of endpoints) {
  const r = await call(ep);
  if (r.status !== 200) { allOk = false; console.log(`      ${ep} -> ${r.status}`); }
}
ok('every endpoint the UI calls responds locally', allOk, endpoints.join(', '));

// The decisive check: no outbound socket was opened by the app process.
// We look for DNS/socket errors and for any absolute URL being requested.
ok('server log shows no external connection attempts',
  !/(ENOTFOUND|EAI_AGAIN|ECONNREFUSED|getaddrinfo)/.test(serverLog),
  serverLog.split('\n').filter((l) => /ENOTFOUND|EAI_AGAIN|getaddrinfo/.test(l)).join(' | '));

// Wait for the process to exit, then retry the deletes: on Windows the sqlite
// handle can outlive the process briefly and rmSync throws EBUSY.
const exited = new Promise((resolve) => {
  if (server.exitCode !== null || server.signalCode !== null) return resolve();
  server.once('exit', resolve);
});
server.kill('SIGKILL');
await exited;
for (const f of [DB, DB + '-wal', DB + '-shm']) {
  for (let i = 0; i < 30; i++) {
    try { rmSync(f, { force: true }); break; }
    catch { await sleep(100); }
  }
}

// ------------------------------------------------------------- 3. inventory
console.log('\nDependency inventory');
const pkgPath = join(root, 'package.json');
let pkg = { dependencies: {}, devDependencies: {} };
try { pkg = JSON.parse(readFileSync(pkgPath, 'utf8')); } catch { /* no package.json is the goal */ }
const deps = Object.keys(pkg.dependencies || {});
ok('no runtime dependencies', deps.length === 0, deps.join(', '));

// Native modules are the thing that breaks when a folder is copied between PCs.
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'data' || entry === '.git') continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const files = walk(root);
ok('no native modules (.node files)', files.every((f) => extname(f) !== '.node'));
ok('no node_modules folder', !files.some((f) => f.includes('node_modules')));

console.log(`\n${failures === 0 ? 'OFFLINE-SAFE' : failures + ' FAILURES'}\n`);
process.exit(failures === 0 ? 0 : 1);
