// Smoke test: proves the Phase 1-5 success criteria in .planning/ROADMAP.md.
// Usage: node --no-warnings=ExperimentalWarning scripts/smoke-test.js
// It starts its own server on a spare port with a throwaway database.
import { spawn } from 'node:child_process';
import { rmSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const PORT = 3999;
const DB = join(root, 'data', 'smoke.db');
const BASE = `http://localhost:${PORT}`;

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
};

// ---------------------------------------------------------------- helpers
function start(env = {}) {
  const child = spawn(process.execPath,
    ['--no-warnings=ExperimentalWarning', join(root, 'server.js')],
    { cwd: root, env: { ...process.env, PORT: String(PORT), MM_DB: DB, ...env } });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  return { child, log: () => log };
}

async function waitForServer(timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { await fetch(`${BASE}/api/nope`); return true; } catch { await sleep(120); }
  }
  return false;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeClient() {
  let cookie = '';
  return async (path, { method = 'GET', body } = {}) => {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'content-type': 'application/json', cookie },
      body: body == null ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return { status: res.status, data: await res.json().catch(() => ({})) };
  };
}

// ---------------------------------------------------------------- the test
console.log('\n--- starting with a fresh database ---');
rmSync(DB, { force: true });
let srv = start({ MM_ADMIN_PASSWORD: 'smoke-test-password' });
ok('server starts', await waitForServer(), srv.log());
await sleep(300);

const c = makeClient();

console.log('\nPhase 2 — auth');
ok('unauthenticated read is rejected', (await c('/api/equipment')).status === 401);
ok('unauthenticated write is rejected',
  (await c('/api/equipment', { method: 'POST', body: { name: 'x' } })).status === 401);
ok('wrong password is rejected',
  (await c('/api/login', { method: 'POST', body: { email: 'admin@local', password: 'wrong' } })).status === 401);

const login = await c('/api/login', {
  method: 'POST', body: { email: 'admin@local', password: 'smoke-test-password' },
});
ok('correct password logs in', login.status === 200 && login.data.role === 'admin');
ok('session cookie works for reads', (await c('/api/equipment')).status === 200);

console.log('\nPhase 3 — machines and work orders');
const m1 = await c('/api/equipment', { method: 'POST', body: { name: 'Press', asset_tag: 'P-1' } });
const m2 = await c('/api/equipment', { method: 'POST', body: { name: 'Compressor' } });
ok('machine created', m1.status === 201 && m1.data.id > 0);
ok('second machine created', m2.status === 201);
ok('machine appears in list', (await c('/api/equipment')).data.length === 2);
ok('machine can be edited',
  (await c(`/api/equipment/${m1.data.id}`, { method: 'PUT', body: { location: 'Bay B' } }))
    .data.location === 'Bay B');

const wo = await c('/api/work-orders', {
  method: 'POST', body: { equipment_id: m1.data.id, title: 'Oil leak', priority: 'high' },
});
ok('work order created', wo.status === 201 && wo.data.status === 'open');
ok('bogus machine id gives a readable 400',
  (await c('/api/work-orders', { method: 'POST', body: { equipment_id: 999, title: 'ghost' } }))
    .status === 400);
ok('status advances open -> in_progress',
  (await c(`/api/work-orders/${wo.data.id}`, { method: 'PATCH', body: { status: 'in_progress' } }))
    .data.status === 'in_progress');
const done = await c(`/api/work-orders/${wo.data.id}`, { method: 'PATCH', body: { status: 'done' } });
ok('done sets closed_at', done.data.status === 'done' && !!done.data.closed_at);
ok('invalid status is rejected with a message',
  (await c(`/api/work-orders/${wo.data.id}`, { method: 'PATCH', body: { status: 'nonsense' } }))
    .status === 400);

console.log('\nPhase 4 — spare parts');
const part = await c('/api/parts', { method: 'POST', body: { name: 'Seal kit', qty: 5, unit_price: 42.5 } });
ok('part created with stock', part.status === 201 && part.data.qty === 5);
await c(`/api/work-orders/${wo.data.id}/parts`, { method: 'POST', body: { part_id: part.data.id, qty: 2 } });
let stock = (await c('/api/parts')).data.find((p) => p.id === part.data.id).qty;
ok('using 2 of 5 leaves 3', stock === 3, `stock=${stock}`);
const over = await c(`/api/work-orders/${wo.data.id}/parts`,
  { method: 'POST', body: { part_id: part.data.id, qty: 99 } });
ok('over-consumption refused', over.status === 400, JSON.stringify(over.data));
stock = (await c('/api/parts')).data.find((p) => p.id === part.data.id).qty;
ok('stock unchanged after refusal (transaction rolled back)', stock === 3, `stock=${stock}`);
await c(`/api/work-orders/${wo.data.id}/parts`, { method: 'POST', body: { part_id: part.data.id, qty: 1 } });
const lines = (await c(`/api/work-orders/${wo.data.id}/parts`)).data;
ok('same part twice merges into one line', lines.length === 1 && lines[0].qty === 3,
  JSON.stringify(lines));

console.log('\nPhase 2b — user management');
const users0 = await c('/api/users');
ok('admin sees the user list', users0.status === 200 && users0.data.length === 1);
ok('user list never includes password hashes',
  !JSON.stringify(users0.data).includes('scrypt'));
const created = await c('/api/users', { method: 'POST', body: {
  name: 'Tech One', email: 'tech@local', password: 'tech-password', role: 'tech',
} });
ok('admin can create a technician', created.status === 201 && created.data.role === 'tech');
ok('short password rejected',
  (await c('/api/users', { method: 'POST', body: {
    name: 'X', email: 'x@local', password: 'short', role: 'tech' } })).status === 400);
ok('email with no host part rejected',
  (await c('/api/users', { method: 'POST', body: {
    name: 'X', email: 'notanemail', password: 'longenough1', role: 'tech' } })).status === 400);
ok('duplicate email rejected',
  (await c('/api/users', { method: 'POST', body: {
    name: 'Dup', email: 'tech@local', password: 'longenough1', role: 'tech' } })).status === 400);

// A technician must not be able to create users or delete machines.
const tech = makeClient();
const techLogin = await tech('/api/login', { method: 'POST', body: {
  email: 'tech@local', password: 'tech-password' } });
ok('created user can log in', techLogin.status === 200 && techLogin.data.role === 'tech');
ok('technician cannot create users',
  (await tech('/api/users', { method: 'POST', body: {
    name: 'Sneaky', email: 's@local', password: 'longenough1', role: 'admin' } })).status === 403);
ok('technician cannot delete a machine',
  (await tech(`/api/equipment/${m1.data.id}`, { method: 'DELETE' })).status === 403);

// Disabling takes effect immediately on the next request AND next login.
await c(`/api/users/${created.data.id}`, { method: 'PUT', body: { active: false } });
ok('disabled user is rejected at login',
  (await makeClient()('/api/login', { method: 'POST', body: {
    email: 'tech@local', password: 'tech-password' } })).status === 403);
ok('admin cannot disable their own account',
  (await c('/api/users/1', { method: 'PUT', body: { active: false } })).status === 400);

console.log('\nPhase 5 — preventive maintenance');
const pm = await c('/api/pm', {
  method: 'POST',
  body: { equipment_id: m1.data.id, task: 'Change oil', interval_days: 30, next_due: '2020-01-01' },
});
ok('schedule created', pm.status === 201);
const due = await c('/api/pm/due?days=7');
ok('overdue schedule appears in Due Soon', due.data.length === 1 && due.data[0].days_left < 0,
  JSON.stringify(due.data));
const donePm = await c(`/api/pm/${pm.data.id}/done`, { method: 'POST', body: {} });
const expected = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
ok('mark done rolls next_due forward 30 days', donePm.data.next_due === expected,
  `got ${donePm.data.next_due}, expected ${expected}`);
ok('rolled-forward schedule leaves the 7-day window', (await c('/api/pm/due?days=7')).data.length === 0);

console.log('\nPhase 1 — persistence and file behaviour');
const before = statSync(DB).mtimeMs;
await sleep(50);
for (let i = 0; i < 5; i++) await c('/api/equipment');
const after = statSync(DB).mtimeMs;
ok('viewing pages does not rewrite the database', before === after,
  `mtime moved ${after - before}ms`);

const bak = await c('/api/backup', { method: 'POST' });
ok('backup file created', bak.status === 200 && existsSync(bak.data.file));
ok('backup is a non-empty file', bak.status === 200 && statSync(bak.data.file).size > 0);

// kill -9, restart, confirm data survived
console.log('\n  killing the server with SIGKILL...');
srv.child.kill('SIGKILL');
await sleep(600);
srv = start({ MM_ADMIN_PASSWORD: 'smoke-test-password' });
ok('server restarts on the same database', await waitForServer(), srv.log());
await sleep(300);
const c2 = makeClient();
const relogin = await c2('/api/login', {
  method: 'POST', body: { email: 'admin@local', password: 'smoke-test-password' },
});
ok('can log in again after restart', relogin.status === 200, JSON.stringify(relogin.data));
const survived = await c2('/api/equipment');
ok('machines survived kill -9', survived.data.length === 2, JSON.stringify(survived.data));
const woAfter = await c2('/api/work-orders');
ok('work orders survived kill -9', woAfter.data.length === 1);
const pmAfter = await c2('/api/pm');
ok('maintenance schedule survived kill -9', pmAfter.data.length === 1);
ok('first-run admin password is NOT re-seeded',
  !srv.log().includes('Created the first account'));

console.log('\nPhase 6 — offline audit');
const { execSync } = await import('node:child_process');
const urls = execSync(
  `grep -rn --include=*.js --include=*.html -E "https?://[a-zA-Z0-9]" "${root}" || true`,
  { encoding: 'utf8' });
const external = urls.split('\n').filter((l) =>
  l && !l.includes('localhost') && !l.includes('127.0.0.1') && !l.includes('// node:'));
ok('no external URLs in app code', external.length === 0, external.join(' | '));

console.log('\n--- stopping ---');
srv.child.kill('SIGKILL');
await sleep(300);
rmSync(DB, { force: true });
rmSync(DB + '-wal', { force: true });
rmSync(DB + '-shm', { force: true });
for (const f of readdirSync(join(root, 'data'))) {
  if (f.startsWith('backup-')) rmSync(join(root, 'data', f), { force: true });
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
