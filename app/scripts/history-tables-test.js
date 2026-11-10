// History intervals, machine selection, migration and maintenance persistence.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = mkdtempSync(join(tmpdir(), 'mm-history-test-')), port = 3995, base = `http://localhost:${port}`;
let server, cookie = '';
async function start() {
  server = spawn(process.execPath, ['--no-warnings=ExperimentalWarning','server.js'], { cwd:root, env:{...process.env, PORT:String(port), MM_DATA:dir, MM_DB:join(dir,'maintain.db'), MM_ADMIN_PASSWORD:'test-password'}, stdio:'ignore' });
  for (let n=0; n<100 && server.exitCode===null; n++) { try { await fetch(base); return; } catch { await new Promise(r=>setTimeout(r,100)); } }
  throw Error('History server did not start');
}
async function stop() { if (server && server.exitCode === null) { const done = new Promise(r=>server.once('exit',r)); server.kill('SIGTERM'); await done; } }
async function call(path, method='GET', body) {
  const r=await fetch(base+path,{method,headers:{cookie,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  if (r.headers.has('set-cookie')) cookie=r.headers.get('set-cookie').split(';')[0];
  const text=await r.text(); let data; try { data=JSON.parse(text); } catch { data=text; }
  return { status:r.status, data, text };
}
async function ok(path, method='GET', body) { const r=await call(path,method,body); assert.ok(r.status>=200&&r.status<300,`${path} ${r.status} ${r.text}`); return r.data; }
try {
  await start(); await ok('/api/login','POST',{email:'admin@local',password:'test-password'});
  const pump=await ok('/api/equipment','POST',{name:'Pump',category:'Pumps'});
  const lathe=await ok('/api/equipment','POST',{name:'Lathe',category:'Machining'});
  const other=await ok('/api/equipment','POST',{name:'Other pump',category:'Pumps'});
  const legacy=await ok('/api/pm','POST',{equipment_id:pump.id,task:'Oil service',interval_days:7,last_done:'2020-01-02',next_due:'2020-01-09'});
  const part=await ok('/api/parts','POST',{name:'Seal',reference:'SEAL-1',qty:20,unit_price:3});
  const closed=await ok('/api/work-orders','POST',{equipment_id:pump.id,title:'Span interval'});
  const stage = await ok(`/api/work-orders/${closed.id}/updates`,'POST',{message:'Started repair',hours:1,assigned_to:1,parts:[{part_id:part.id,qty:2,unit_price:4}]});
  await ok(`/api/work-orders/${closed.id}/parts`,'POST',{part_id:part.id,qty:3});
  await ok(`/api/work-orders/${closed.id}`,'PATCH',{status:'done',machine_running:true,resolution:'Repaired'});
  const open=await ok('/api/work-orders','POST',{equipment_id:pump.id,title:'Still active'});
  const outside=await ok('/api/work-orders','POST',{equipment_id:lathe.id,title:'Outside'});
  const boundary=await ok('/api/work-orders','POST',{equipment_id:lathe.id,title:'Time zone boundary'});
  await ok(`/api/work-orders/${boundary.id}`,'PATCH',{status:'done',machine_running:true});
  await stop();
  let db=new DatabaseSync(join(dir,'maintain.db'));
  db.exec('PRAGMA foreign_keys=ON');
  db.prepare("UPDATE work_orders SET created_at='2020-01-01 12:00:00',closed_at='2020-01-20 12:00:00' WHERE id=?").run(closed.id);
  db.prepare("UPDATE work_order_updates SET created_at='2020-01-05 12:00:00' WHERE id=?").run(stage.id);
  db.prepare("UPDATE work_orders SET created_at='2020-01-03 12:00:00' WHERE id=?").run(open.id);
  db.prepare("UPDATE work_orders SET created_at='2020-03-01 12:00:00' WHERE id=?").run(outside.id);
  db.prepare("UPDATE work_orders SET created_at='2020-01-03 04:30:00',closed_at='2020-01-04 02:00:00' WHERE id=?").run(boundary.id);
  db.exec('DROP TABLE pm_completions'); db.close();
  await start();
  let rows=(await ok('/api/history-table?view=machine')).rows;
  assert.equal(rows.filter(r=>r.kind==='maintenance'&&r.source==='legacy').length,1);
  await ok(`/api/pm/${legacy.id}/done`,'POST',{on:'2020-01-05'});
  await ok(`/api/pm/${legacy.id}/done`,'POST',{on:'2020-01-12'});
  assert.equal((await call(`/api/pm/${legacy.id}/done`,'POST',{on:'2999-01-01'})).status,400);
  db=new DatabaseSync(join(dir,'maintain.db'));
  db.exec("CREATE TRIGGER fail_history BEFORE INSERT ON pm_completions WHEN NEW.completed_on='2020-01-15' BEGIN SELECT RAISE(ABORT,'test failure'); END"); db.close();
  assert.equal((await call(`/api/pm/${legacy.id}/done`,'POST',{on:'2020-01-15'})).status,400);
  db=new DatabaseSync(join(dir,'maintain.db'));
  assert.equal(db.prepare('SELECT last_done FROM pm_schedule WHERE id=?').get(legacy.id).last_done,'2020-01-12');
  db.exec('DROP TRIGGER fail_history'); db.close();
  rows=(await ok(`/api/history-table?view=machine&from=2020-01-04&to=2020-01-10&category=Pumps&machines=${pump.id},${other.id}`)).rows;
  assert.ok(rows.some(r=>r.id===closed.id&&r.kind==='work'));
  assert.ok(rows.some(r=>r.id===open.id&&r.kind==='work'&&r.end_day===null));
  assert.ok(rows.some(r=>r.kind==='maintenance'&&r.end_day==='2020-01-05'));
  assert.ok(!rows.some(r=>r.kind==='maintenance'&&r.end_day==='2020-01-12'));
  assert.ok(!rows.some(r=>r.equipment_id===lathe.id));
  assert.equal(rows.find(r=>r.id===closed.id&&r.kind==='work').opened_day,'2020-01-01');
  assert.equal(rows.find(r=>r.id===closed.id&&r.kind==='work').start_day,'2020-01-05');
  assert.equal(rows.find(r=>r.id===open.id&&r.kind==='work').start_day,null);
  assert.equal(rows.find(r=>r.id===closed.id&&r.kind==='work').end_day,'2020-01-20');
  const completed=(await ok(`/api/history-table?view=maintenance&from=2020-01-04&to=2020-01-10&category=Pumps&machines=${pump.id}`)).rows;
  assert.equal(completed.length,1); assert.ok(completed.every(r=>r.kind==='maintenance')); assert.equal(completed[0].end_day,'2020-01-05');
  const usage=(await ok(`/api/history-table?view=parts&parts=${part.id}&machines=${pump.id}`)).rows;
  assert.equal(usage.length,2); assert.equal(usage.find(r=>r.source==='stage').qty,2); assert.equal(usage.find(r=>r.source==='stage').cost,8);
  assert.equal(usage.find(r=>r.source==='undated').qty,3); assert.equal(usage.find(r=>r.source==='undated').event_day,null);
  assert.equal(usage.find(r=>r.source==='undated').cost,null);
  assert.equal((await ok(`/api/history-table?view=parts&q=SEAL-1&parts=${part.id}`)).rows.length,2);
  assert.equal((await ok(`/api/history-table?view=parts&machines=${lathe.id},${other.id}`)).rows.length,0);
  assert.equal((await ok(`/api/history-table?view=parts&from=2020-01-05&to=2020-01-05&parts=${part.id}&category=Pumps`)).rows.length,1);
  assert.equal((await ok(`/api/history-table?view=parts&from=2020-01-06&parts=${part.id}`)).rows.length,0);
  assert.equal((await ok(`/api/history-table?view=parts&category=Machining`)).rows.length,0);
  assert.equal((await call('/api/history-table?view=parts&parts=1%29OR1%3D1')).status,400);
  assert.equal((await call('/api/history-table?view=parts&from=2020-02-31')).status,400);
  const usageCsv=await ok(`/api/export/history-table.csv?view=parts&from=2020-01-05&to=2020-01-05`);
  assert.match(usageCsv,/Seal/); assert.match(usageCsv,/Stage/); assert.doesNotMatch(usageCsv,/Undated job usage/);
  const maintenanceCsv=await ok(`/api/export/history-table.csv?view=maintenance&to=2020-01-05`); assert.match(maintenanceCsv,/Oil service/);
  const work=(await ok(`/api/history-table?view=work&from=2020-01-04&to=2020-01-10&machines=${pump.id}`)).rows;
  assert.equal(work.length,2); assert.ok(work.every(r=>r.kind==='work'));
  assert.equal((await ok(`/api/history-table?view=work&status=done&machines=${pump.id}`)).rows.length,1);
  const activeMachine = (await ok(`/api/history-table?view=machine&status=open&machines=${pump.id}`)).rows;
  assert.ok(activeMachine.some(r=>r.id===open.id)); assert.ok(activeMachine.every(r=>r.kind==='work' && r.status==='open'));
  assert.equal((await ok(`/api/work-orders?status=active`)).some(r=>r.id===closed.id),false);
  assert.equal((await ok(`/api/work-orders?status=active`)).some(r=>r.id===open.id),true);
  assert.equal((await ok('/api/history-table?view=work&from=2020-02-01&to=2020-02-05')).rows.filter(r=>r.id===closed.id).length,0);
  assert.equal((await ok('/api/history-table?view=work&from=2020-02-01&to=2020-02-05')).rows.filter(r=>r.id===open.id).length,1);
  assert.equal((await call('/api/history-table?view=work&from=2020-02-31')).status,400);
  assert.equal((await call('/api/history-table?view=work&machines=1%29OR1%3D1')).status,400);
  assert.equal((await call('/api/history-table?view=work&from=2020-02-01&to=2020-01-01')).status,400);
  const csv=await ok(`/api/export/history-table.csv?view=work&from=2020-01-04&to=2020-01-10&machines=${pump.id}`);
  assert.match(csv,/Span interval/); assert.match(csv,/Still active/); assert.doesNotMatch(csv,/Outside/);
  await ok('/api/settings','PUT',{time_zone:'America/New_York'});
  db=new DatabaseSync(join(dir,'maintain.db')); db.prepare("UPDATE work_order_updates SET created_at='2020-01-05 02:00:00' WHERE id=?").run(stage.id); db.close();
  assert.equal((await ok(`/api/history-table?view=parts&from=2020-01-04&to=2020-01-04`)).rows[0].event_day,'2020-01-04');
  assert.equal((await ok(`/api/history-table?view=parts&from=2020-01-05&to=2020-01-05`)).rows.length,0);
  const local=(await ok(`/api/history-table?view=work&from=2020-01-03&to=2020-01-03&machines=${lathe.id}`)).rows;
  assert.ok(local.some(r=>r.id===boundary.id&&r.opened_day==='2020-01-02'&&r.end_day==='2020-01-03'));
  assert.ok(!(await ok(`/api/history-table?view=work&from=2020-01-04&to=2020-01-04&machines=${lathe.id}`)).rows.some(r=>r.id===boundary.id));
  assert.ok((await ok(`/api/history-table?view=machine&from=2020-01-05&to=2020-01-05&machines=${pump.id}`)).rows.some(r=>r.kind==='maintenance'&&r.end_day==='2020-01-05'));
  await ok(`/api/work-orders/${closed.id}/updates/${stage.id}`,'PUT',{parts:[{part_id:part.id,qty:1,unit_price:5}]});
  const corrected=(await ok(`/api/history-table?view=parts&parts=${part.id}`)).rows;
  assert.equal(corrected.find(r=>r.source==='stage').qty,1); assert.equal(corrected.find(r=>r.source==='stage').cost,5);
  assert.equal(corrected.find(r=>r.source==='undated').qty,3);
  await ok(`/api/work-orders/${closed.id}/updates/${stage.id}`,'DELETE');
  const afterDelete=(await ok(`/api/history-table?view=parts&parts=${part.id}`)).rows;
  assert.equal(afterDelete.length,1); assert.equal(afterDelete[0].source,'undated'); assert.equal(afterDelete[0].qty,3);
  for (const view of ['work','parts','maintenance']) {
    assert.equal((await fetch(base+`/api/history-table?view=${view}`)).status,401);
    assert.equal((await fetch(base+`/api/export/history-table.csv?view=${view}`)).status,401);
  }

  await stop(); await start();
  rows=(await ok('/api/history-table?view=machine')).rows;
  assert.equal(rows.filter(r=>r.kind==='maintenance').length,3);
  db=new DatabaseSync(join(dir,'maintain.db')); assert.equal(db.prepare('SELECT last_done FROM pm_schedule WHERE id=?').get(legacy.id).last_done,'2020-01-12'); db.close();
  console.log('History overlap, filters, exports, migration and completion persistence passed');
} finally { await stop(); rmSync(dir,{recursive:true,force:true}); }
