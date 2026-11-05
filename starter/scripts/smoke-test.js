// Smoke test: proves the Phase 1-5 success criteria in .planning/ROADMAP.md.
// Usage: node --no-warnings=ExperimentalWarning scripts/smoke-test.js
// It starts its own server on a spare port with a throwaway database.
import { spawn } from 'node:child_process';
import { rmSync, existsSync, statSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createThrottle, DEFAULTS } from '../throttle.js';
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

// A server left behind by an interrupted run keeps answering on the port, so
// every request below would talk to an old process with an old database and the
// whole suite would report nonsense. Refusing to start is the only safe answer.
async function portIsFree() {
  try { await fetch(`${BASE}/api/nope`); return false; } catch { return true; }
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

// CSV is bytes, not JSON: the BOM, the CRLF endings and the quoting are the
// actual deliverable, so the test has to look at the raw text rather than at a
// parsed object that has already normalised all three away.
function makeTextClient(credentials) {
  let cookie = '';
  let signedIn = null;
  const client = async (path) => {
    if (credentials && !signedIn) {
      // reuse the same login contract as the JSON client; the cookie is the
      // only state that matters and it is identical for both content types
      signedIn = fetch(BASE + '/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(credentials),
      }).then((r) => {
        const setCookie = r.headers.get('set-cookie');
        if (setCookie) cookie = setCookie.split(';')[0];
        return r.status;
      });
      await signedIn;
    }
    const res = await fetch(BASE + path, { headers: { cookie } });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const bytes = Buffer.from(await res.arrayBuffer());
    // decoded as utf-8, so the BOM survives as U+FEFF and can be asserted on
    return { status: res.status, headers: res.headers, text: bytes.toString('utf8'), bytes };
  };
  return client;
}

// Minimal RFC 4180 reader. Assertions about the file use this rather than
// splitting on commas: a naive split agrees with a naive writer, so it cannot
// tell a correctly quoted file from a broken one.
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else quoted = false;
      } else cell += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell); cell = '';
    } else if (ch === '\r' && text[i + 1] === '\n') {
      row.push(cell); rows.push(row); row = []; cell = ''; i++;
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// ---------------------------------------------------------------- the test
console.log('\n--- starting with a fresh database ---');
if (!(await portIsFree())) {
  console.log(`  REFUSING TO RUN — something is already listening on port ${PORT}.`);
  console.log('  It is probably a server left over from an interrupted run.');
  console.log('  Stop it and run again; testing against it would prove nothing.');
  process.exit(1);
}
rmSync(DB, { force: true });
let srv = start({ MM_ADMIN_PASSWORD: 'smoke-test-password' });

// If an assertion throws instead of failing, the child server would outlive the
// test and squat on the port, so the next run would silently test against it.
// The port guard above catches that, but leaving the orphan in the first place
// is the actual bug. Kill it on any exit path.
const killServer = () => { try { srv.child.kill('SIGKILL'); } catch { /* already gone */ } };
process.on('exit', killServer);
process.on('uncaughtException', (e) => { killServer(); console.error(e); process.exit(1); });
process.on('unhandledRejection', (e) => { killServer(); console.error(e); process.exit(1); });
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
console.log('\nPhase 7+ — honest dates and real exports');

// The CSV client needs its own session; it is a different client object, and a
// cookie is the only thing the server uses to decide who is asking.
const csvClient = makeTextClient({ email: 'admin@local', password: 'smoke-test-password' });

// --- PM-01: a date the caller sends is the date that gets stored -----------
const todayStr = new Date().toISOString().slice(0, 10);
const pms = await c('/api/pm', {
  method: 'POST',
  body: { equipment_id: m1.data.id, task: 'Grease bearings', interval_days: 10, next_due: '2020-01-01' },
});
const sentDay = '2026-01-15';
const honoured = await c(`/api/pm/${pms.data.id}/done`, { method: 'POST', body: { on: sentDay } });
// The old code returned 200 with the value thrown away. Asserting only the
// status would have passed against that code, so assert the stored value.
ok('a completion date sent by the caller is the date stored',
  honoured.status === 200 && honoured.data.last_done === sentDay,
  `status=${honoured.status} last_done=${honoured.data.last_done}`);
ok('the completion date drives next_due, not today',
  honoured.data.next_due === '2026-01-25',
  `got ${honoured.data.next_due}, expected 2026-01-25 (2026-01-15 + 10 days)`);

// --- PM-02: the date is validated, and a refused date changes nothing ------
const beforeBad = (await c('/api/pm')).data.find((p) => p.id === pms.data.id).last_done;
const badDays = [
  ['2026-02-30', 'a day that does not exist'],
  ['2026-13-01', 'a month that does not exist'],
  ['15/01/2026', 'a day in the local format'],
  ['2026-1-5', 'an unpadded date'],
  ['tomorrow', 'a word'],
];
for (const [value, what] of badDays) {
  const bad = await c(`/api/pm/${pms.data.id}/done`, { method: 'POST', body: { on: value } });
  ok(`${what} is refused with 400`, bad.status === 400, `status=${bad.status} for ${value}`);
}
const afterBad = (await c('/api/pm')).data.find((p) => p.id === pms.data.id);
ok('a refused date leaves last_done untouched', afterBad.last_done === beforeBad,
  `${beforeBad} became ${afterBad.last_done}`);
ok('a refused date leaves next_due untouched', afterBad.next_due === honoured.data.next_due);

// --- PM-03: a date the calendar has not reached yet -----------------------
const future = new Date(Date.now() + 5 * 86400_000).toISOString().slice(0, 10);
const futureRes = await c(`/api/pm/${pms.data.id}/done`, { method: 'POST', body: { on: future } });
ok('a future completion date is refused with 400', futureRes.status === 400,
  `status=${futureRes.status} for ${future}`);
ok('a future date leaves last_done untouched',
  (await c('/api/pm')).data.find((p) => p.id === pms.data.id).last_done === beforeBad);

const earlier = await c(`/api/pm/${pms.data.id}/done`, { method: 'POST', body: { on: '2025-06-01' } });
ok('a date before the previous completion is refused with 400', earlier.status === 400,
  `status=${earlier.status}`);
ok('today is accepted for a schedule last done long ago', 
  (await c(`/api/pm/${pms.data.id}/done`, { method: 'POST', body: { on: todayStr } })).status === 200);

// --- CSV-01/02: quoting, line endings, encoding ---------------------------
// A title built to break a naive writer: comma, quote, newline, and a value
// that a spreadsheet would execute as a formula.
const nasty = 'Belt "A" snapped, 3rd time';
await c('/api/work-orders', {
  method: 'POST',
  body: { equipment_id: m2.data.id, title: nasty, priority: 'high' },
});
const csv = await csvClient('/api/export/work-orders.csv');
ok('export returns 200 with the CSV content type',
  csv.status === 200 && /text\/csv/.test(csv.headers.get('content-type')),
  `${csv.status} ${csv.headers.get('content-type')}`);
ok('export is offered as a download with a filename',
  /attachment/.test(csv.headers.get('content-disposition') || '')
  && /work-orders\.csv/.test(csv.headers.get('content-disposition') || ''),
  csv.headers.get('content-disposition'));
ok('export starts with a UTF-8 byte-order mark', csv.text.charCodeAt(0) === 0xFEFF,
  `first char code ${csv.text.charCodeAt(0)}`);
ok('lines end with CRLF, not bare LF', !/[^\r]\n/.test(csv.text.slice(1)),
  JSON.stringify(csv.text.slice(0, 80)));
ok('a field containing a comma and a quote is quoted and its quotes doubled',
  csv.text.includes('"Belt ""A"" snapped, 3rd time"'), csv.text.split('\r\n')[1]);
ok('the header names the same columns as the screen',
  csv.text.slice(1).split('\r\n')[0] === 'ID,Machine,Problem,Owner,Priority,Status,Created,Closed',
  csv.text.slice(1).split('\r\n')[0]);
const rowCount = csv.text.slice(1).trim().split('\r\n').length - 1;
ok('every work order is in the file', rowCount === (await c('/api/work-orders')).data.length,
  `${rowCount} rows`);

const partsCsv = await csvClient('/api/export/parts.csv');
ok('the parts export downloads as a separate file',
  partsCsv.status === 200 && /spare-parts\.csv/.test(partsCsv.headers.get('content-disposition') || ''),
  partsCsv.headers.get('content-disposition'));
ok('the parts export has the parts header',
  partsCsv.text.slice(1).split('\r\n')[0] === 'ID,Name,Reference,In stock,Reorder at,Unit price,Supplier',
  partsCsv.text.slice(1).split('\r\n')[0]);

// A CSV is read column by column, so every cell in a column must share a format.
const table = parseCsv(csv.text);
const header = table[0];
const col = (name) => table.slice(1).map((r) => r[header.indexOf(name)]).filter(Boolean);
const STAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
ok('created timestamps share one format', col('Created').every((t) => STAMP.test(t)),
  col('Created').join(' | '));
ok('closed timestamps use the same format as created',
  col('Closed').length > 0 && col('Closed').every((t) => STAMP.test(t)),
  col('Closed').join(' | '));
ok('a quoted field is read back as one value by a real parser',
  col('Problem').includes('Belt "A" snapped, 3rd time'), col('Problem').join(' | '));
ok('the parsed file has as many columns as the header',
  table.every((r) => r.length === header.length),
  JSON.stringify(table.map((r) => r.length)));

// --- CSV-03: the file matches the filter that is on screen ----------------
const filtered = await csvClient('/api/export/work-orders.csv?status=done');
const filteredTable = parseCsv(filtered.text);
const filteredStatuses = filteredTable.slice(1).map((r) => r[filteredTable[0].indexOf('Status')]);
ok('a filtered export contains only the filtered rows',
  filteredStatuses.length === (await c('/api/work-orders?status=done')).data.length
  && filteredStatuses.every((s) => s === 'done'),
  `${filteredStatuses.length} rows: ${filteredStatuses.join(',')}`);
ok('the filter is applied to the list too, not just the file',
  (await c('/api/work-orders?status=open')).data.every((w) => w.status === 'open'));

// formula injection: a spreadsheet runs a cell beginning =, +, - or @
await c('/api/parts', { method: 'POST', body: { name: '=1+1', reference: '+SUM(A1)' } });
const formulaCsv = await csvClient('/api/export/parts.csv');
const partsTable = parseCsv(formulaCsv.text);
const partNames = partsTable.slice(1).map((r) => r[partsTable[0].indexOf('Name')]);
const partRefs = partsTable.slice(1).map((r) => r[partsTable[0].indexOf('Reference')]);
ok('a value a spreadsheet would execute is neutralised',
  partNames.includes("'=1+1") && partRefs.includes("'+SUM(A1)"),
  `names=${partNames.join('|')} refs=${partRefs.join('|')}`);

console.log('\nPhase 10 — login hardening');

// --- unit level: expiry is arithmetic, not a timer -------------------------
// A fake clock is what makes AUTH-03 testable at all. Sleeping for a 15-minute
// window is not a test anyone would keep running.
{
  let fake = 1_000_000;
  const t = createThrottle({ now: () => fake });

  ok('a fresh source is not blocked', t.check('1.1.1.1').blocked === false);
  for (let i = 0; i < DEFAULTS.threshold; i++) t.fail('1.1.1.1');
  const blocked = t.check('1.1.1.1');
  ok('reaching the threshold blocks the source', blocked.blocked === true,
    JSON.stringify(blocked));
  ok('the block reports a wait in whole seconds', Number.isInteger(blocked.retryAfter) && blocked.retryAfter > 0,
    String(blocked.retryAfter));

  // the same source, a moment later, is still blocked and waits less
  fake += 60_000;
  const later = t.check('1.1.1.1');
  ok('the wait shrinks as time passes', later.retryAfter < blocked.retryAfter,
    `${blocked.retryAfter} -> ${later.retryAfter}`);

  // and once the window has elapsed, without anyone clearing anything
  fake += DEFAULTS.windowMs;
  ok('the block expires on its own once the window has passed',
    t.check('1.1.1.1').blocked === false, JSON.stringify(t.check('1.1.1.1')));
  ok('an expired entry is forgotten entirely, so memory does not grow',
    t.size === 0, `map size ${t.size}`);

  // a different source is never affected by another's failures
  let fake2 = 2_000_000;
  const t2 = createThrottle({ now: () => fake2 });
  for (let i = 0; i < DEFAULTS.threshold; i++) t2.fail('2.2.2.2');
  ok('one blocked source leaves another free', t2.check('3.3.3.3').blocked === false);
  ok('a correct login clears only its own source', t2.reset('2.2.2.2').blocked === false
    && t2.check('2.2.2.2').blocked === false);

  // failures older than the window do not count toward a new threshold
  let fake3 = 3_000_000;
  const t3 = createThrottle({ now: () => fake3 });
  for (let i = 0; i < DEFAULTS.threshold - 1; i++) t3.fail('4.4.4.4');
  fake3 += DEFAULTS.windowMs + 1;
  for (let i = 0; i < DEFAULTS.threshold - 1; i++) t3.fail('4.4.4.4');
  ok('failures outside the window do not accumulate into a block',
    t3.check('4.4.4.4').blocked === false, JSON.stringify(t3.check('4.4.4.4')));
}

// --- over HTTP: the route does what the module does ------------------------
// A source that has already used its attempts. The suite shares one address with
// the server, so this runs last, after every other login in the file.
const loginAs = (email, password, extraHeaders = {}) => fetch(BASE + '/api/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...extraHeaders },
  body: JSON.stringify({ email, password }),
}).then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})), headers: r.headers }));

// --- AUTH-02: a successful login clears the count --------------------------
// This has to go through the route. Calling throttle.reset() directly proves the
// module can clear a source, which is not the same claim as the server doing it
// on a successful login — and the first version of this assertion made exactly
// that mistake, passing with the route's reset() deleted.
{
  const before = await loginAs('admin@local', 'wrong-password');
  const before2 = await loginAs('admin@local', 'wrong-password');
  ok('two wrong passwords are 401 while under the threshold',
    before.status === 401 && before2.status === 401, `${before.status}/${before2.status}`);

  const good = await loginAs('admin@local', 'smoke-test-password');
  ok('the correct password works before the threshold is reached', good.status === 200,
    `status ${good.status}`);

  // If the route cleared the count, a fresh run of failures starts from zero and
  // a single wrong password cannot possibly be a 429. If it did not, the two
  // failures above plus this one are 3 — still under the threshold — so a plain
  // 401 proves nothing either. Fail twice more: with the count cleared these are
  // failures 1 and 2, without it they are 3 and 4, and the fifth is the
  // threshold. Then one more distinguishes 0+3 (401) from 4+1 (429).
  await loginAs('admin@local', 'wrong-password');
  await loginAs('admin@local', 'wrong-password');
  const afterReset = await loginAs('admin@local', 'wrong-password');
  ok('a successful login resets the source, so the next misses start over',
    afterReset.status === 401, `status ${afterReset.status} — a 429 here means the count survived a good login`);
  // clean up so the threshold test below starts from a known state
  await loginAs('admin@local', 'smoke-test-password');
}

// the wrong-password count is per source and this source is clean so far
const wrongNow = await loginAs('admin@local', 'wrong-password');
ok('a wrong password is still 401 while under the threshold', wrongNow.status === 401,
  `status ${wrongNow.status}`);

// --- an unknown email must be counted identically -------------------------
// Otherwise the throttle answers "does this address exist?" for an attacker:
// keep guessing a real address and it stops working, keep guessing an invented
// one and it never does.
{
  // Spend the budget on *invented* addresses only. Doing it on the real one
  // would block the source regardless of how unknown emails are treated, and
  // the check would pass without testing anything — which is exactly what the
  // first version did.
  let madeUpStatus = 0;
  for (let i = 0; i < DEFAULTS.threshold; i++) {
    const r = await loginAs(`nobody${i}@nowhere.invalid`, 'wrong-password');
    madeUpStatus = r.status;
  }
  ok('repeated failures on addresses that do not exist reach the threshold',
    madeUpStatus === 429, `status ${madeUpStatus}`);
  // and the refusal says nothing about whether the address exists
  const probe = await loginAs('nobody99@nowhere.invalid', 'wrong-password');
  ok('the throttled response is the same shape as any other',
    /Too many failed sign-ins/.test(probe.data.error || ''), JSON.stringify(probe.data));
  await loginAs('admin@local', 'smoke-test-password'); // clear for the tests below
}

let last = null;
for (let i = 0; i < DEFAULTS.threshold - 1; i++) last = await loginAs('admin@local', 'wrong-password');
last = await loginAs('admin@local', 'wrong-password');
ok('exceeding the threshold returns 429', last.status === 429, `status ${last.status}`);

const throttle429 = await loginAs('admin@local', 'wrong-password');
ok('the refusal states how long to wait in the message',
  /Try again in \d+ seconds/.test(throttle429.data.error || ''), throttle429.data.error);
ok('the wait is also reported as a number', Number.isInteger(throttle429.data.retry_after)
  && throttle429.data.retry_after > 0, JSON.stringify(throttle429.data));
ok('the refusal carries a Retry-After header', /^\d+$/.test(throttle429.headers.get('retry-after') || ''),
  String(throttle429.headers.get('retry-after')));

// an attacker cannot mint a fresh identity with a header
const spoofed = await loginAs('admin@local', 'wrong-password', { 'x-forwarded-for': '9.9.9.9' });
ok('a spoofed X-Forwarded-For does not escape the throttle', spoofed.status === 429,
  `status ${spoofed.status}`);

// a correct password is refused while blocked — that is the point of a block
const blockedCorrect = await loginAs('admin@local', 'smoke-test-password');
ok('even the right password waits while the source is blocked', blockedCorrect.status === 429,
  `status ${blockedCorrect.status}`);

// the block lifts by itself; prove it without waiting by driving the same
// assertion at the unit level, and assert the route's own arithmetic here
ok('the reported wait is bounded by the window, so the block is always finite',
  throttle429.data.retry_after <= DEFAULTS.windowMs / 1000,
  `${throttle429.data.retry_after} <= ${DEFAULTS.windowMs / 1000}`);

// `c` still holds the session cookie taken at the start of the run
const sessionDuringBlock = await c('/api/equipment');
ok('being blocked does not invalidate an existing session', sessionDuringBlock.status === 200,
  `status ${sessionDuringBlock.status}`);

// Snapshot the row counts now. The persistence checks below used to hardcode
// the numbers the earlier phases happened to leave behind, so any later phase
// that added a row broke them for the wrong reason (this is exactly what
// happened when the export tests added a work order).
const countsBeforeKill = {
  equipment: (await c('/api/equipment')).data.length,
  workOrders: (await c('/api/work-orders')).data.length,
  pm: (await c('/api/pm')).data.length,
};

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
ok('machines survived kill -9', survived.data.length === countsBeforeKill.equipment,
  `${survived.data.length} now vs ${countsBeforeKill.equipment} before`);
const woAfter = await c2('/api/work-orders');
ok('work orders survived kill -9', woAfter.data.length === countsBeforeKill.workOrders,
  `${woAfter.data.length} now vs ${countsBeforeKill.workOrders} before`);
const pmAfter = await c2('/api/pm');
ok('maintenance schedule survived kill -9', pmAfter.data.length === countsBeforeKill.pm,
  `${pmAfter.data.length} now vs ${countsBeforeKill.pm} before`);
ok('first-run admin password is NOT re-seeded',
  !srv.log().includes('Created the first account'));

console.log('\nPhase 7+ — the page is wired to the server');
// The UI was checked end-to-end in a headless DOM during development, but that
// needs a dependency this project does not have. These two static checks catch
// the failure that actually happens: a button whose handler was renamed or
// never written, so it silently does nothing when clicked.
const html = readFileSync(join(root, 'public', 'index.html'), 'utf8');
const appUrl = readFileSync(join(root, 'public', 'app.js'), 'utf8');

const handlers = [...html.matchAll(/on(?:click|change|input)="([A-Za-z_$][\w$]*)\(/g)]
  .map((m) => m[1]);
const missingHandlers = [...new Set(handlers)]
  .filter((fn) => !new RegExp(`(?:async\\s+)?function\\s+${fn}\\b`).test(appUrl)
    && !new RegExp(`(?:const|let|var)\\s+${fn}\\s*=`).test(appUrl)
    && !new RegExp(`${fn}\\s*[:=]\\s*(?:async\\s*)?(?:function|\\()`).test(appUrl));
ok('every button in the page calls a function that exists',
  missingHandlers.length === 0, `missing: ${missingHandlers.join(', ')}`);

// Only literal ids can be checked statically; templated ones (pm-on-1) are
// built and queried in the same function and cannot drift silently.
const literalIds = [...new Set([...appUrl.matchAll(/\$\('#([\w-]+)'\)/g)].map((m) => m[1]))];
const missingIds = literalIds.filter((id) => !html.includes(`id="${id}"`));
ok('every element the page looks up by id exists in the markup',
  missingIds.length === 0, `missing: ${missingIds.join(', ')}`);

ok('the export buttons are on the page', handlers.filter((h) => h.startsWith('download')).length === 2,
  handlers.join(', '));
ok('both exports read a filter that is on the page',
  html.includes('id="wo-status-filter"') && html.includes('id="low-stock-filter"'));

// The throttle's message reaches a user or it is theatre. A 429 the client
// treats as "please sign in" would look like a broken password.
//
// These check the actual chain, not that some word appears somewhere. The first
// version of this check passed with the entire countdown deleted, which is why
// it now names each link: the error objects carry retryAfter, login() reads it,
// and something ticks it down.
const loginFn = (appUrl.match(/async function login\(\)[\s\S]*?\n}/) || [''])[0];
ok('the API error carries the wait',
  /err\.retryAfter\s*=\s*data\.retry_after/.test(appUrl),
  'api() must attach retry_after to the error it throws');
ok('the login handler uses that wait instead of the generic message',
  /e\.retryAfter/.test(loginFn) || /e\.retryAfter/.test(appUrl),
  'login() must branch on the wait');
ok('a countdown exists and is actually started',
  /function startCooldown/.test(appUrl) && /startCooldown\(/.test(loginFn + appUrl.replace(/function startCooldown[\s\S]*?\n}/, '')),
  'startCooldown must be called from outside its own body');
ok('the countdown ticks on a timer and can be stopped',
  /setInterval\(/.test(appUrl) && /clearInterval\(/.test(appUrl));

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
