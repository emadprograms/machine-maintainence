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
rmSync(join(root, 'data', 'login-failures.log'), { force: true });
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

console.log('\nPhase 10 — failed sign-ins are logged, not blocked');

// Locking a workshop out of its own app is worse than letting an attacker try
// again, so there is no attempt limit and no delay. That is a decision, not an
// omission — so it is asserted rather than left to be rediscovered as a bug by
// someone who assumes a login screen must throttle.
const loginAs = (email, password, extraHeaders = {}) => fetch(BASE + '/api/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...extraHeaders },
  body: JSON.stringify({ email, password }),
}).then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})), headers: r.headers }));

// Repeated failures: every one is an ordinary 401 for as long as anyone cares
// to keep trying. The count is deliberately well past any plausible threshold.
let sawSomethingElse = null;
const started = Date.now();
for (let i = 0; i < 40; i++) {
  const r = await loginAs('admin@local', 'wrong-password');
  if (r.status !== 401) { sawSomethingElse = `attempt ${i + 1} returned ${r.status} ${JSON.stringify(r.data)}`; break; }
}
const elapsed = Date.now() - started;
ok('forty wrong passwords are all rejected the same way, with no limit reached',
  sawSomethingElse === null, sawSomethingElse || '');
ok('the attempts were not slowed down', elapsed < 40 * 200, `${elapsed}ms for 40 attempts`);

// The shape of a failed sign-in is unchanged: one message, no hint about
// whether the address exists, no retry-after header.
const one = await loginAs('admin@local', 'wrong-password');
const madeUp = await loginAs('nobody@nowhere.invalid', 'wrong-password');
ok('a real address and an invented one fail identically',
  one.status === madeUp.status && one.data.error === madeUp.data.error,
  `${one.status}/${madeUp.status} ${JSON.stringify(one.data)} vs ${JSON.stringify(madeUp.data)}`);
ok('a failed sign-in sends no Retry-After header', one.headers.get('retry-after') === null,
  String(one.headers.get('retry-after')));
ok('the error states no delay',
  !/wait|seconds|too many/i.test(one.data.error || ''), one.data.error);

// And a correct password works immediately, straight after all that.
const recovered = await loginAs('admin@local', 'smoke-test-password');
ok('the right password works straight after forty failures', recovered.status === 200,
  `status ${recovered.status} ${JSON.stringify(recovered.data)}`);

// --- the record itself -----------------------------------------------------
// Visibility is the whole justification for not blocking, so the record has to
// actually exist and say something useful.
const logFile = join(root, 'data', 'login-failures.log');
ok('failed sign-ins are written to a log', existsSync(logFile), logFile);

const logText = existsSync(logFile) ? readFileSync(logFile, 'utf8') : '';
const logLines = logText.trim().split('\n').filter(Boolean);
ok('the log has an entry per failure', logLines.length >= 40, `${logLines.length} lines`);

const fields = logLines[0] ? logLines[0].split('\t') : [];
ok('each entry carries a timestamp', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(fields[0] || ''), fields[0]);
ok('each entry carries the source address', !!fields[1] && fields[1] !== 'unknown', fields[1]);
ok('each entry carries the address that was attempted', fields[2] === 'admin@local', fields[2]);
ok('each entry says why it failed', /wrong password|no such account/.test(fields[3] || ''), fields[3]);

// The one thing a failure log must never contain.
ok('the password is never written to the log',
  !logText.includes('wrong-password') && !logText.includes('smoke-test-password'),
  'a password fragment leaked into the log');

// An invented address is recorded too, and the record does not distinguish it
// in a way that would tell an attacker which accounts exist.
const inventedLines = logLines.filter((l) => l.includes('nobody@nowhere.invalid'));
ok('an invented address is recorded like any other', inventedLines.length >= 1,
  `${inventedLines.length} entries`);

// A successful attempt is not a failure and must not be logged as one.
const beforeSuccessCount = (() => {
  const t = existsSync(logFile) ? readFileSync(logFile, 'utf8') : '';
  return t.trim().split('\n').filter(Boolean).length;
})();
await loginAs('admin@local', 'smoke-test-password');
const afterSuccessCount = (() => {
  const t = existsSync(logFile) ? readFileSync(logFile, 'utf8') : '';
  return t.trim().split('\n').filter(Boolean).length;
})();
ok('a successful sign-in adds no failure entry', afterSuccessCount === beforeSuccessCount,
  `${beforeSuccessCount} -> ${afterSuccessCount}`);

// A spoofed forwarding header is irrelevant now, but it must not break anything.
const spoofed = await loginAs('admin@local', 'wrong-password', { 'x-forwarded-for': '9.9.9.9' });
ok('a spoofed X-Forwarded-For changes nothing', spoofed.status === 401, `status ${spoofed.status}`);

// An existing session is unaffected by any of this.
const sessionAfterFailures = await c('/api/equipment');
ok('repeated failures do not disturb an existing session', sessionAfterFailures.status === 200,
  `status ${sessionAfterFailures.status}`);

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

// A login form shows the server's message and nothing else. With no wait to
// count, no cooldown machinery should be left behind — dead timer code is how a
// removed feature comes back half-wired.
const loginFn = (appUrl.match(/async function login\(\)[\s\S]*?\n}/) || [''])[0];
ok('the login form shows the server message verbatim',
  /\$\('#login-error'\)\.textContent = e\.message/.test(loginFn),
  'login() must surface the error rather than interpret it');
ok('no countdown or retry machinery remains in the client',
  !/startCooldown|stopCooldown|loginCooldown|retryAfter|retry_after/.test(appUrl),
  'leftover cooldown code suggests the removal was incomplete');
ok('the client has no login timer at all',
  !/setInterval/.test(loginFn.replace(/\/\/[^\n]*/g, '')));

console.log('\nPhase 12 — the dashboard');

// --- the endpoint ---------------------------------------------------------
const dash = await c2('/api/dashboard');
ok('the dashboard endpoint answers', dash.status === 200, `status ${dash.status}`);
const sections = ['work_orders', 'due_soon', 'low_stock', 'machines'];
ok('it carries four sections', sections.every((k) => dash.data[k]), Object.keys(dash.data).join(','));
ok('each section has a count, items and a link',
  sections.every((k) => typeof dash.data[k].count === 'number'
    && Array.isArray(dash.data[k].items) && /^#[a-z]+$/.test(dash.data[k].href)),
  JSON.stringify(dash.data.work_orders).slice(0, 120));

// Every href must name a screen that exists, or the card navigates nowhere.
const dashPageKeys = [...((appUrl.match(/const PAGES = \[[\s\S]*?\n\];/) || [''])[0])
  .matchAll(/key: '([\w-]+)'/g)].map((m) => m[1]);
// "Points somewhere real" is too weak: swapping two cards' links still passed.
// Each section must lead to the screen that owns its rows.
const expectedHrefs = { work_orders: 'work', due_soon: 'due', low_stock: 'parts', machines: 'equipment' };
ok('each card links to the screen that owns its rows',
  sections.every((k) => dash.data[k].href === '#' + expectedHrefs[k]),
  sections.map((k) => `${k}:${dash.data[k].href}`).join(' '));
ok('every dashboard link points at a real screen',
  sections.every((k) => dashPageKeys.includes(dash.data[k].href.slice(1))),
  sections.map((k) => dash.data[k].href).join(','));

// The count must be the true total while the list is capped. Seeding six
// low-stock parts is the only way to tell "count" from "items.length".
for (let i = 0; i < 6; i++) {
  await c2('/api/parts', { method: 'POST', body: { name: `Dash part ${i}`, qty: 0, reorder_level: 3 } });
}
const capped = await c2('/api/dashboard');
ok('items are capped at five', sections.every((k) => capped.data[k].items.length <= 5),
  sections.map((k) => `${k}=${capped.data[k].items.length}`).join(' '));
ok('the count is the true total, not the number of items shown',
  capped.data.low_stock.count > capped.data.low_stock.items.length
  && capped.data.low_stock.count >= 6,
  `count=${capped.data.low_stock.count} items=${capped.data.low_stock.items.length}`);

// A card that disagrees with its screen is worse than no card.
const openList = (await c2('/api/work-orders')).data.filter((w) => w.status !== 'done');
ok('the work-order count matches the list it links to',
  capped.data.work_orders.count === openList.length,
  `card=${capped.data.work_orders.count} list=${openList.length}`);

// Close one work order. Without this, "open work orders" is never tested against
// a closed row — every seeded order is open, so a count that forgot the filter
// would still be right. A mutation proved exactly that.
const openListForClose = (await c2('/api/work-orders')).data
  .filter((w) => w.status !== 'done');
const beforeClose = (await c2('/api/dashboard')).data.work_orders.count;
if (openListForClose.length) {
  await c2(`/api/work-orders/${openListForClose[0].id}`, { method: 'PATCH', body: { status: 'done' } });
}
const afterClose = (await c2('/api/dashboard')).data.work_orders.count;
ok('closing a work order drops it from the open count',
  openListForClose.length === 0 || afterClose === beforeClose - 1,
  `${beforeClose} -> ${afterClose}`);


// --- the payload carries no user data ------------------------------------
const dashText = JSON.stringify(capped.data);
ok('the dashboard never carries an email address', !/@/.test(dashText.replace(/[^@]*$/, '')),
  'a user field leaked into the payload');
ok('the dashboard carries no password field', !/password/i.test(dashText));
ok('the dashboard carries no user records',
  !/(^|\W)(email|role|active)(\W|$)/.test(dashText), 'user-shaped keys present');
ok('an anonymous dashboard request is refused',
  (await fetch(BASE + '/api/dashboard')).status === 401);

// --- the screen ----------------------------------------------------------
const dashSrc = readFileSync(join(root, 'public', 'dashboard.js'), 'utf8');
ok('the dashboard lives in its own file', !/function renderDashboard/.test(appUrl));
// Counting calls was not enough: deleting two of them still passed, because the
// threshold was loose. Each user-controlled field is now named.
const escapedFields = ['title', 'equipment_name', 'task', 'name', 'status'];
const unescaped = escapedFields.filter((f) => !new RegExp(`escapeHtml\\([^)]*\\b${f}\\b`).test(dashSrc));
ok('every user-supplied field is escaped', unescaped.length === 0,
  unescaped.map((f) => `unescaped: ${f}`).join(', '));
ok('no user-supplied field reaches innerHTML unescaped',
  !/\$\{[^}]*\b(item\.(title|name|task|equipment_name|status))[^}]*\}/.test(
    dashSrc.replace(/escapeHtml\([^)]*\)/g, 'ESC')),
  'a raw item field is interpolated');
ok('signing in lands on the dashboard, not due soon',
  /showPage\('dashboard'\)/.test(appUrl), 'landing page not changed');
ok('the dashboard is in the page list', dashPageKeys.includes('dashboard'));
ok('a failed load is distinguished from an empty one',
  /renderDashboardError/.test(dashSrc) && /Could not load the dashboard/.test(dashSrc)
  && /dash-empty/.test(dashSrc));
ok('a card with more items than shown says so', /and \$\{count - items\.length\} more/.test(dashSrc));

console.log('\nPhase 11 — the shell');

const shellSrc = readFileSync(join(root, 'public', 'shell.js'), 'utf8');
const indexSrc = readFileSync(join(root, 'public', 'index.html'), 'utf8');

ok('the tab row is gone', !/id="tabs"/.test(indexSrc) && !/id="tabs"/.test(appUrl));
ok('the sidebar exists in the markup', /id="sidebar"/.test(indexSrc));
ok('the shell lives in its own file, not in app.js',
  existsSync(join(root, 'public', 'shell.js')) && !/function renderShell/.test(appUrl));

// The sidebar and the screens must come from one list, or the navigation will
// eventually offer a screen that does not exist.
const pagesBlock = (appUrl.match(/const PAGES = \[[\s\S]*?\n\];/) || [''])[0];
const pageKeys = [...pagesBlock.matchAll(/key: '([\w-]+)'/g)].map((m) => m[1]);
const sectionKeys = [...indexSrc.matchAll(/<section data-page="([\w-]+)"/g)].map((m) => m[1]);
ok('every page has a matching section', pageKeys.every((k) => sectionKeys.includes(k)),
  `pages=${pageKeys.join(',')} sections=${sectionKeys.join(',')}`);
ok('every section has a matching page', sectionKeys.every((k) => pageKeys.includes(k)),
  `sections=${sectionKeys.join(',')}`);
ok('the sidebar filters on the same adminOnly flag',
  /adminOnly/.test(appUrl) && /p\.adminOnly/.test(appUrl),
  'role filtering must reuse PAGES, not a second list');

ok('the collapsed state is read defensively', /try \{[\s\S]{0,120}localStorage\.getItem/.test(shellSrc));
ok('the collapsed state is written defensively', /try \{[\s\S]{0,140}localStorage\.setItem/.test(shellSrc));
ok('the current screen is announced with aria-current', /aria-current/.test(shellSrc));
ok('every entry carries an accessible name', /aria-label="\$\{p\.label\}"/.test(shellSrc));
ok('the toggle reports its state with aria-expanded', /aria-expanded/.test(shellSrc));
ok('icons are inline svg, not files or a font',
  /<svg/.test(shellSrc) && !/\.(png|svg|woff)\b/.test(shellSrc));
ok('no external URL was added to the shell',
  !/https?:\/\//.test(shellSrc.replace(/\/\/[^\n]*/g, '')));

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
// the failure log is plain-file state too; leaving it behind would make the
// next run's "one entry per failure" assertions pass on stale lines
for (const f of [DB, DB + '-wal', DB + '-shm', join(root, 'data', 'login-failures.log'),
                 join(root, 'data', 'login-failures.log.1')]) {
  if (!removeWithRetry(f) && existsSync(f)) cleaned = false;
}
for (const f of readdirSync(join(root, 'data'))) {
  if (f.startsWith('backup-') && !removeWithRetry(join(root, 'data', f))) cleaned = false;
}
if (!cleaned) console.log('  note: some temp files could not be deleted (still locked)');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
