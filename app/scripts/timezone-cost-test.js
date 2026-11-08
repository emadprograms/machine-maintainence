// Isolated regression for workshop time zones, calendar boundaries and machine costs.
// Run with: node --no-warnings=ExperimentalWarning app/scripts/timezone-cost-test.js
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import { zoneDateTime, zoneDate, todayInZone, setDisplayZone } from '../public/time-zone.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'mm-time-zone-'));
const socket = createServer();
await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const base = `http://127.0.0.1:${port}`;
let server, cookie = '';
const pause = (n) => new Promise((resolve) => setTimeout(resolve, n));
async function start() {
  server = spawn(process.execPath, ['--no-warnings=ExperimentalWarning', 'server.js'], {
    cwd: root, env: { ...process.env, PORT: String(port), MM_DATA: dir, MM_DB: join(dir, 'maintain.db'), MM_ADMIN_PASSWORD: 'test-password' }, stdio: 'ignore',
  });
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error('Server exited during startup');
    try { await fetch(base); return; } catch { await pause(100); }
  }
  throw new Error('Server did not start');
}
async function stop() {
  if (!server || server.exitCode !== null) return;
  const exited = new Promise((resolve) => server.once('exit', resolve));
  server.kill('SIGTERM'); await exited;
}
async function call(path, method = 'GET', body, session = cookie) {
  const r = await fetch(base + '/api' + path, { method, headers: { cookie: session, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: r.status, data, text, headers: r.headers };
}
async function login(email, password) {
  const r = await call('/login', 'POST', { email, password }, '');
  assert.equal(r.status, 200); return r.headers.get('set-cookie').split(';')[0];
}
async function ok(path, method, body) {
  const r = await call(path, method, body);
  assert.ok(r.status >= 200 && r.status < 300, `${method} ${path}: ${r.status} ${r.text}`);
  return r.data;
}
try {
  assert.throws(() => setDisplayZone('Not/A_Zone'), /does not support/);
  assert.equal(zoneDateTime('2026-03-08 06:59:59', 'America/New_York'), '2026-03-08 01:59:59');
  assert.equal(zoneDateTime('2026-03-08 07:00:00', 'America/New_York'), '2026-03-08 03:00:00');
  assert.equal(zoneDateTime('2026-11-01 05:30:00', 'America/New_York'), '2026-11-01 01:30:00');
  assert.equal(zoneDateTime('2026-11-01 06:30:00', 'America/New_York'), '2026-11-01 01:30:00');
  assert.equal(zoneDate('2026-03-01 00:10:00', 'America/New_York'), '2026-02-28');
  assert.equal(zoneDate('2026-03-01', 'America/New_York'), '2026-03-01'); // calendar dates never shift
  await start();
  assert.equal((await call('/settings', 'GET', undefined, '')).status, 401);
  cookie = await login('admin@local', 'test-password');
  assert.equal((await ok('/settings')).time_zone, 'UTC');
  await ok('/users', 'POST', { name: 'Technician', email: 'tech@local', password: 'tech-password', role: 'tech' });
  const tech = await login('tech@local', 'tech-password');
  assert.equal((await call('/settings', 'PUT', { time_zone: 'Asia/Bahrain' }, tech)).status, 403);
  const machine = await ok('/equipment', 'POST', { name: 'Cost pump' });
  const empty = await ok('/equipment', 'POST', { name: 'Empty pump' });
  const part = await ok('/parts', 'POST', { name: 'Seal', qty: 10, unit_price: 20 });
  const job1 = await ok('/work-orders', 'POST', { equipment_id: machine.id, title: 'Boundary February' });
  const job2 = await ok('/work-orders', 'POST', { equipment_id: machine.id, title: 'Boundary March' });
  await ok('/settings', 'PUT', { hourly_rate: 40 });
  const stage = await ok(`/work-orders/${job1.id}/updates`, 'POST', { message: 'Replace seal', hours: 2,
    assigned_to: 1, machine_running: true, parts: [{ part_id: part.id, qty: 2, unit_price: 7.25 }] });
  await ok(`/work-orders/${job2.id}`, 'PATCH', { labour_hours: 1.5 });
  let machines = await ok('/equipment');
  assert.equal(machines.find((m) => m.id === empty.id).total_service_cost, 0);
  assert.equal(machines.find((m) => m.id === machine.id).total_hours, 3.5);
  assert.equal(machines.find((m) => m.id === machine.id).total_service_cost, 154.5);
  await ok(`/work-orders/${job1.id}/updates/${stage.id}`, 'PUT', { message: 'Corrected', hours: 3, machine_running: true,
    parts: [{ part_id: part.id, qty: 1, unit_price: 8 }] });
  assert.equal((await ok('/equipment')).find((m) => m.id === machine.id).total_service_cost, 188);
  await ok(`/work-orders/${job1.id}/updates/${stage.id}`, 'PUT', { message: 'Replace seal', hours: 2, machine_running: true,
    parts: [{ part_id: part.id, qty: 2, unit_price: 7.25 }] });
  assert.equal((await ok('/equipment')).find((m) => m.id === machine.id).total_service_cost, 154.5);
  await ok('/settings', 'PUT', { hourly_rate: 20 });
  machines = await ok('/equipment');
  assert.equal(machines.find((m) => m.id === machine.id).total_service_cost, 84.5);
  await ok('/settings', 'PUT', { hourly_rate: 40 });
  assert.equal((await call('/settings', 'PUT', { time_zone: 'Not/A_Zone', hourly_rate: 999 })).status, 400);
  assert.equal((await ok('/settings')).hourly_rate, 40); // invalid combined write is atomic
  const saved = await ok('/settings', 'PUT', { time_zone: 'America/New_York' });
  assert.equal(saved.hourly_rate, 40);
  assert.equal(saved.time_zone, 'America/New_York');
  assert.equal((await call('/settings', 'GET', undefined, tech)).data.time_zone, 'America/New_York');
  const trend = spawnSync(process.execPath, ['--no-warnings=ExperimentalWarning', '--input-type=module', '-e',
    `import { monthlyTrend } from './trend.js'; console.log(JSON.stringify(monthlyTrend(2, new Date('2026-03-01T00:10:00Z')).map(x => x.month)));`],
  { cwd: root, env: { ...process.env, MM_DB: join(dir, 'maintain.db'), MM_DATA: dir }, encoding: 'utf8' });
  assert.equal(trend.status, 0, trend.stderr);
  assert.deepEqual(JSON.parse(trend.stdout.trim().split('\n').at(-1)), ['2026-01', '2026-02']);
  await ok('/settings', 'PUT', { hourly_rate: 45 });
  assert.equal((await ok('/settings')).time_zone, 'America/New_York');
  await ok('/settings', 'PUT', { hourly_rate: 40 });
  const db = new DatabaseSync(join(dir, 'maintain.db'));
  db.prepare('UPDATE work_orders SET status=?, created_at=?, closed_at=? WHERE id=?')
    .run('done', '2026-02-27 20:00:00', '2026-03-01 00:10:00', job1.id);
  db.prepare('UPDATE work_orders SET status=?, created_at=?, closed_at=? WHERE id=?')
    .run('done', '2026-03-05 20:00:00', '2026-04-01 02:00:00', job2.id);
  db.close();
  const history = await ok('/history?status=done&from=2026-02-28&to=2026-02-28');
  assert.deepEqual(history.rows.map((r) => r.id), [job1.id]);
  assert.equal(history.rows[0].closed_at, '2026-03-01 00:10:00'); // API remains UTC
  const feb = await ok('/report?month=2026-02'), march = await ok('/report?month=2026-03');
  assert.equal(feb.jobs, 1); assert.equal(march.jobs, 1);
  assert.equal(feb.machines[0].id, machine.id); assert.equal(feb.total, 94.5); assert.equal(march.total, 60);
  const csv = await call('/export/history.csv?status=done&from=2026-02-28&to=2026-02-28');
  assert.match(csv.text, /2026-02-28 19:10:00 America\/New_York/);
  assert.ok(!csv.text.includes('Boundary March'));
  const jobCsv = await call('/export/work-orders.csv');
  assert.match(jobCsv.text, /2026-02-28 19:10:00 America\/New_York/);
  const print = await ok(`/work-orders/${job1.id}/print`);
  assert.equal(print.time_zone, 'America/New_York');
  assert.equal(zoneDateTime(print.job.closed_at, print.time_zone), '2026-02-28 19:10:00');
  const today = todayInZone('America/New_York');
  const due = await ok('/pm', 'POST', { equipment_id: machine.id, task: 'Today', interval_days: 1, next_due: today });
  assert.equal((await ok('/pm')).find((p) => p.id === due.id).days_left, 0);
  assert.ok((await ok('/pm/due?days=7')).some((p) => p.id === due.id && p.days_left === 0));
  assert.ok((await ok('/dashboard')).due_soon.items.some((p) => p.id === due.id && p.days_left === 0));
  await stop(); await start();
  assert.equal((await ok('/settings')).time_zone, 'America/New_York');
  assert.equal((await ok('/report?month=2026-02')).jobs, 1);
  await ok('/settings', 'PUT', { time_zone: 'UTC' });
  assert.equal((await ok('/history?status=done&from=2026-02-28&to=2026-02-28')).total, 0);
  assert.equal((await ok('/report?month=2026-03')).machines[0].total, 94.5);
  console.log('PASS timezone/cost: DST, calendar boundaries, filtering/report/CSV/print, PM, multi-job costs, permissions, validation, partial writes and restart');
} finally {
  await stop(); rmSync(dir, { recursive: true, force: true });
}
