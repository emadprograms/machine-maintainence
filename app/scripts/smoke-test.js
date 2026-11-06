// Smoke test: proves the Phase 1-5 success criteria in .planning/ROADMAP.md.
// Usage: node --no-warnings=ExperimentalWarning scripts/smoke-test.js
// It starts its own server on a spare port with a throwaway database.
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, existsSync, statSync, readdirSync, readFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
  // A photograph is bytes, not JSON, and the answer comes back as bytes too, so
  // the client can override the content type and always keeps the raw reply.
  return async (path, { method = 'GET', body, rawBody, contentType } = {}) => {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'content-type': contentType || 'application/json', cookie },
      body: rawBody !== undefined ? rawBody : (body == null ? undefined : JSON.stringify(body)),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const bytes = Buffer.from(await res.arrayBuffer());
    let data = {};
    try { data = JSON.parse(bytes.toString('utf8')); } catch { /* not JSON */ }
    return { status: res.status, data, bytes, headers: res.headers };
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
// The other half of the same promise, which went unchecked for four milestones:
// the session already open must die too. It did not — this client kept working
// for the rest of the run, and a later assertion was quietly passing on it.
ok('a disabled user loses the session they already had',
  (await tech('/api/work-orders')).status === 401,
  'disabling must end the open session, not only the next sign-in');
// The token carries a copy of the role. It must not outlive the row it copied:
// a demoted administrator loses the admin screens on the next request, not when
// the cookie expires twelve hours later.
await c('/api/users', { method: 'POST', body: {
  name: 'Deputy', email: 'deputy@local', password: 'deputy-password', role: 'admin' } });
const deputy = makeClient();
await deputy('/api/login', { method: 'POST', body: {
  email: 'deputy@local', password: 'deputy-password' } });
const deputyId = (await c('/api/users')).data.find((u) => u.email === 'deputy@local').id;
ok('a second admin can read the user list',
  (await deputy('/api/users')).status === 200);
await c(`/api/users/${deputyId}`, { method: 'PUT', body: { role: 'tech' } });
ok('a demoted admin loses the admin screens without signing in again',
  (await deputy('/api/users')).status === 403,
  'the role must come from the row, not from the cookie that copied it');

// The database should hold one spelling of a role. POST normalised; PUT used to
// store whatever it was given, so the same person could be 'tech' or 'technician'
// depending on which route last touched them.
const roleTidy = await c(`/api/users/${created.data.id}`, { method: 'PUT', body: { role: 'technician' } });
ok('a role is stored in one spelling only', roleTidy.data.role === 'tech',
  `stored=${roleTidy.data.role}`);

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
// Two backups in the same second are two backups, not an error. The stamp used to
// stop at seconds, so the second click was answered with SQLite's
// "output file already exists" — a database sentence shown to a person.
const bak2 = await c('/api/backup', { method: 'POST' });
ok('a second backup in the same second is a second file, not an error',
  bak2.status === 200 && bak2.data.file !== bak.data.file && existsSync(bak2.data.file),
  `first=${bak.data.file} second=${bak2.data.file} status=${bak2.status}`);

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

// Every shipped client file, not just app.js: the shell, dashboard and history
// are modules now, and a handler in a module is still a handler.
const clientSrc = readdirSync(join(root, 'public'))
  .filter((f) => f.endsWith('.js'))
  .map((f) => readFileSync(join(root, 'public', f), 'utf8'))
  .join('\n');
const handlers = [...html.matchAll(/on(?:click|change|input)="([A-Za-z_$][\w$]*)\(/g)]
  .map((m) => m[1]);
const missingHandlers = [...new Set(handlers)]
  .filter((fn) => !new RegExp(`(?:async\\s+)?function\\s+${fn}\\b`).test(clientSrc)
    && !new RegExp(`(?:const|let|var)\\s+${fn}\\s*=`).test(clientSrc)
    && !new RegExp(`${fn}\\s*[:=]\\s*(?:async\\s*)?(?:function|\\()`).test(clientSrc));
ok('every button in the page calls a function that exists',
  missingHandlers.length === 0, `missing: ${missingHandlers.join(', ')}`);

// Only literal ids can be checked statically; templated ones (pm-on-1) are
// built and queried in the same function and cannot drift silently.
const literalIds = [...new Set([...clientSrc.matchAll(/\$\('#([\w-]+)'\)/g)].map((m) => m[1]))];
const missingIds = literalIds.filter((id) => !html.includes(`id="${id}"`));
ok('every element the page looks up by id exists in the markup',
  missingIds.length === 0, `missing: ${missingIds.join(', ')}`);

// Named, not counted: a count passes when a third export is added and says
// nothing about which file you get.
const exportHandlers = [...new Set(handlers.filter((h) => h.startsWith('download')))];
ok('every filtered list can also be written to a file',
  ['downloadWorkOrders', 'downloadParts', 'downloadHistory']
    .every((h) => exportHandlers.includes(h)),
  exportHandlers.join(', '));
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

console.log('\nPhase 13 — one visual language');

// The stylesheet is its own file since 261106-eqs: index.html passed 600 lines
// when the machine photograph was added.
const uiCss = readFileSync(join(root, 'public', 'app.css'), 'utf8');
ok('the page loads its stylesheet from the app itself, not the internet',
  /<link rel="stylesheet" href="\/app\.css" \/>/.test(html));
const appSrc13 = readFileSync(join(root, 'public', 'app.js'), 'utf8');

// Every screen opens with a header: name, purpose, and its action.
const screenBodies = [...html.matchAll(/<section data-page="([\w-]+)"[^>]*>([\s\S]*?)<\/section>/g)];
ok('every screen has a page header',
  screenBodies.length > 0 && screenBodies.every((m) => /class="page-head"/.test(m[2])),
  screenBodies.filter((m) => !/class="page-head"/.test(m[2])).map((m) => m[1]).join(',') || 'none');
ok('every header carries a purpose sentence',
  screenBodies.every((m) => /class="page-sub"[^>]*>[^<]{20,}</.test(m[2])),
  screenBodies.filter((m) => !/class="page-sub"[^>]*>[^<]{20,}</.test(m[2])).map((m) => m[1]).join(','));

// The complaint was a data-entry form above a table. That must not come back.
ok('no screen opens with a form',
  screenBodies.every((m) => {
    const first = m[2].trim();
    return /^<div class="page-head"/.test(first);
  }), screenBodies.filter((m) => !/^<div class="page-head"/.test(m[2].trim())).map((m) => m[1]).join(','));
ok('no form sits on a page outside a dialog',
  screenBodies.every((m) => {
    const withoutDialogs = m[2].replace(/<dialog[\s\S]*?<\/dialog>/g, '');
    return !/class="form-grid/.test(withoutDialogs);
  }));
// The five screens that create something each own one dialog. This used to be a
// count of five, which said nothing about *which* five and failed the moment a
// sixth form (the machine editor) was added — the same mistake as counting export
// buttons. The names are checked instead, and the editor is checked separately.
const allDialogs = html.match(/<dialog id="[\w-]+"[\s\S]*?<\/dialog>/g) || [];
const dialogId = (d) => (d.match(/id="([\w-]+)"/) || [])[1];
const CREATING_DIALOGS = ['work-form', 'equipment-form', 'parts-form', 'pm-form', 'users-form'];
const creatingIds = allDialogs
  .filter((d) => /class="form-grid/.test(d) && !/-edit$/.test(dialogId(d)))
  .map(dialogId);
ok('each creating screen has its own dialog',
  CREATING_DIALOGS.every((id) => creatingIds.includes(id))
  && creatingIds.length === CREATING_DIALOGS.length,
  `expected ${CREATING_DIALOGS.join(',')} — got ${creatingIds.join(',')}`);
ok('the machine editor is a dialog too, and it is not a creating form',
  allDialogs.some((d) => dialogId(d) === 'equipment-edit'));
// A fixed character budget was a proxy for the real rule, and the photograph
// preview pushed the dialog past it. The rule is order: fill, then open.
{
  const src = readFileSync(join(root, 'public', 'machines.js'), 'utf8');
  const body = (src.match(/export function editEquipment[\s\S]*?\n\}/) || [''])[0];
  ok('an editing dialog is filled before it is shown, never used to create',
    body.includes('#ee-name') && body.includes('#ee-photo-preview')
    && body.indexOf("openForm('equipment-edit')") > body.indexOf('#ee-name'),
    body ? 'prefill after open, or missing' : 'editEquipment() is not defined');
}
// One close button per dialog, counted rather than hard-coded, so a dialog
// added later cannot ship without a way to close it.
const dialogCount = (html.match(/<dialog id="[\w-]+"/g) || []).length;
ok('every dialog can be closed without JavaScript',
  (html.match(/<button class="icon-btn" type="button" aria-label="Close"/g) || []).length === dialogCount,
  `${dialogCount} dialogs`);
ok('a create action is behind a button, not on the page',
  /onclick="openForm\('/.test(html) && /function openForm/.test(appSrc13));

// Row treatment, asserted as CSS rules rather than by eye.
ok('rows respond to hover', /tbody tr:hover td/.test(uiCss));
ok('numeric columns are right-aligned and tabular',
  /\.cell-num\s*\{[^}]*text-align:\s*right/.test(uiCss) && /\.cell-num\s*\{[^}]*tabular-nums/.test(uiCss));
ok('the first column is heavier', /\.cell-strong\s*\{[^}]*font-weight/.test(uiCss));
ok('secondary text is muted', /\.cell-muted\s*\{[^}]*color:/.test(uiCss));
ok('row padding is set once for every table', /th, td \{[^}]*padding/.test(uiCss));
// `strong(e.name)` grew an optional second line in 261106-eqs, so the match allows
// the comma: the point of the check is the shared helper, not the argument count.
ok('rows use the shared strong/soft helpers, not bare cells',
  /strong\(e\.name[,)]/.test(clientSrc) && clientSrc.includes('strong(w.equipment_name)')
  && clientSrc.includes('strong(p.name)') && clientSrc.includes('strong(u.name)'));

// Empty states: a sentence, and only after a successful fetch.
ok('every list has a written empty state',
  ['equipment', 'work', 'parts', 'due', 'pm', 'users'].every((fn) => {
    // app.js keeps a one-line delegating wrapper for screens that live in their
    // own module, so every match is considered and any real body will do: a
    // wrapper has no empty state and the module's function has one.
    const bodies = [...clientSrc.matchAll(
      new RegExp(`async function load${fn[0].toUpperCase()}${fn.slice(1)}[\\s\\S]*?\\n}`, 'g'))]
      .map((m) => m[0]);
    return bodies.some((b) => /emptyRow\(/.test(b));
  }));
ok('an empty state is escaped, not interpolated raw', /function emptyRow[\s\S]{0,160}esc\(sentence\)/.test(appSrc13));
// Two earlier versions of this assertion were wrong, and a mutation proved it
// both times. The first matched the word "catch" inside emptyRow's own comment
// and reported a bug that did not exist. The second inspected the catch body,
// but the defect is a catch that swallows the error and lets execution fall
// through to the empty render — the catch body itself is innocent.
//
// The invariant is about the data source: a loader that can render "nothing
// here" must not have a catch that turns a failure into an empty array.
const emptiers = ['Equipment', 'Work', 'Parts', 'Due', 'Pm', 'Users'];
const swallowed = emptiers.filter((fn) => {
  const body = (appSrc13.match(new RegExp(`async function load${fn}[\\s\\S]*?\\n}`)) || [''])[0];
  if (!body.includes('emptyRow(')) return false;
  // Only a catch that guards the *list* fetch can turn a failure into "nothing
  // here". A catch inside the assignee lookup is a different question, and
  // loadWork legitimately has one: a technician may not read that list.
  const guarded = body
    .replace(/try \{ assignable = await api\('\/users\/assignable'\); \} catch \{ assignable = \[\]; \}/, '')
    // Strip comments before matching. Twice now this assertion has been fooled by
    // the word "catch" in prose — the first time when it was written, the second
    // time when I documented the very thing it was looking for.
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  return /catch[^{]*\{/.test(guarded);
});
ok('a failed load cannot fall through to an empty list', swallowed.length === 0,
  `swallows errors: ${swallowed.map((f) => 'load' + f).join(', ')}`);

// Destructive actions name the record and the consequence.
ok('deleting a machine names it and says what happens',
  clientSrc.includes('Delete ${machine.name}?')
  && clientSrc.includes('Deleting this machine deletes')
  && clientSrc.includes('its photograph')
  && /This cannot be undone\./.test(html),
  'the destructive dialog no longer says what it destroys');
ok('deleting a part names it and says what happens', /Delete "\$\{label\}"/.test(appSrc13));

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
// This used to scan the text for the words email/role/active, which was a
// value-level test: the machine rows now carry service_status 'active' and it
// failed on a payload with no user in it at all. A leaked user record is
// recognised by its *keys*.
const dashKeys = [];
(function walk(v) {
  if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) { dashKeys.push(k); walk(x); }
  }
}(capped.data));
ok('the dashboard carries no user records',
  !dashKeys.some((k) => /^(email|password|password_hash|role|active|salt)$/.test(k)),
  `user-shaped keys present: ${dashKeys.join(',')}`);
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
// The sidebar draws its icons from ICONS in shell.js, keyed by page. A page with
// no entry renders an empty <svg> — a blank column where the icon should be, and
// nothing anywhere says so. This is exactly what happened to History and Report.
const iconsBlock = (shellSrc.match(/const ICONS = \{[\s\S]*?\n\};/) || [''])[0];
const iconKeys = [...iconsBlock.matchAll(/\n  ([\w-]+):/g)].map((m) => m[1]);
const pagesWithoutIcons = pageKeys.filter((k) => !iconKeys.includes(k));
ok('every screen in the sidebar has an icon', pagesWithoutIcons.length === 0,
  `blank icons: ${pagesWithoutIcons.join(', ')} — pages=${pageKeys.join(',')} icons=${iconKeys.join(',')}`);
ok('every icon belongs to a screen that exists',
  iconKeys.every((k) => pageKeys.includes(k)),
  `orphaned icons: ${iconKeys.filter((k) => !pageKeys.includes(k)).join(',')}`);
ok('every icon is drawn with a path, not left as a stub',
  [...iconsBlock.matchAll(/\n  [\w-]+: '([^']*)'/g)].every((m) => m[1].includes('<path') || m[1].includes('<circle')),
  'an icon entry with no drawing renders as nothing at all');

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

console.log('\nStructure — the readability rule');

// The project's stated rule: anything past ~600 lines is a signal to split.
// server.js reached 814 and nothing noticed, so the rule is checked rather than
// remembered. Test code is exempt: smoke-test.js is long because coverage is
// long, and nobody reads it to learn how the app works.
const LIMIT = 600;
const APP_FILES = [
  ...readdirSync(root).filter((f) => f.endsWith('.js')),
  ...readdirSync(join(root, 'routes')).map((f) => `routes/${f}`),
  ...readdirSync(join(root, 'public')).filter((f) => f.endsWith('.js')).map((f) => `public/${f}`),
  'public/index.html',
];
const tooLong = APP_FILES
  .map((f) => ({ f, lines: readFileSync(join(root, f), 'utf8').split('\n').length }))
  .filter((x) => x.lines > LIMIT);
ok('no application file is past the split signal', tooLong.length === 0,
  tooLong.map((x) => `${x.f} is ${x.lines} lines`).join('; '));
ok('every route module is small enough to read in one sitting',
  readdirSync(join(root, 'routes')).every((f) =>
    readFileSync(join(root, 'routes', f), 'utf8').split('\n').length <= 200),
  'a route file past 200 lines is probably two screens sharing a file');

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

// --------------------------------------- what the owner's machine taught us
// Four failures, one per section below. Each assertion is written so that it
// fails again if the fix is taken out — a green run here means something.
console.log('\nPhase 15 — find it');

// A machine and two jobs whose words nothing else in the database uses, so a
// search assertion cannot pass on somebody else's row.
const press = await c2('/api/equipment', {
  method: 'POST',
  body: { name: 'Searchable Press', asset_tag: 'SRCH-77', location: 'Bay 9', category: 'Pressing' },
});
const hose = await c2('/api/work-orders', {
  method: 'POST', body: { equipment_id: press.data.id, title: 'Hydraulic hose burst' },
});
const flywheel = await c2('/api/work-orders', {
  method: 'POST', body: { equipment_id: press.data.id, title: 'Noise from flywheel' },
});
await c2(`/api/work-orders/${flywheel.data.id}`, { method: 'PATCH', body: { status: 'done' } });

// FIND-01 — one box over the problem, the notes and the machine's name.
const byProblem = await c2('/api/work-orders?q=hose');
ok('search finds a job by a word in its title',
  byProblem.data.length === 1 && byProblem.data[0].title === 'Hydraulic hose burst',
  JSON.stringify(byProblem.data.map((w) => w.title)));
const byMachineName = await c2('/api/work-orders?q=Searchable');
ok('search finds jobs through the machine they belong to',
  byMachineName.data.length === 2, `${byMachineName.data.length} rows`);
const shouting = await c2('/api/work-orders?q=HYDRAULIC');
ok('search ignores case', shouting.data.length === 1, `${shouting.data.length} rows`);
const wildcard = await c2('/api/work-orders?q=%25');
ok('a percent sign searches for a percent sign, not for everything',
  wildcard.data.length === 0, `${wildcard.data.length} rows matched a wildcard`);

const machineByTag = await c2('/api/equipment?q=SRCH-77');
ok('machines can be found by asset tag', machineByTag.data.length === 1,
  `${machineByTag.data.length} rows`);
const machineByPlace = await c2('/api/equipment?q=Bay%209');
ok('machines can be found by where they are', machineByPlace.data.length === 1,
  `${machineByPlace.data.length} rows`);

// FIND-02 — search composes with the filters that already existed.
const composed = await c2('/api/work-orders?q=hose&status=done');
ok('search composes with the status filter',
  composed.data.length === 0, `${composed.data.length} rows: the hose job is still open`);
const historySearch = await c2('/api/history?status=done&q=flywheel');
ok('search composes with the history screen',
  historySearch.data.rows.length === 1 && historySearch.data.rows[0].title === 'Noise from flywheel',
  JSON.stringify(historySearch.data.rows.map((r) => r.title)));
const historyBoth = await c2('/api/history?status=done&q=flywheel&from=2020-01-01&to=2020-12-31');
ok('search and a date range narrow together',
  historyBoth.data.total === 0, `${historyBoth.data.total} rows`);

// FIND-03 — the file is the screen's query with another output.
const searchedScreen = await c2('/api/work-orders?q=hose');
// A text client of our own: makeTextClient signs in and keeps the cookie, which
// is the only way to fetch a file endpoint from here.
const csvForSearch = makeTextClient({ email: 'admin@local', password: 'smoke-test-password' });
const searchedCsvText = (await csvForSearch('/api/export/work-orders.csv?q=hose')).text;
const csvRows = parseCsv(searchedCsvText).slice(1);
ok('the work-order export applies the same search as the screen',
  csvRows.length === searchedScreen.data.length && searchedCsvText.includes('Hydraulic hose burst')
  && !searchedCsvText.includes('Noise from flywheel'),
  `${csvRows.length} csv rows vs ${searchedScreen.data.length} on screen`);

// FIND-04 — "nothing matched" is not "there is nothing".
ok('a search with no hits says so instead of showing an empty list',
  /Nothing matches "/.test(clientSrc)
  && /Nothing in this filter matches "/.test(readFileSync(join(root, 'public', 'machines.js'), 'utf8'))
  && /Nothing closed matches "/.test(readFileSync(join(root, 'public', 'history.js'), 'utf8')),
  'one of the three search empty states is missing');

console.log('\nPhase 16 — what it cost');

const month = new Date().toISOString().slice(0, 7);

// COST-01 — hours are recorded, and nonsense is refused with a sentence.
const pump = await c2('/api/equipment', { method: 'POST', body: { name: 'Costed pump' } });
const pumpJob = await c2('/api/work-orders', {
  method: 'POST', body: { equipment_id: pump.data.id, title: 'Seal replacement' },
});
const negativeHours = await c2(`/api/work-orders/${pumpJob.data.id}`, {
  method: 'PATCH', body: { labour_hours: -2 },
});
ok('negative hours are refused in words',
  negativeHours.status === 400 && /cannot be negative/.test(negativeHours.data.error || ''),
  JSON.stringify(negativeHours.data));
const sillyHours = await c2(`/api/work-orders/${pumpJob.data.id}`, {
  method: 'PATCH', body: { labour_hours: 'ages' },
});
ok('hours that are not a number are refused',
  sillyHours.status === 400 && /must be a number/.test(sillyHours.data.error || ''),
  JSON.stringify(sillyHours.data));
const withHours = await c2(`/api/work-orders/${pumpJob.data.id}`, {
  method: 'PATCH', body: { labour_hours: 2.5 },
});
ok('hours are stored and come back', Number(withHours.data.labour_hours) === 2.5,
  JSON.stringify(withHours.data.labour_hours));

// The rate is a setting, so it can be fixed without a deploy.
// A fresh technician: the one from phase 4 was disabled on purpose, and its
// client is dead now. Using it here would test the wrong thing twice over.
await c('/api/users', { method: 'POST', body: {
  name: 'Ratechecker', email: 'rate@local', password: 'rate-password', role: 'technician' } });
const rateTech = makeClient();
await rateTech('/api/login', { method: 'POST', body: {
  email: 'rate@local', password: 'rate-password' } });
const rateForTech = await rateTech('/api/settings', { method: 'PUT', body: { hourly_rate: 40 } });
ok('only an admin can change the hourly rate', rateForTech.status === 403,
  `status ${rateForTech.status}`);
const negativeRate = await c2('/api/settings', { method: 'PUT', body: { hourly_rate: -5 } });
ok('a negative hourly rate is refused',
  negativeRate.status === 400 && /cannot be negative/.test(negativeRate.data.error || ''),
  JSON.stringify(negativeRate.data));
const setRate = await c2('/api/settings', { method: 'PUT', body: { hourly_rate: 40 } });
const readRate = await c2('/api/settings');
ok('the hourly rate is saved and read back',
  setRate.status === 200 && Number(readRate.data.hourly_rate) === 40,
  JSON.stringify(readRate.data));

// COST-02 — a job costs its parts plus its hours at that rate.
const costedPart = await c2('/api/parts', {
  method: 'POST', body: { name: 'Seal kit', qty: 10, unit_price: 12.5 },
});
await c2(`/api/work-orders/${pumpJob.data.id}/parts`, {
  method: 'POST', body: { part_id: costedPart.data.id, qty: 2 },
});
await c2(`/api/work-orders/${pumpJob.data.id}`, { method: 'PATCH', body: { status: 'done' } });
const costedList = await c2('/api/work-orders');
const costed = costedList.data.find((w) => w.id === pumpJob.data.id);
// 2.5 h x 40 = 100 of labour, 2 x 12.5 = 25 of parts.
ok('a job costs parts plus hours at the configured rate',
  costed && Number(costed.cost) === 125, `cost ${costed && costed.cost}, expected 125`);

// COST-03 — one month, added up.
const report = await c2(`/api/report?month=${month}`);
ok('the report answers for a month',
  report.status === 200 && report.data.month === month, JSON.stringify(report.data).slice(0, 120));
ok('the report counts the jobs, hours, parts and labour at the rate',
  report.data.jobs >= 1 && report.data.hours >= 2.5 && report.data.parts_cost >= 25
  && Number(report.data.labour_cost) === Math.round(report.data.hours * 40 * 100) / 100
  && Number(report.data.total)
     === Math.round((report.data.parts_cost + report.data.labour_cost) * 100) / 100,
  JSON.stringify(report.data).slice(0, 200));
ok('the report names the machines that took the most work',
  report.data.machines.some((m) => m.name === 'Costed pump'),
  JSON.stringify(report.data.machines.map((m) => m.name)));
const badMonth = await c2('/api/report?month=November');
ok('a month that is not YYYY-MM is a readable 400',
  badMonth.status === 400 && /YYYY-MM/.test(badMonth.data.error || ''),
  JSON.stringify(badMonth.data));
const emptyMonth = await c2('/api/report?month=1990-01');
ok('a month with nothing in it is zeroes, not an error',
  emptyMonth.status === 200 && emptyMonth.data.jobs === 0 && emptyMonth.data.total === 0,
  JSON.stringify(emptyMonth.data).slice(0, 120));

// COST-04 — the file is the screen's numbers.
const reportCsv = (await csvForSearch(`/api/export/report.csv?month=${month}`)).text;
const reportRows = parseCsv(reportCsv).slice(1);
const totalRow = reportRows.find((r) => r[1] === 'All machines');
ok('the report exports with a total row that matches the screen',
  Boolean(totalRow) && Number(totalRow[2]) === report.data.jobs
  && Number(totalRow[4]) === Number(report.data.parts_cost),
  `csv total row: ${JSON.stringify(totalRow)}`);
ok('the report is a screen with its own export',
  appUrl.includes("{ key: 'report', label: 'Report' }")
  && /downloadReport/.test(readFileSync(join(root, 'public', 'report.js'), 'utf8')),
  'no sidebar entry or no export');

console.log('\nPhase 14 — the record');

// A machine and two jobs of our own, so nothing here depends on what earlier
// phases happened to leave behind.
const histMachine = await c2('/api/equipment', {
  method: 'POST', body: { name: 'History lathe' },
});
const histId = histMachine.data.id;
const stillOpen = await c2('/api/work-orders', {
  method: 'POST', body: { equipment_id: histId, title: 'Spindle noise' },
});
const toClose = await c2('/api/work-orders', {
  method: 'POST', body: { equipment_id: histId, title: 'Oil leak' },
});
await c2(`/api/work-orders/${toClose.data.id}`, { method: 'PATCH', body: { status: 'done' } });

// HIST-01 — a machine's own history includes the job that is still running.
const machineHistory = await c2(`/api/history?equipment_id=${histId}`);
ok('a machine lists every job against it, open ones included',
  machineHistory.status === 200 && machineHistory.data.rows.length === 2,
  `got ${machineHistory.data.rows?.length} rows`);
ok('the history row carries the machine name and the dates',
  machineHistory.data.rows.every((r) => r.equipment_name === 'History lathe' && r.created_at)
  && machineHistory.data.rows.some((r) => r.closed_at),
  JSON.stringify(machineHistory.data.rows?.[0]));

// HIST-02 — the screen asks for closed work only, and gets it.
const closedOnly = await c2(`/api/history?status=done&equipment_id=${histId}`);
ok('the History screen shows closed jobs only',
  closedOnly.data.rows.length === 1 && closedOnly.data.rows[0].title === 'Oil leak',
  JSON.stringify(closedOnly.data.rows));

// HIST-03 — a date range narrows the list, and a bad date is a sentence.
const excluding = await c2(`/api/history?status=done&equipment_id=${histId}&from=2020-01-01&to=2020-12-31`);
ok('a range that excludes the job returns nothing, and says the total is zero',
  excluding.data.total === 0 && excluding.data.rows.length === 0,
  JSON.stringify(excluding.data));
const including = await c2(`/api/history?status=done&equipment_id=${histId}&from=2020-01-01&to=2999-12-31`);
ok('a range that includes the job returns it',
  including.data.total === 1 && including.data.rows.length === 1,
  JSON.stringify(including.data));
ok('the response says how many were shown as well as how many exist',
  including.data.shown === including.data.rows.length
  && typeof including.data.total === 'number');
const badDate = await c2('/api/history?from=yesterday');
ok('a malformed date is a readable 400, not a 500',
  badDate.status === 400 && /YYYY-MM-DD/.test(badDate.data.error || ''),
  `${badDate.status} ${JSON.stringify(badDate.data)}`);
const impossible = await c2('/api/history?from=2026-02-30');
ok('an impossible date is refused rather than rolled into March',
  impossible.status === 400 && /real calendar date/.test(impossible.data.error || ''),
  JSON.stringify(impossible.data));
const reversed = await c2('/api/history?from=2026-12-01&to=2026-01-01');
ok('a range that ends before it starts is refused',
  reversed.status === 400 && /after its end/.test(reversed.data.error || ''),
  JSON.stringify(reversed.data));
const unknownMachine = await c2('/api/history?equipment_id=999999');
ok('a machine with nothing in it is an empty list, not an error',
  unknownMachine.status === 200 && unknownMachine.data.rows.length === 0
  && unknownMachine.data.total === 0);

// HIST-04 — three different situations, three different sentences. A screen
// that says "nothing closed" when the request failed is lying.
const histSrc = readFileSync(join(root, 'public', 'history.js'), 'utf8');
ok('an empty machine, an empty range and a failed load read differently',
  /Nothing has been reported against/.test(histSrc)
  && /Nothing was closed between those dates/.test(histSrc)
  && /Could not load the history/.test(histSrc),
  'one of the three empty states is missing');
ok('the history screen is reachable and the machine row opens it',
  appUrl.includes("{ key: 'history', label: 'History' }")
  && /openMachineHistory\(\$\{machine\.id\}/.test(clientSrc),
  'no sidebar entry or no way in from a machine');

console.log('\nMachines — who may edit, and where the state comes from');

// Until 261106-eqs a machine's state was a field on an edit form, so two things
// could be true at once: a job saying "being replaced" and a badge saying "down"
// because nobody went back to the second screen. The state is now derived from
// the work orders (app/status.js), an administrator is the only person who may
// correct what is recorded, and the photograph is a real file beside the database.

const machineById = async (machineId) =>
  (await c('/api/equipment')).data.find((e) => e.id === machineId) || {};

// ---- the record itself ----------------------------------------------------
const fixable = await c('/api/equipment', { method: 'POST', body: {
  name: 'Forklift typo', asset_tag: 'FL-9', category: 'forklift', location: 'Bay 9' } });
ok('a new machine is running — nothing has gone wrong with it yet',
  fixable.data.status === 'active', `status=${fixable.data.status}`);

const fixed = await c(`/api/equipment/${fixable.data.id}`, { method: 'PUT', body: {
  name: 'Forklift A', asset_tag: 'FL-001', category: 'Handling', location: 'Bay 1',
  manufacturer: 'Toyota', notes: 'Mast repaired in March' } });
ok('a machine can be renamed', fixed.data.name === 'Forklift A', String(fixed.data.name));
ok('the whole record is corrected, not just the name',
  fixed.data.asset_tag === 'FL-001' && fixed.data.category === 'Handling'
  && fixed.data.location === 'Bay 1' && fixed.data.notes === 'Mast repaired in March',
  JSON.stringify(fixed.data));
ok('the barcode is stored and comes back', fixed.data.asset_tag === 'FL-001',
  String(fixed.data.asset_tag));
ok('the manufacturer is stored and comes back',
  fixed.data.manufacturer === 'Toyota', String(fixed.data.manufacturer));
ok('the search sees the new name at once',
  (await c('/api/equipment?q=Forklift')).data.some((e) => e.name === 'Forklift A'));
ok('the response says what is stored and what is derived',
  fixed.data.service_status === 'active' && fixed.data.status === 'active',
  JSON.stringify({ service_status: fixed.data.service_status, status: fixed.data.status }));

const nameless = await c(`/api/equipment/${fixable.data.id}`, { method: 'PUT', body: { name: '   ' } });
ok('a machine cannot be renamed to nothing',
  nameless.status === 400 && /required/i.test(nameless.data.error || ''), JSON.stringify(nameless));
ok('editing a machine that is gone is a 404',
  (await c('/api/equipment/999999', { method: 'PUT', body: { name: 'Ghost' } })).status === 404);

// ---- the state cannot be typed -------------------------------------------
const typed = await c(`/api/equipment/${fixable.data.id}`, { method: 'PUT', body: { status: 'down' } });
ok('a machine cannot simply be marked down', typed.status === 400, JSON.stringify(typed.data));
ok('the refusal sends the reader to the work order, not the field',
  /work order/i.test(typed.data.error || ''), String(typed.data.error));
ok('an unknown state is refused too',
  (await c(`/api/equipment/${fixable.data.id}`, { method: 'PUT', body: { status: 'broken' } })).status === 400);
ok('retiring is still an administrator decision',
  (await c(`/api/equipment/${fixable.data.id}`, { method: 'PUT', body: { status: 'retired' } }))
    .data.status === 'retired');
await c(`/api/equipment/${fixable.data.id}`, { method: 'PUT', body: { status: 'active' } });

// ---- the state follows the work orders ------------------------------------
const statusOf = async (machineId) => (await machineById(machineId)).status;
const whyOf = async (machineId) => String((await machineById(machineId)).status_reason || '');
const job = async (body) => (await c('/api/work-orders', { method: 'POST', body })).data;
const setJob = (jobId, body) => c(`/api/work-orders/${jobId}`, { method: 'PATCH', body });

const urgent = await job({ equipment_id: fixable.data.id, title: 'Mast cracked', priority: 'high' });
ok('a high-priority job that is still open puts the machine down',
  (await statusOf(fixable.data.id)) === 'down', `status=${await statusOf(fixable.data.id)}`);
ok('and the list says which job did it',
  /Mast cracked/.test(await whyOf(fixable.data.id)), await whyOf(fixable.data.id));
ok('the dashboard counts the same machine as down',
  (await c('/api/dashboard')).data.machines.items.some((m) => m.id === fixable.data.id),
  'the card and the list disagree about a machine');

await setJob(urgent.id, { status: 'done' });
ok('closing that job brings the machine back to running',
  (await statusOf(fixable.data.id)) === 'active', `status=${await statusOf(fixable.data.id)}`);

const routine = await job({ equipment_id: fixable.data.id, title: 'Vent filter change', priority: 'low' });
ok('a low-priority job that is only open does not stop production',
  (await statusOf(fixable.data.id)) === 'active', `status=${await statusOf(fixable.data.id)}`);
await setJob(routine.id, { status: 'in_progress' });
ok('but a job somebody is working on right now does',
  (await statusOf(fixable.data.id)) === 'down', `status=${await statusOf(fixable.data.id)}`);
ok('the reason names the work in progress',
  /Vent filter change/.test(await whyOf(fixable.data.id)), await whyOf(fixable.data.id));
await setJob(routine.id, { status: 'done' });

const elsewhere = await job({ equipment_id: fixable.data.id, title: 'Been replaced', priority: 'high' });
ok('a retired machine reads retired, not down, even with a job on it',
  (await c(`/api/equipment/${fixable.data.id}`, { method: 'PUT', body: { status: 'retired' } }))
    .data.status === 'retired');
await c(`/api/equipment/${fixable.data.id}`, { method: 'PUT', body: { status: 'active' } });
ok('restoring it does not hide the job that is still open',
  (await statusOf(fixable.data.id)) === 'down', `status=${await statusOf(fixable.data.id)}`);
await setJob(elsewhere.id, { status: 'done' });

// ---- a technician keeps the doors they need ------------------------------
await c('/api/users', { method: 'POST', body: {
  name: 'Shop floor', email: 'shop@local', password: 'shop-password', role: 'tech' } });
const shop = makeClient();
await shop('/api/login', { method: 'POST', body: { email: 'shop@local', password: 'shop-password' } });

const techEdit = await shop(`/api/equipment/${fixable.data.id}`, { method: 'PUT', body: { name: 'Nope' } });
ok('a technician cannot edit a machine', techEdit.status === 403, `status ${techEdit.status}`);
ok('a technician cannot upload a photograph — the route is shut before the bytes are read',
  (await shop(`/api/equipment/${fixable.data.id}/photo`, {
    method: 'POST', contentType: 'image/jpeg',
    rawBody: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]) })).status === 403);
ok('a technician cannot remove a photograph',
  (await shop(`/api/equipment/${fixable.data.id}/photo`, { method: 'DELETE' })).status === 403);
ok('a technician cannot retire a machine',
  (await shop(`/api/equipment/${fixable.data.id}`, { method: 'PUT', body: { status: 'retired' } })).status === 403);
const techAdded = await shop('/api/equipment', { method: 'POST', body: { name: 'Press 3' } });
ok('but a technician can still add a machine', techAdded.status === 201, `status ${techAdded.status}`);
ok('and can still report a job on it',
  (await shop('/api/work-orders', { method: 'POST', body: {
    equipment_id: techAdded.data.id, title: 'Guard loose', priority: 'high' } })).status === 201);
ok('which is enough to take that machine out of service',
  (await machineById(techAdded.data.id)).status === 'down');

// ---- the photograph is a file, and the server decides what it is ----------
const photosDir = join(root, 'data', 'photos');
const photoCount = () => (existsSync(photosDir) ? readdirSync(photosDir).length : 0);
const jpegBytes = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(600, 7), Buffer.from([0xff, 0xd9])]);

ok('a machine with no photograph says so',
  (await c(`/api/equipment/${fixable.data.id}/photo`)).status === 404);
const beforePhoto = photoCount();
const shot = await c(`/api/equipment/${fixable.data.id}/photo`, {
  method: 'POST', contentType: 'image/jpeg', rawBody: jpegBytes });
ok('a photograph can be attached', shot.status === 200, JSON.stringify(shot.data));
ok('the stored name is not the one the client would have sent',
  Boolean(shot.data.photo) && !/jpegBytes|photo\.jpg/.test(shot.data.photo), String(shot.data.photo));
const fetched = await c(`/api/equipment/${fixable.data.id}/photo`);
ok('it comes back byte for byte', fetched.status === 200 && fetched.bytes.equals(jpegBytes),
  `${fetched.status}, ${fetched.bytes.length} bytes`);
ok('it comes back as an image, not as JSON',
  /^image\//.test(String(fetched.headers.get('content-type'))), String(fetched.headers.get('content-type')));
ok('the list now says the machine has a photograph',
  Boolean((await machineById(fixable.data.id)).photo));

const replaced = await c(`/api/equipment/${fixable.data.id}/photo`, {
  method: 'POST', contentType: 'image/png',
  rawBody: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 1)]) });
ok('replacing it is allowed', replaced.status === 200, JSON.stringify(replaced.data));
ok('and leaves one file behind, not two', photoCount() === beforePhoto + 1,
  `${beforePhoto} -> ${photoCount()}`);

const textAsJpeg = await c(`/api/equipment/${fixable.data.id}/photo`, {
  method: 'POST', contentType: 'image/jpeg',
  rawBody: Buffer.from('this is not an image, whatever the header says') });
ok('text sent as a JPEG is refused on its bytes, not its header',
  textAsJpeg.status === 400 && /JPEG, PNG or WebP/.test(textAsJpeg.data.error || ''),
  JSON.stringify(textAsJpeg.data));

const huge = await c(`/api/equipment/${fixable.data.id}/photo`, {
  method: 'POST', contentType: 'image/jpeg',
  rawBody: Buffer.concat([jpegBytes, Buffer.alloc(3 * 1024 * 1024, 0)]) });
ok('a photograph over the cap is refused with 413, not buffered',
  huge.status === 413, `status ${huge.status}`);

ok('the photograph can be removed without touching the record',
  (await c(`/api/equipment/${fixable.data.id}/photo`, { method: 'DELETE' })).status === 200
  && !(await machineById(fixable.data.id)).photo);
ok('and the file goes with it', photoCount() === beforePhoto, String(photoCount()));

await c(`/api/equipment/${fixable.data.id}/photo`, {
  method: 'POST', contentType: 'image/jpeg', rawBody: jpegBytes });
const storedName = (await machineById(fixable.data.id)).photo;
await c(`/api/equipment/${fixable.data.id}`, { method: 'DELETE' });
ok('deleting a machine deletes its photograph',
  !storedName || !existsSync(join(photosDir, storedName)), String(storedName));
await c(`/api/equipment/${techAdded.data.id}`, { method: 'DELETE' });

// The delete dialog tells the reader that the work orders, the maintenance and the
// photograph go with the machine. That promise is checked here, because a dialog
// that overstates what it destroys is worse than no dialog at all.
const doomed = (await c('/api/equipment', { method: 'POST', body: { name: 'Doomed press' } })).data;
const doomedJob = (await c('/api/work-orders', { method: 'POST', body: {
  equipment_id: doomed.id, title: 'Scrap it', priority: 'low' } })).data;
const doomedPm = (await c('/api/pm', { method: 'POST', body: {
  equipment_id: doomed.id, task: 'Last grease', interval_days: 30 } })).data;
ok('a machine can have a job and a schedule before it is deleted',
  Boolean(doomedJob.id) && Boolean(doomedPm.id));
await c(`/api/equipment/${doomed.id}`, { method: 'DELETE' });
ok('deleting a machine deletes its work orders — as the dialog promises',
  (await c('/api/work-orders')).data.every((w) => w.equipment_id !== doomed.id));
ok('and its maintenance schedules',
  (await c('/api/pm')).data.every((p) => p.equipment_id !== doomed.id));

// ---- retired machines stay out of the way ---------------------------------
// Retiring used to be a label. It is still not deletion — every job, photograph
// and history entry stays — but a machine that has left is no longer offered when
// new work is started, and the everyday list stops showing it.
const scrapped = (await c('/api/equipment', { method: 'POST', body: {
  name: 'Old press (scrapped)', asset_tag: 'OP-1', category: 'Pressing' } })).data;
// The maintenance schedule is created *before* the machine leaves, on purpose. The
// first version created it afterwards, which meant a retirement that deleted the
// schedule would have been invisible — the mutation run proved it could not fail.
const parked = await c('/api/pm', { method: 'POST', body: {
  equipment_id: scrapped.id, task: 'Grease the ways', interval_days: 30, next_due: '2020-01-01' } });
ok('a machine in service carries a maintenance schedule', parked.status === 201,
  `status ${parked.status}`);
await c(`/api/equipment/${scrapped.id}`, { method: 'PUT', body: { status: 'retired' } });

const everyMachine = (await c('/api/equipment')).data;
const inService = (await c('/api/equipment?service=active')).data;
ok('a retired machine is not offered as a machine in service',
  !inService.some((e) => e.id === scrapped.id), 'it was still in the list new work is started from');
ok('but it has not been deleted: it is still in the full list',
  everyMachine.some((e) => e.id === scrapped.id));
ok('the two lists differ by exactly the retired machines',
  everyMachine.length - inService.length === everyMachine.filter((e) => e.status === 'retired').length,
  `${everyMachine.length} - ${inService.length}`);
ok('?service=all means everything, like no parameter at all',
  (await c('/api/equipment?service=all')).data.length === everyMachine.length);
// "contains the machine" was not enough: the unfiltered list contains it too, so
// the check passed with the clause deleted. It has to be the retired ones *only*.
const onlyRetired = (await c('/api/equipment?service=retired')).data;
ok('?service=retired answers with the ones that left, and only those',
  onlyRetired.length > 0 && onlyRetired.every((e) => e.status === 'retired')
  && onlyRetired.some((e) => e.id === scrapped.id),
  onlyRetired.map((e) => `${e.name}:${e.status}`).join(', '));
ok('the service filter composes with the search box',
  !(await c('/api/equipment?service=active&q=scrapped')).data.some((e) => e.id === scrapped.id)
  && (await c('/api/equipment?service=all&q=scrapped')).data.some((e) => e.id === scrapped.id));
ok('the retired machine keeps its history',
  (await c(`/api/history?equipment_id=${scrapped.id}`)).status === 200);

// Maintenance stops too. A machine that has left must not keep generating "grease
// it on Tuesday" tasks — the schedule is parked, not deleted, so restoring the
// machine brings the reminders back.
const dueAll = (await c('/api/pm/due?days=45')).data;
const dueActive = (await c('/api/pm/due?days=45&service=active')).data;
ok('but it is not on the list of what is due',
  !dueActive.some((p) => p.id === parked.data.id) && dueAll.some((p) => p.id === parked.data.id),
  `${dueAll.length} due in total, ${dueActive.length} in service`);
ok('nor on the maintenance list',
  !(await c('/api/pm?service=active')).data.some((p) => p.id === parked.data.id)
  && (await c('/api/pm')).data.some((p) => p.id === parked.data.id));
const cardAfterParking = (await c('/api/dashboard')).data.due_soon;
ok('nor in the dashboard due-soon card',
  !cardAfterParking.items.some((p) => p.equipment_name === 'Old press (scrapped)'),
  cardAfterParking.items.map((p) => p.equipment_name).join(', '));
await c(`/api/equipment/${scrapped.id}`, { method: 'PUT', body: { status: 'active' } });
ok('restoring it puts it back in service',
  (await c('/api/equipment?service=active')).data.some((e) => e.id === scrapped.id));
ok('and its maintenance comes back with it — nothing was deleted',
  (await c('/api/pm/due?days=45&service=active')).data.some((p) => p.id === parked.data.id)
  && (await c('/api/dashboard')).data.due_soon.items
    .some((p) => p.equipment_name === 'Old press (scrapped)'));
await c(`/api/equipment/${scrapped.id}`, { method: 'PUT', body: { status: 'retired' } });
await c(`/api/pm/${parked.data.id}/done`, { method: 'POST', body: { on: '2020-01-02' } });

// ---- what the screen does, read as text (no browser exists here) ---------
const appEq = readFileSync(join(root, 'public', 'machines.js'), 'utf8');
const indexEq = readFileSync(join(root, 'public', 'index.html'), 'utf8');
const editFn = (appEq.match(/export function editEquipment\([\s\S]*?\n\}/) || [''])[0];
const saveFn = (appEq.match(/export async function saveEquipment\(\) \{[\s\S]*?\n\}/) || [''])[0];
const actionsFn = (appEq.match(/function actions\(machine\) \{[\s\S]*?\n\}/) || [''])[0];

// Prose is not behaviour: an assertion that reads raw source cannot tell a rule
// from a comment describing it, and one of the checks below failed on exactly
// that. Comments come out before the code assertions run.
const codeOnly = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

ok('every machine row offers Edit',
  /onclick="editEquipment\(\$\{machine\.id\}\)"/.test(appEq), 'no control, no edit');
ok('the edit form carries every field a machine has',
  ['ee-name', 'ee-tag', 'ee-maker', 'ee-cat', 'ee-loc', 'ee-notes', 'ee-id', 'ee-photo']
    .every((f) => indexEq.includes(`id="${f}"`)),
  'a field missing from the form is a field nobody can correct');
// Scoped to the dialog: the Machines toolbar legitimately offers a "Down right now"
// filter now, and a page-wide search for `<option value="down">` would call that a
// status field. The question is what the editor can set.
{
  const editor = (indexEq.match(/<dialog id="equipment-edit"[\s\S]*?<\/dialog>/) || [''])[0];
  // One field, one name, one example. The creating form called it "Asset tag" and the
// editor called it "Barcode" — the same column, described two ways in two dialogs a
// click apart; and both showed MM-014 while the labels on machines are numbers.
ok('both machine forms call the same field a barcode and show the same example',
  (indexEq.match(/<span>Barcode<\/span><input id="e-tag" placeholder="e\.g\. 101220054"/g) || []).length === 1
  && (indexEq.match(/<span>Barcode<\/span><input id="ee-tag" placeholder="e\.g\. 101220054"/g) || []).length === 1
  && !/Asset tag/.test(indexEq),
  'the two dialogs describe the same column differently');
ok('the machine editor carries no status control at all',
    editor.length > 0 && !editor.includes('id="ee-status"')
    && !/<select/.test(editor) && !/<option/.test(editor),
    editor ? 'the editor can still set a status' : 'the editor dialog is gone');
}
ok('the editor says where the state comes from', /work orders/i.test(indexEq));
ok('the form is filled from the row that was clicked, not from a second request',
  editFn.includes('equipmentRows.find') && editFn.includes('#ee-name')
  && editFn.includes('#ee-maker') && editFn.includes("openForm('equipment-edit')"),
  editFn ? 'prefill missing' : 'editEquipment() is not defined');
ok('saving sends a PUT for that machine, without a status',
  /method: 'PUT'/.test(saveFn) && /\/equipment\/\$\{machineId\}/.test(saveFn)
  && !/\bstatus\s*:/.test(codeOnly(saveFn)),
  saveFn ? 'wrong verb, wrong URL, or a status still being sent' : 'no saveEquipment()');
ok('saving refuses an empty name before it reaches the server',
  /formError\('equipment-edit'/.test(saveFn) && /!name/.test(saveFn));
ok('saving sends the photograph when one was chosen',
  /uploadPhoto\(machineId, file\)/.test(saveFn), saveFn ? 'chosen file dropped' : 'no saveEquipment()');
ok('a photograph over 2 MB is refused in the browser too',
  /2 \* 1024 \* 1024/.test(appEq));
ok('the photograph is uploaded as bytes to the machine\'s own route',
  /\/api\/equipment\/\$\{machineId\}\/photo/.test(appEq));
ok('the row shows a thumbnail from the photo route', /\/photo/.test(appEq) && /class="thumb"/.test(appEq));
ok('the row explains why a machine is down', appEq.includes('status_reason'));
// Category, location and the photograph are columns now, not a smaller line under
// the name. The header is read once and every claim is made against it, including
// the one that can silently break: the empty row's colspan.
const eqHead = (indexEq.match(/<thead><tr><th class="cell-thumb">Photo<\/th>[\s\S]*?<\/tr><\/thead>/) || [''])[0];
ok('the machine table names every column it shows',
  ['Name', 'Barcode', 'Manufacturer', 'Category', 'Location', 'Status']
    .every((name) => eqHead.includes(`>${name}</th>`)) && eqHead.includes('>Photo</th>'),
  eqHead || 'the machines header is not where it was');
// With real columns, a second line under the name would print the same fact twice.
// A mutation that restored it passed every other check, so the name cell is named.
ok('everything about a machine sits behind three dots',
  appEq.includes('<details class="row-menu">') && appEq.includes('aria-label="Actions for')
  && appEq.includes('&#8943;'), 'the row still shows a row of buttons');
ok('and the menu holds edit, history, retire and delete',
  ['editEquipment', 'openMachineHistory', 'toggleStatus', 'openEquipmentDelete']
    .every((fn) => actionsFn.includes(fn))
  && ['Edit machine', 'History', 'Retire machine', 'Delete machine']
    .every((label) => appEq.includes(label)), 'an action went missing from the menu');
ok('delete is the red item in it',
  /class="danger" onclick="openEquipmentDelete/.test(appEq)
  && /\.row-menu \.menu button\.danger\s*\{[^}]*var\(--red\)/.test(uiCss),
  'a destructive item that looks like the others');
// A menu in the last row sits inside `.table-wrap`, which scrolls sideways and
// therefore clips its children. Fixed positioning is the fix; this checks the fix
// and the code that places it.
ok('the menu is not clipped by the table it lives in',
  /\.row-menu \.menu \{[^}]*position: fixed/.test(uiCss)
  && /getBoundingClientRect\(\)/.test(appEq) && /style\.top =/.test(appEq),
  'an absolutely positioned menu is clipped by the scrolling table');
ok('and it closes when the page moves under it',
  /addEventListener\('scroll', closeMenus, true\)/.test(appEq));
// The History dialog used to read the machine's name from the row\'s first cell.
// Since the photograph has that cell, it titled itself "A" for a pictureless machine.
ok('the history dialog reads the name column, not the first cell',
  /querySelector\('\.cell-strong'\)/.test(readFileSync(join(root, 'public', 'history.js'), 'utf8')),
  'the dialog is named after the photo cell');
ok('a menu closes when it is used and when you click away',
  /closest\('\.row-menu \.menu button'\)/.test(appEq)
  && /closest\('\.row-menu'\)/.test(appEq));

// ---- the sentence you have to type
const confirmFn = (appEq.match(/export async function confirmEquipmentDelete[\s\S]*?\n\}/) || [''])[0];
ok('deleting asks for a typed sentence, not just a click',
  indexEq.includes('id="equipment-delete"') && indexEq.includes('id="equipment-delete-confirm"')
  && indexEq.includes('id="equipment-delete-phrase"'),
  'the dialog cannot ask for what it does not have');
ok('the button is disabled until the sentence is typed',
  /id="equipment-delete-go"[^>]*disabled/.test(indexEq)
  && /\$\('#equipment-delete-go'\)\.disabled = true/.test(appEq));
ok('the sentence names the machine that will go',
  appEq.includes('delete machine ${machine.name}'), 'the sentence is not about this machine');
ok('typing is compared case- and space-insensitively, so the sentence still has to be the sentence',
  (appEq.match(/replace\(\/\\s\+\/g, ' '\)/g) || []).length >= 2,
  'one of the two comparisons is missing');
ok('confirming checks the sentence again before calling the server',
  confirmFn.includes("typed !== pendingDelete.phrase")
  && confirmFn.indexOf('removeEquipment(') > confirmFn.indexOf("typed !== pendingDelete.phrase"),
  confirmFn ? 'the server call comes first' : 'confirmEquipmentDelete() is not defined');
ok('the dialog counts what is about to be destroyed',
  appEq.includes('work order${jobs.length === 1') && appEq.includes('maintenance task${mine.length === 1'),
  'it says "everything" without saying how much');
ok('the name column carries only the name',
  /strong\(e\.name\)/.test(appEq) && !/strong\(e\.name,/.test(appEq),
  'category and location are shown twice');
ok('the row fills the category and location columns',
  appEq.includes('${soft(e.category)}${soft(e.location)}'),
  'the columns exist and the row leaves them empty');
ok('an empty table spans exactly the columns the header names',
  /emptyRow\(\d+,/.test(appEq)
  && appEq.includes(`emptyRow(${(eqHead.match(/<th[\s>]/g) || []).length},`),
  `header has ${(eqHead.match(/<th[\s>]/g) || []).length} columns`);
ok('Edit, Retire and Delete are drawn only for an admin',
  /const admin = window\.me\?\.role === 'admin'/.test(actionsFn)
  && actionsFn.includes('editEquipment') && actionsFn.includes('toggleStatus')
  && actionsFn.includes('openEquipmentDelete'), actionsFn ? 'no gate' : 'actions() is not defined');
ok('History is offered to everybody',
  !/admin \? `<button[^`]*openMachineHistory/.test(actionsFn) && actionsFn.includes('openMachineHistory'));
ok('the Machines screen filters by a named view, not a hidden-retired checkbox',
  /<select id="eq-filter" onchange="loadEquipment\(\)"/.test(indexEq)
  && !indexEq.includes('eq-show-retired'));
// `<option value="all">` no longer matches: the default is marked, so the test has
// to allow attributes after the value rather than assume an empty tag.
ok('the four views are in service, down, retired and everything',
  ['in', 'down', 'retired', 'all'].every((v) =>
    new RegExp(`<option value="${v}"[ >]`).test(indexEq)));
// It used to open on "In service", which meant a machine that had been retired was
// indistinguishable from a machine that had been deleted — and the machine somebody
// is asking about is exactly the one that stopped.
ok('it opens on every machine, not only the ones in service',
  /<select id="eq-filter"[^>]*>\s*<option value="all" selected>All machines<\/option>/.test(indexEq),
  (indexEq.match(/<select id="eq-filter"[^>]*>[\s\S]{0,200}/) || [''])[0].replace(/\s+/g, ' '));
ok('a view the select cannot name falls back to everything, not to in-service',
  appEq.includes('?? VIEWS.all'), 'the fallback is the old default');
ok('a retired machine is dimmed in the list rather than missing from it',
  appEq.includes("class=\"row-quiet\"") && /<tr\$\{/.test(appEq)
  && /\.row-quiet td \{ opacity/.test(uiCss),
  appEq.includes('row-quiet') ? 'no styling for the dimmed row' : 'retired rows are not marked');
ok('each view asks the server for the machines it names',
  ["in: { query: 'service=active'", "down: { query: 'service=active&status=down'",
    "retired: { query: 'service=retired'", "all: { query: 'service=all'"]
    .every((frag) => appEq.includes(frag)), 'a view with no query is a view that lies');
// The table of views is easy to assert and easy to leave unused: a mutation that
// replaced the lookup with `VIEWS.in` passed every check above. This one reads the
// lookup itself.
ok('the chosen view is the one that is used',
  appEq.includes("VIEWS[$('#eq-filter')?.value]"), 'the filter is defined and then ignored');
ok('a view that finds nothing says which view found nothing',
  ['Nothing is down right now.', 'No machines have been retired.']
    .every((line) => appEq.includes(line)));
// `status=down` on an empty database passes vacuously, so this makes a machine
// down first and checks it is found — and that the answer is not everything.
const blocked = (await c('/api/equipment', { method: 'POST', body: { name: 'Grinder (blocked)' } })).data;
await c('/api/work-orders', { method: 'POST', body: {
  equipment_id: blocked.id, title: 'Wheel guard missing', priority: 'high' } });
const downList = (await c('/api/equipment?status=down')).data;
ok('the API can be asked for the machines that are down',
  downList.some((e) => e.id === blocked.id) && downList.every((e) => e.status === 'down'),
  downList.map((e) => `${e.name}:${e.status}`).join(', '));
ok('and that answer is not the whole list',
  downList.length < (await c('/api/equipment')).data.length);
ok('a machine in service can still be down — the two filters ask different questions',
  (await c('/api/equipment?service=active')).data.some((e) => e.id === blocked.id)
  && (await c('/api/equipment?service=retired')).data.every((e) => e.status === 'retired'));
await c(`/api/equipment/${blocked.id}`, { method: 'DELETE' });   // takes its job with it
ok('the dropdowns that start new work never come from the filtered table',
  /const \[rows, inService\] = await Promise\.all/.test(appEq)
  && /inService\.map\(\(e\) => `<option/.test(appEq)
  && !/rows\.map\(\(e\) => `<option/.test(appEq), 'the search box still narrows the dropdowns');
ok('the due list asks only for machines in service',
  appSrc13.includes('service=active') && /\/pm\/due\?days=\$\{days\}&service=active/.test(appSrc13),
  'the due list still shows maintenance on machines that have left');
ok('the maintenance list asks the same way',
  appSrc13.includes("api('/pm?service=active')"), 'the two lists can disagree');
ok('and they ask for machines in service with no search term',
  /api\('\/equipment\?service=active'\)/.test(appEq));
ok('the app remembers who signed in', /window\.me = user/.test(
  readFileSync(join(root, 'public', 'app.js'), 'utf8')));
const equipmentSrc = codeOnly(readFileSync(join(root, 'routes', 'equipment.js'), 'utf8'));
const dashboardSrc = codeOnly(readFileSync(join(root, 'routes', 'dashboard.js'), 'utf8'));
ok('no route decides what "down" means for itself',
  !/['"]down['"]/.test(equipmentSrc) && !/["']down["']/.test(dashboardSrc)
  && /downMachines\(\)/.test(dashboardSrc),
  'a route still has its own opinion about what down means');

// ---- a database written by the old form ----------------------------------
// The engine of this test is the migration itself: put a machine back into the
// state the previous version could store, start the app against that file, and
// look at the row again.
{
  const legacyDb = join(root, 'data', 'legacy.db');
  rmSync(legacyDb, { force: true });
  const env = { ...process.env, MM_DB: legacyDb };
  spawnSync(process.execPath, ['--no-warnings=ExperimentalWarning', '-e', "import('./db.js')"],
    { cwd: root, env });
  const seed = new DatabaseSync(legacyDb);
  seed.prepare(`INSERT INTO equipment (name, status) VALUES ('Old press', 'down')`).run();
  seed.close();
  const started = spawnSync(process.execPath,
    ['--no-warnings=ExperimentalWarning', '-e', "import('./db.js')"], { cwd: root, env });
  const after = new DatabaseSync(legacyDb);
  const row = after.prepare(`SELECT status FROM equipment WHERE name = 'Old press'`).get();
  after.close();
  ok('a machine left "down" by the old form is released on start-up',
    row && row.status === 'active', row ? String(row.status) : 'row missing');
  ok('and the log says how many it fixed',
    /migrated: \d+ machine status/.test(String(started.stdout)),
    String(started.stdout).trim().split('\n').pop());
  const rerun = spawnSync(process.execPath,
    ['--no-warnings=ExperimentalWarning', '-e', "import('./db.js')"], { cwd: root, env });
  const again = new DatabaseSync(legacyDb);
  const stillThere = again.prepare(`SELECT status FROM equipment WHERE name = 'Old press'`).get();
  again.close();
  ok('running the migration again changes nothing and says nothing',
    stillThere.status === 'active' && !/machine status/.test(String(rerun.stdout)),
    String(rerun.stdout).trim());
  rmSync(legacyDb, { force: true });
}

console.log('\nDashboard — the last six months');

const chartPayload = await c('/api/dashboard');
const trend = chartPayload.data?.charts?.trend ?? [];
ok('the dashboard carries six months of history', trend.length === 6, `got ${trend.length}`);
const monthKeys = trend.map((m) => m.month);
ok('the months run oldest first',
  monthKeys.every((m, i) => i === 0 || m > monthKeys[i - 1]), monthKeys.join(','));
const currentMonth = new Date().toISOString().slice(0, 7);
ok('the last bar is the month we are in', monthKeys.at(-1) === currentMonth, monthKeys.at(-1));

// A bar and the Report screen must be the same arithmetic, or the dashboard is a
// second opinion about the owner's money. report.js builds both; this checks it.
const reportNow = await c(`/api/report?month=${currentMonth}`);
const barNow = trend.at(-1) || {};
ok('a bar equals the report for that month',
  Number(barNow.total) === Number(reportNow.data.total)
  && Number(barNow.closed) === Number(reportNow.data.jobs),
  `bar=${JSON.stringify(barNow)} report=${reportNow.data.total}/${reportNow.data.jobs}`);
ok('the month where a job was closed shows a bar above zero',
  Number(barNow.closed) > 0 && Number(barNow.total) > 0, JSON.stringify(barNow));

// The chart module builds strings and touches no DOM, so it can be checked here
// rather than hoped about. Geometry and escaping are the two ways a chart fails.
const charts = await import(pathToFileURL(join(root, 'public', 'charts.js')).href);
const sample = charts.stackedBars({
  labels: ['A', 'B'],
  series: [{ name: 'Jobs', values: [1, 4], tone: 'brand' }],
  title: 'sample',
});
const barHeights = [...sample.matchAll(/<rect[^>]*height="([\d.]+)"/g)].map((m) => Number(m[1]));
ok('a chart draws one bar per value', barHeights.length === 2, barHeights.join(','));
ok('the taller value draws the taller bar',
  barHeights.length === 2 && Math.abs(barHeights[1] / barHeights[0] - 4) < 0.02,
  barHeights.join(','));
ok('a month with nothing in it draws no bar',
  !/<rect/.test(charts.stackedBars({ labels: ['A'], series: [{ name: 'Jobs', values: [0] }] })));
const sneaky = charts.stackedBars({
  labels: ['<script>alert(1)</script>'],
  series: [{ name: '<b>name</b>', values: [1], tone: 'brand' }],
  title: '<img onerror=x>',
});
ok('a chart escapes every label it draws',
  !sneaky.includes('<script>') && !sneaky.includes('<b>') && !sneaky.includes('<img')
  && sneaky.includes('&lt;script&gt;'),
  sneaky.slice(0, 160));
ok('every bar names its own value for a screen reader',
  /<title>A — Jobs: 1<\/title>/.test(sample), 'a bar without a title is a rectangle');

const chartsSrc = readFileSync(join(root, 'public', 'charts.js'), 'utf8');
const dashClient = readFileSync(join(root, 'public', 'dashboard.js'), 'utf8');
ok('the chart module fetches nothing and ships no library',
  !/https?:\/\//.test(chartsSrc.replace(/\/\/[^\n]*/g, '')) && chartsSrc.split('\n').length < 200);
ok('the dashboard draws its charts from that module',
  /from '\.\/charts\.js'/.test(dashClient) && /stackedBars\(/.test(dashClient));

console.log('\nPersistence — a restart, a file copy, and a forgotten password');

// 1. Sessions are rows in the database. They used to be a Map in memory, so a
//    restart silently signed everybody out, and the owner read that as "the
//    password changed again".
const persistent = makeClient();
const beforeRestart = await persistent('/api/login', {
  method: 'POST', body: { email: 'admin@local', password: 'smoke-test-password' },
});
ok('admin is signed in before the restart', beforeRestart.status === 200,
  JSON.stringify(beforeRestart.data));
srv.child.kill('SIGKILL');
await srv.exited;
srv = start({ MM_ADMIN_PASSWORD: 'smoke-test-password' });
ok('server is back up', await waitForServer(), srv.log());
const stillIn = await persistent('/api/me');
ok('a signed-in session survives a hard restart', stillIn.status === 200,
  `got ${stillIn.status}: the browser is back on the login screen`);

// 2. maintain.db on its own must be a complete database. The owner's was 4,096
//    bytes with 78,312 bytes sitting in the side file, so copying it — to a USB
//    stick, a backup folder, anywhere — produced an empty database.
const marker = `Copy-me-${Date.now()}`;
await persistent('/api/equipment', { method: 'POST', body: { name: marker } });
const walSize = existsSync(DB + '-wal') ? statSync(DB + '-wal').size : 0;
ok('a save is merged into maintain.db, not left in the side file', walSize === 0,
  `${DB}-wal is ${walSize} bytes: a copy of maintain.db alone would be incomplete`);
const copiedAlone = join(root, 'data', 'copied-alone.db');
copyFileSync(DB, copiedAlone);
const alone = new DatabaseSync(copiedAlone, { readOnly: true });
const foundInCopy = alone.prepare('SELECT COUNT(*) AS n FROM equipment WHERE name = ?')
  .get(marker).n;
alone.close();
rmSync(copiedAlone, { force: true });
ok('a copy of maintain.db alone still contains the data', foundInCopy === 1,
  'the copy was empty, which is exactly what a naive backup used to produce');

// 3. The first password is written beside the database, so closing the console
//    window cannot lose it. It was printed once and never stored anywhere.
const note = join(root, 'data', 'first-password.txt');
ok('the first password is kept beside the database',
  existsSync(note) && readFileSync(note, 'utf8').includes('smoke-test-password'),
  existsSync(note) ? 'the file exists but does not hold the password' : 'no first-password.txt');
const changed = await persistent('/api/users/1', {
  method: 'PUT', body: { password: 'chosen-by-the-admin-1' },
});
ok('an admin can change their own password', changed.status === 200, JSON.stringify(changed.data));
ok('changing it deletes the now-stale note', !existsSync(note),
  'a file holding a password that no longer works is worse than no file');

// 4. A forgotten password has a way back. This is the bug that actually locked
//    the owner out: the only route to a new password needs an admin already in.
function resetPassword(password) {
  return spawnSync(process.execPath,
    ['--no-warnings=ExperimentalWarning', 'reset-password.js', '--password', password],
    { cwd: root, env: { ...process.env, MM_DB: DB }, encoding: 'utf8' });
}
srv.child.kill('SIGKILL');
await srv.exited;
const reset = resetPassword('recovered-pass-1');
ok('reset-password.js runs with the app stopped', reset.status === 0,
  reset.stderr || reset.stdout);
srv = start({ MM_ADMIN_PASSWORD: 'smoke-test-password' });
ok('server runs again after a reset', await waitForServer(), srv.log());
const afterReset = await makeClient()('/api/login', {
  method: 'POST', body: { email: 'admin@local', password: 'recovered-pass-1' },
});
ok('the password set by reset-password.js works', afterReset.status === 200,
  JSON.stringify(afterReset.data));
const tooShort = resetPassword('short');
ok('reset-password.js refuses a password under 8 characters', tooShort.status !== 0,
  'it accepted a password the login form would also reject');

// Put the account back the way the rest of the run expects to find it.
resetPassword('smoke-test-password');

// 5. Upgrading from v2.0 copies the old database into %LOCALAPPDATA%. A v2.0
//    folder keeps its recent writes in the side file (the owner's held 78 KB),
//    so a copy that takes only maintain.db is an empty database. This builds a
//    real pending side file and copies it the way the upgrade does.
const legacyFrom = join(root, 'data', 'legacy-from');
const legacyTo = join(root, 'data', 'legacy-to');
for (const dir of [legacyFrom, legacyTo]) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir);
}
const legacy = new DatabaseSync(join(legacyFrom, 'maintain.db'));
legacy.exec('PRAGMA journal_mode = WAL');
legacy.exec('CREATE TABLE equipment (id INTEGER PRIMARY KEY, name TEXT)');
legacy.exec("INSERT INTO equipment (name) VALUES ('Left in the side file')");
// Deliberately left open: the row is still in the -wal, exactly like v2.0.
// db.js is imported here, not at the top, so opening it cannot disturb the
// server's database: the test process gets its own throw-away one.
process.env.MM_DB = join(root, 'data', 'test-process.db');
const { copyDataFiles } = await import('../db.js');
const copiedNames = copyDataFiles(legacyFrom, legacyTo);
ok('the upgrade copies the side files with the database',
  copiedNames.includes('maintain.db') && copiedNames.includes('maintain.db-wal'),
  `copied: ${copiedNames.join(', ') || 'nothing'}`);
legacy.close();
const adopted = new DatabaseSync(join(legacyTo, 'maintain.db'), { readOnly: true });
const keptRecent = adopted.prepare('SELECT COUNT(*) AS n FROM equipment').get().n;
adopted.close();
ok('a database adopted from v2.0 keeps its recent writes', keptRecent === 1,
  'the recent write lived in the side file and did not come across');
for (const dir of [legacyFrom, legacyTo]) rmSync(dir, { recursive: true, force: true });

console.log('\nCoverage — the questions nothing was asking');

// Everything below signs in for itself. By this point in the run the client the rest
// of the suite was using is no longer valid — an earlier restart rotated the signing
// key — so a test appended here would get 401 and could "pass" for the wrong reason.
// That was the first thing this block found, before it had asserted anything.
const late = makeClient();
const lateIn = await late('/api/login', { method: 'POST', body: {
  email: 'admin@local', password: 'smoke-test-password' } });
ok('the end of the suite can still sign in and be answered', lateIn.status === 200,
  `status ${lateIn.status}`);


// ---- signing out -----------------------------------------------------------
// POST /api/logout has existed since v1.0 and no check ever called it: the suite
// signed in, tested everything, and never left. Two browsers, one sign-out, is the
// contract that matters — the session that signed out dies and the other lives.
await late('/api/users', { method: 'POST', body: {
  name: 'Two browsers', email: 'browsers@local', password: 'two-browsers-1', role: 'tech' } });
const browserA = makeClient();
const browserB = makeClient();
const browserCreds = { email: 'browsers@local', password: 'two-browsers-1' };
ok('two browsers can hold two sessions for the same person',
  (await browserA('/api/login', { method: 'POST', body: browserCreds })).status === 200
  && (await browserB('/api/login', { method: 'POST', body: browserCreds })).status === 200);
ok('and both work before either signs out',
  (await browserA('/api/me')).status === 200 && (await browserB('/api/me')).status === 200);
const signedOut = await browserA('/api/logout', { method: 'POST' });
ok('signing out answers', signedOut.status === 200, JSON.stringify(signedOut.data));
ok('and the cookie that signed out stops working', (await browserA('/api/me')).status === 401);
ok('while the other browser is still signed in', (await browserB('/api/me')).status === 200);
ok('signing out a session that is already gone is not an error',
  (await browserB('/api/logout', { method: 'POST' })).status === 200
  && (await browserB('/api/logout', { method: 'POST' })).status === 200);
ok('and the second browser is signed out too', (await browserB('/api/me')).status === 401);

// The header matters as much as the session row: without Max-Age=0 the browser
// keeps the cookie and sends it forever, and every request pays for a lookup that
// can never succeed.
{
  const raw = await fetch(BASE + '/api/logout', { method: 'POST' });
  const cookie = raw.headers.get('set-cookie') || '';
  ok('signing out tells the browser to drop the cookie',
    /sid=;/.test(cookie) && /Max-Age=0/.test(cookie), cookie || '(no cookie header)');
}

// The browser forgetting is not the same as the server forgetting. This is the
// stolen-cookie case: keep a copy of the session cookie, sign out, present the copy.
// Removing `revokeSession()` from the logout route passed every other check, because
// the client had already been told to drop its cookie — so this is the check that
// actually holds the server to its side of the promise.
{
  const rawLogin = await fetch(BASE + '/api/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(browserCreds) });
  const keptCookie = String(rawLogin.headers.get('set-cookie') || '').split(';')[0];
  ok('a session cookie can be captured for this test', /^sid=./.test(keptCookie), keptCookie);
  ok('that cookie works while the session is live',
    (await fetch(BASE + '/api/me', { headers: { cookie: keptCookie } })).status === 200);
  await fetch(BASE + '/api/logout', { method: 'POST', headers: { cookie: keptCookie } });
  ok('a copy of the cookie taken before signing out no longer works',
    (await fetch(BASE + '/api/me', { headers: { cookie: keptCookie } })).status === 401,
    'the session outlived the sign-out');
}

// ---- history.csv: the export nothing downloaded ---------------------------
// The History screen could always download a file; no check ever asked the endpoint
// for one, so a broken content type or a missing filter would have gone unnoticed.
const historyClient = makeTextClient({ email: 'admin@local', password: 'smoke-test-password' });
const csvMachine = (await late('/api/equipment', { method: 'POST', body: { name: 'CSV press' } })).data;
const closedForCsv = (await late('/api/work-orders', { method: 'POST', body: {
  equipment_id: csvMachine.id, title: 'Closed for the file', priority: 'low' } })).data;
await late(`/api/work-orders/${closedForCsv.id}`, { method: 'PATCH', body: { status: 'done' } });

const historyCsv = await historyClient(`/api/export/history.csv?equipment_id=${csvMachine.id}`);
ok('the history export answers', historyCsv.status === 200, `status ${historyCsv.status}`);
ok('with a file name and a spreadsheet type',
  /text\/csv/.test(String(historyCsv.headers.get('content-type')))
  && /history\.csv/.test(String(historyCsv.headers.get('content-disposition'))),
  String(historyCsv.headers.get('content-disposition')));
const historyLines = historyCsv.text.replace(/^\uFEFF/, '').split('\r\n').filter(Boolean);
ok('its first line is the column names',
  /^Machine,Job,Status/.test(historyLines[0] || ''), historyLines[0]);
ok('and it carries the closed job it was asked for',
  historyCsv.text.includes('Closed for the file'), 'the file does not contain the job');
ok('filtered by machine, it carries nothing else',
  historyLines.length === 2, `${historyLines.length} lines for one machine`);
ok('an anonymous request for the history file is refused',
  (await fetch(BASE + '/api/export/history.csv')).status === 401);
await late(`/api/equipment/${csvMachine.id}`, { method: 'DELETE' });

// ---- LIKE is escaped, not merely trimmed ---------------------------------
// A search for `100%` must mean a literal percent. Without the escape it matches
// every row, which is the quiet way a search box stops being trustworthy.
const someMachine = (await late('/api/equipment?service=active')).data[0];
const pctA = (await late('/api/work-orders', { method: 'POST', body: {
  equipment_id: someMachine.id, title: 'Reduce load to 100% of rated', priority: 'low' } })).data;
const pctB = (await late('/api/work-orders', { method: 'POST', body: {
  equipment_id: someMachine.id, title: 'Ordered 100 spare filters', priority: 'low' } })).data;
const pctHits = (await late('/api/work-orders?q=100%25')).data;
ok('a search for "100%" finds the literal percent, not everything',
  pctHits.some((w) => w.id === pctA.id) && !pctHits.some((w) => w.id === pctB.id),
  pctHits.map((w) => w.title).join(' | '));
await late(`/api/work-orders/${pctA.id}`, { method: 'DELETE' });
await late(`/api/work-orders/${pctB.id}`, { method: 'DELETE' });

// ---- the two helpers everything else rests on ----------------------------
// Dates and search patterns are pure functions with edge cases no screen shows, so
// they are asked directly — in a child process with its own database, because
// importing `filters.js` pulls in `db.js`, which must not open the one under test.
const unitDb = join(root, 'data', 'unit.db');
rmSync(unitDb, { force: true });
const unit = spawnSync(process.execPath,
  ['--no-warnings=ExperimentalWarning', '--input-type=module', '-e', `
    import { parseDay, nowStamp } from './dates.js';
    import { likeParam } from './filters.js';
    const BS = String.fromCharCode(92);
    console.log(JSON.stringify({
      feb30: parseDay('2026-02-30').error || null,
      month13: parseDay('2026-13-01').error || null,
      shortMonth: parseDay('2026-1-01').error || null,
      notADate: parseDay('yesterday').error || null,
      leap: parseDay('2024-02-29').value || null,
      ordinary: parseDay('2026-11-06').value || null,
      stamp: /^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$/.test(nowStamp()),
      percent: likeParam('100%') === '%100' + BS + '%%',
      underscore: likeParam('a_b') === '%a' + BS + '_b%',
      backslash: likeParam('a' + BS + 'b') === '%a' + BS + BS + 'b%',
      padded: likeParam('  pump  ') === '%pump%',
      empty: likeParam('   ') === '%%',
    }));
  `], { cwd: root, env: { ...process.env, MM_DB: unitDb }, encoding: 'utf8' });
let pure = {};
try { pure = JSON.parse(unit.stdout.trim().split('\n').pop()); }
catch { /* reported by the check below, with the stderr that explains it */ }
ok('the pure helpers can be asked directly',
  Object.keys(pure).length === 12, String(unit.stderr || unit.stdout).slice(0, 300));

ok('a date that does not exist is refused, not rolled into the next month',
  /not a real calendar date/.test(pure.feb30 || '') && /not a real calendar date/.test(pure.month13 || ''),
  `${pure.feb30} / ${pure.month13}`);
ok('a loosely written date is refused too',
  /YYYY-MM-DD/.test(pure.shortMonth || '') && /YYYY-MM-DD/.test(pure.notADate || ''));
ok('a leap day in a leap year is accepted, and a plain day round-trips',
  pure.leap === '2024-02-29' && pure.ordinary === '2026-11-06');
ok('the timestamp is the shape SQLite sorts', pure.stamp === true, String(pure.stamp));
ok('a search pattern escapes the wildcards and the escape character itself',
  pure.percent === true && pure.underscore === true && pure.backslash === true,
  JSON.stringify({ percent: pure.percent, underscore: pure.underscore, backslash: pure.backslash }));
ok('and trims what was typed before wrapping it',
  pure.padded === true && pure.empty === true);
rmSync(unitDb, { force: true });
rmSync(unitDb + '-wal', { force: true });
rmSync(unitDb + '-shm', { force: true });

// ---- the page speaks for itself -----------------------------------------
// A dialog with no heading is announced as "dialog" and nothing else; a button
// with no text or label is announced as "button".
{
  const dialogBlocks = html.match(/<dialog id="[\w-]+"[\s\S]*?<\/dialog>/g) || [];
  const nameless = dialogBlocks.filter((d) => !/<h3[\s>]/.test(d));
  ok('every dialog names itself with a heading',
    dialogBlocks.length > 0 && nameless.length === 0,
    `${nameless.length} dialog(s) without a heading`);
  const emptyButtons = html.match(/<button[^>]*>\s*<\/button>/g) || [];
  ok('no button is a blank rectangle', emptyButtons.length === 0, emptyButtons.join(' '));
}

// ---- no endpoint is unknown to the suite --------------------------------
// A floor rather than a proof: every route in `routes/` must at least be *named*
// here, which is the least that is true of a route that is tested. It is how
// POST /api/logout and the history export were noticed missing.
{
  const routeKeys = [];
  for (const file of readdirSync(join(root, 'routes'))) {
    const src = readFileSync(join(root, 'routes', file), 'utf8');
    for (const m of src.matchAll(/'([A-Z]+) (\/api[^']*)':/g)) {
      routeKeys.push({ key: `${m[1]} ${m[2]}`, stem: m[2].split('/:')[0], file });
    }
  }
  const suiteText = readFileSync(join(root, 'scripts', 'smoke-test.js'), 'utf8');
  const unheard = routeKeys.filter(({ stem }) => !suiteText.includes(stem));
  ok('every endpoint is exercised somewhere in this suite',
    routeKeys.length >= 35 && unheard.length === 0,
    unheard.map((r) => `${r.key} (${r.file})`).join(', '));
}

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
                 join(root, 'data', 'login-failures.log.1'),
                 join(root, 'data', 'first-password.txt'),
                 join(root, 'data', 'copied-alone.db'),
                 join(root, 'data', 'test-process.db'),
                 join(root, 'data', 'test-process.db-wal'),
                 join(root, 'data', 'test-process.db-shm')]) {
  if (!removeWithRetry(f) && existsSync(f)) cleaned = false;
}
for (const f of readdirSync(join(root, 'data'))) {
  if (f.startsWith('backup-') && !removeWithRetry(join(root, 'data', f))) cleaned = false;
}
if (!cleaned) console.log('  note: some temp files could not be deleted (still locked)');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
