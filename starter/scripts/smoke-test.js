// Smoke test: proves the Phase 1-5 success criteria in .planning/ROADMAP.md.
// Usage: node --no-warnings=ExperimentalWarning scripts/smoke-test.js
// It starts its own server on a spare port with a throwaway database.
import { spawn } from 'node:child_process';
import { rmSync, existsSync, statSync, readdirSync, readFileSync } from 'node:fs';
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

  // Resolves once the process is truly gone. Windows releases file handles more
  // slowly than Linux, so deleting the database right after kill() can fail with
  // EBUSY; waiting for 'exit' avoids that.
  const exited = new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    child.once('exit', resolve);
  });
  return { child, log: () => log, exited };
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
  // `rawBody` sends bytes verbatim, so a test can prove what the server does with
  // a body it cannot parse. Without it this client can only ever send valid JSON.
  return async (path, { method = 'GET', body, rawBody } = {}) => {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'content-type': 'application/json', cookie },
      body: rawBody !== undefined ? rawBody : (body == null ? undefined : JSON.stringify(body)),
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

console.log('\nPhase 7 — parts are maintainable');
// The one-way ratchet: v1.0 could consume stock but never restore it.
const restocked = await c(`/api/parts/${part.data.id}`, { method: 'PUT', body: { qty: 40 } });
ok('stock can be raised back up', restocked.status === 200 && restocked.data.qty === 40,
  JSON.stringify(restocked.data));
const renamed = await c(`/api/parts/${part.data.id}`, { method: 'PUT', body: { name: 'Seal kit 35mm' } });
ok('part can be renamed after creation',
  renamed.status === 200 && renamed.data.name === 'Seal kit 35mm');
ok('renaming does not disturb the stock (partial update)', renamed.data.qty === 40,
  `qty=${renamed.data.qty}`);
ok('negative quantity rejected, not clamped',
  (await c(`/api/parts/${part.data.id}`, { method: 'PUT', body: { qty: -5 } })).status === 400);
ok('non-numeric quantity rejected',
  (await c(`/api/parts/${part.data.id}`, { method: 'PUT', body: { qty: 'abc' } })).status === 400);
ok('fractional quantity rejected',
  (await c(`/api/parts/${part.data.id}`, { method: 'PUT', body: { qty: 1.5 } })).status === 400);
ok('negative unit price rejected',
  (await c(`/api/parts/${part.data.id}`, { method: 'PUT', body: { unit_price: -1 } })).status === 400);

// Deleting a part that a job consumed must explain itself, not leak SQL.
const inUse = await c(`/api/parts/${part.data.id}`, { method: 'DELETE' });
ok('deleting a part used on a job is refused', inUse.status === 400, JSON.stringify(inUse.data));
ok('the refusal names the work order', String(inUse.data.error).includes(wo.data.title),
  JSON.stringify(inUse.data.error));
ok('the refusal does not leak SQL', !/FOREIGN KEY|constraint/i.test(inUse.data.error),
  JSON.stringify(inUse.data.error));

// A part nobody used can go, and it leaves the list.
const spare = await c('/api/parts', { method: 'POST', body: { name: 'Unused gasket', qty: 1 } });
const beforeCount = (await c('/api/parts')).data.length;
ok('unused part deletes cleanly',
  (await c(`/api/parts/${spare.data.id}`, { method: 'DELETE' })).status === 200);
ok('deleted part disappears from the list',
  (await c('/api/parts')).data.length === beforeCount - 1);
ok('deleting a part that never existed is a 404',
  (await c('/api/parts/999999', { method: 'DELETE' })).status === 404);

// Reorder level: per part, migrated, inclusive at the boundary.
ok('reorder level defaults to 5', part.data.reorder_level === 5,
  `reorder_level=${part.data.reorder_level}`);
const atLevel = await c('/api/parts', { method: 'POST', body: { name: 'At level', qty: 2, reorder_level: 2 } });
ok('reorder level is stored per part',
  atLevel.status === 201 && atLevel.data.reorder_level === 2 && atLevel.data.qty === 2);
const otherLevel = await c('/api/parts', { method: 'POST', body: { name: 'Same qty, other level', qty: 2, reorder_level: 0 } });
ok('two parts at the same qty carry different levels',
  otherLevel.data.qty === atLevel.data.qty && otherLevel.data.reorder_level !== atLevel.data.reorder_level);
ok('reorder level is inclusive at the boundary (qty == level is low)',
  atLevel.data.qty <= atLevel.data.reorder_level && !(otherLevel.data.qty <= otherLevel.data.reorder_level));
ok('negative reorder level rejected',
  (await c('/api/parts', { method: 'POST', body: { name: 'Bad level', reorder_level: -1 } })).status === 400);

// A malformed body must be a readable 400, never a leaked TypeError. This held
// for no handler before phase 7: readBody resolved null and handlers dereferenced it.
const malformed = await c(`/api/parts/${part.data.id}`, {
  method: 'PUT', rawBody: '{not json',
});
ok('malformed JSON is a 400', malformed.status === 400, JSON.stringify(malformed.data));
ok('malformed JSON does not leak a TypeError',
  !/Cannot read propert|TypeError|undefined/i.test(String(malformed.data.error)),
  JSON.stringify(malformed.data.error));

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
ok('technician cannot read the staff list',
  (await tech('/api/users')).status === 403);

console.log('\nPhase 8 — work belongs to somebody');
// WO-01: assign, reassign, unassign.
const assigned = await c(`/api/work-orders/${wo.data.id}`, {
  method: 'PATCH', body: { assigned_to: created.data.id },
});
ok('work order can be assigned', assigned.status === 200 && assigned.data.assigned_to === created.data.id,
  JSON.stringify(assigned.data.assigned_to));
const listed = (await c('/api/work-orders')).data.find((w) => w.id === wo.data.id);
ok('the list resolves the owner name',
  listed.assignee_name === 'Tech One', `assignee_name=${listed.assignee_name}`);
await c(`/api/work-orders/${wo.data.id}`, { method: 'PATCH', body: { assigned_to: 1 } });
ok('work order can be reassigned',
  (await c('/api/work-orders')).data.find((w) => w.id === wo.data.id).assignee_name === 'Admin');
await c(`/api/work-orders/${wo.data.id}`, { method: 'PATCH', body: { assigned_to: null } });
ok('work order can be unassigned',
  (await c('/api/work-orders')).data.find((w) => w.id === wo.data.id).assignee_name === null);
ok('assigning a non-existent user is a readable 400',
  (await c(`/api/work-orders/${wo.data.id}`, { method: 'PATCH', body: { assigned_to: 999999 } })).status === 400);
ok('the bad-assignee refusal does not leak SQL',
  !/FOREIGN KEY|constraint/i.test(String((await c(`/api/work-orders/${wo.data.id}`,
    { method: 'PATCH', body: { assigned_to: 999999 } })).data.error)));

// T-8-01: the narrow route must not become bug #11 through a second door.
const assignableAsTech = await tech('/api/users/assignable');
ok('technician can list assignable names', assignableAsTech.status === 200);
ok('the assignable list exposes only id and name',
  assignableAsTech.data.every((u) => Object.keys(u).sort().join(',') === 'id,name'),
  JSON.stringify(Object.keys(assignableAsTech.data[0] || {})));
ok('the assignable list never carries an email',
  !JSON.stringify(assignableAsTech.data).includes('@'),
  JSON.stringify(assignableAsTech.data).slice(0, 120));
ok('technician still cannot read the full staff list',
  (await tech('/api/users')).status === 403);

// WO-02: a disabled owner's name must still render.
await c(`/api/users/${created.data.id}`, { method: 'PUT', body: { active: false } });
await c(`/api/work-orders/${wo.data.id}`, { method: 'PATCH', body: { assigned_to: created.data.id } });
ok('a disabled owner is still named on the job',
  (await c('/api/work-orders')).data.find((w) => w.id === wo.data.id).assignee_name === 'Tech One',
  'a departed technician must not vanish from their own history');
await c(`/api/work-orders/${wo.data.id}`, { method: 'PATCH', body: { assigned_to: null } });
await c(`/api/users/${created.data.id}`, { method: 'PUT', body: { active: true } });

// WO-03: editing.
// Capture the status first — this order was moved to `done` back in phase 3, so
// hardcoding 'open' here asserts yesterday's fixture rather than today's behaviour.
const statusBeforeEdit = (await c('/api/work-orders')).data.find((w) => w.id === wo.data.id).status;
const retitled = await c(`/api/work-orders/${wo.data.id}`,
  { method: 'PATCH', body: { title: 'Retitled job' } });
ok('work order title can be edited', retitled.status === 200 && retitled.data.title === 'Retitled job');
ok('editing the title leaves the status alone', retitled.data.status === statusBeforeEdit,
  `was=${statusBeforeEdit} now=${retitled.data.status}`);
ok('an empty title is refused',
  (await c(`/api/work-orders/${wo.data.id}`, { method: 'PATCH', body: { title: '   ' } })).status === 400);
ok('a notes-only edit does not blank the title',
  (await c(`/api/work-orders/${wo.data.id}`, { method: 'PATCH', body: { notes: 'checked' } }))
    .data.title === 'Retitled job');

// WO-04: widening the writable surface must not widen the old boundaries.
ok('technician can edit a work order',
  (await tech(`/api/work-orders/${wo.data.id}`, { method: 'PATCH', body: { notes: 'tech edit' } })).status === 200);
ok('technician still cannot create users',
  (await tech('/api/users', { method: 'POST', body: {
    name: 'Sneaky2', email: 's2@local', password: 'longenough1', role: 'admin' } })).status === 403);
ok('technician still cannot delete a machine',
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
await srv.exited;
await sleep(100);
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
// Pure JavaScript on purpose: the first version of this check shelled out to
// `grep ... || true`, which does not exist on Windows (found by the Windows UAT,
// see WINDOWS_UAT_FINDINGS.md). No shell, no child process, same answer everywhere.
const SHIPPED = ['server.js', 'db.js', 'auth.js', 'public/index.html', 'public/app.js'];
let externalHits = [];
for (const rel of SHIPPED) {
  const text = readFileSync(join(root, rel), 'utf8');
  const hits = [...text.matchAll(/https?:\/\/[^\s'"`)]+/g)]
    .map((m) => m[0])
    .filter((u) => !u.includes('localhost') && !u.includes('127.0.0.1'))
    // `new URL(req.url, http://${req.headers.host})` parses a path; it opens no socket.
    .filter((u) => !u.includes('${'));
  for (const h of hits) externalHits.push(`${rel}: ${h}`);
}
ok('no external URLs in shipped app code', externalHits.length === 0, externalHits.join(' | '));

// Catch the usual offenders explicitly, so a failure names the cause.
const allSource = SHIPPED.map((f) => readFileSync(join(root, f), 'utf8')).join('\n');
ok('no Google Fonts / CDN / remote fetch',
  !/fonts\.(googleapis|gstatic)\.com/.test(allSource)
  && !/<script[^>]+src=["']https?:/.test(allSource)
  && !/<link[^>]+href=["']https?:/.test(allSource)
  && !/fetch\(\s*["'`]https?:/.test(allSource));

console.log('\n--- stopping ---');
srv.child.kill('SIGKILL');
await srv.exited;

// Retry for up to 3 s: on Windows the sqlite handle can outlive the process briefly.
async function removeWithRetry(path, attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    try { rmSync(path, { force: true }); return true; }
    catch { /* EBUSY / EPERM: sleep and retry */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}
let cleaned = true;
for (const f of [DB, DB + '-wal', DB + '-shm']) {
  if (!removeWithRetry(f) && existsSync(f)) cleaned = false;
}
for (const f of readdirSync(join(root, 'data'))) {
  if (f.startsWith('backup-') && !removeWithRetry(join(root, 'data', f))) cleaned = false;
}
if (!cleaned) console.log('  note: some temp files could not be deleted (still locked)');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
