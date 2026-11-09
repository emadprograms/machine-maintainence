// End-to-end streamed media, report lifecycle and machine-field regression.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = mkdtempSync(join(tmpdir(), 'mm-media-test-')), port = 3997;
const server = spawn(process.execPath, ['--no-warnings=ExperimentalWarning', 'server.js'], {
  cwd: root, env: { ...process.env, PORT: String(port), MM_DATA: dir, MM_DB: join(dir, 'maintain.db'), MM_ADMIN_PASSWORD: 'test-password' }, stdio: 'ignore' });
const base = `http://localhost:${port}`;
const delay = (n) => new Promise((r) => setTimeout(r, n));
function client() {
  let cookie = '';
  return async (path, { method = 'GET', body, raw, headers = {} } = {}) => {
    const response = await fetch(base + path, { method, headers: { cookie, ...(raw ? {} : { 'content-type': 'application/json' }), ...headers },
      body: raw || (body === undefined ? undefined : JSON.stringify(body)) });
    if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    const bytes = Buffer.from(await response.arrayBuffer());
    let data; try { data = JSON.parse(bytes); } catch { data = null; }
    return { status: response.status, headers: response.headers, bytes, data };
  };
}
const image = Buffer.concat([Buffer.from([0xff,0xd8,0xff]), Buffer.alloc(3 * 1024 * 1024, 9)]);
const video = Buffer.concat([Buffer.from([0,0,0,20]), Buffer.from('ftypisom'), Buffer.alloc(3 * 1024 * 1024, 7)]);
const pdf = Buffer.from('%PDF-1.4\nReport text\n%%EOF');
const mediaDir = join(dir, 'photos');
const files = () => readdirSync(mediaDir).sort();
try {
  let ready = false;
  for (let i = 0; i < 100 && server.exitCode === null; i++) { try { await fetch(base); ready = true; break; } catch { await delay(100); } }
  assert.ok(ready, 'media test server failed to start');
  const a = client(), t = client(), anon = client();
  assert.equal((await a('/api/login', { method: 'POST', body: { email:'admin@local', password:'test-password' } })).status, 200);
  assert.equal((await a('/api/users', { method:'POST', body:{ name:'Tech', email:'tech@local', password:'test-password', role:'technician' } })).status, 201);
  assert.equal((await t('/api/login', { method:'POST', body:{ email:'tech@local', password:'test-password' } })).status, 200);
  let m = await a('/api/equipment', {method:'POST',body:{name:'Pump',model:'A-14',serial_number:'SN-77'}}); assert.equal(m.status,201); m=m.data;
  assert.equal((await a('/api/equipment?q=SN-77')).data[0].model, 'A-14');
  assert.equal((await a(`/api/equipment/${m.id}`, {method:'PUT',body:{model:'B-42',serial_number:'SN-88'}})).data.serial_number,'SN-88');
  assert.equal((await a('/api/equipment?q=B-42')).data[0].serial_number, 'SN-88');
  assert.equal((await a(`/api/equipment/${m.id}/photo`, {method:'POST',raw:image})).status,200);
  assert.equal((await a(`/api/equipment/${m.id}/photo`)).bytes.length,image.length);
  assert.equal((await a(`/api/equipment/${m.id}/photo`, {method:'POST',raw:video})).status,200);
  let r = await a(`/api/equipment/${m.id}/photo`, {headers:{range:'bytes=4-11'}}); assert.equal(r.status,206); assert.deepEqual(r.bytes,video.subarray(4,12)); assert.equal(r.headers.get('content-type'),'video/mp4');
  assert.equal((await anon(`/api/equipment/${m.id}/photo`)).status,401);
  assert.equal((await a(`/api/equipment/${m.id}/photo`, {headers:{range:'bytes=99999999-'}})).status,416);
  const job = (await a('/api/work-orders',{method:'POST',body:{equipment_id:m.id,title:'Fault'}})).data;
  assert.equal((await a(`/api/work-orders/${job.id}/photo`,{method:'POST',raw:video})).status,200);
  r = await a(`/api/work-orders/${job.id}/photo`,{headers:{range:'bytes=-10'}}); assert.equal(r.status,206); assert.deepEqual(r.bytes,video.subarray(-10));
  const bad = await a('/api/uploads?kind=media',{method:'POST',raw:Buffer.from('not an image')}); assert.equal(bad.status,400);
  assert.equal((await a('/api/uploads?kind=report',{method:'POST',raw:Buffer.from('not a document')})).status,400);
  assert.equal((await anon('/api/uploads?kind=media',{method:'POST',raw:image})).status,401);
  const upload = async (cl, kind, raw, name = 'test') => { const result=await cl(`/api/uploads?kind=${kind}`,{method:'POST',raw,headers:{'x-upload-name':encodeURIComponent(name)}}); assert.equal(result.status,201); return result.data.id; };
  const mov = await upload(a, 'media', Buffer.concat([Buffer.from([0,0,0,20]),Buffer.from('ftypqt  '),Buffer.alloc(16)]), 'clip.mov');
  const webm = await upload(a, 'media', Buffer.from([0x1a,0x45,0xdf,0xa3,1,2,3]), 'clip.webm');
  const docLegacy = await upload(a, 'report', Buffer.from('d0cf11e0a1b11ae100', 'hex'), 'job.doc');
  for (const token of [mov, webm, docLegacy]) assert.equal((await a(`/api/uploads/${token}`, {method:'DELETE'})).status, 200);
  const photo = await upload(a,'media',image), clip = await upload(a,'media',video), doc = await upload(a,'report',pdf,'Inspection <report>.pdf');
  assert.equal((await t(`/api/work-orders/${job.id}/updates`,{method:'POST',body:{message:'Unauthorized attachment',hours:1,assigned_to:1,upload_ids:[clip]}})).status,400);
  assert.equal((await a(`/api/work-orders/${job.id}/updates`,{method:'POST',body:{message:'Bad stock',hours:1,assigned_to:1,upload_ids:[clip],parts:[{part_id:999,qty:1,unit_price:1}]}})).status,400);
  r = await a(`/api/work-orders/${job.id}/updates`,{method:'POST',body:{message:'Repaired',hours:1,assigned_to:1,machine_running:true,upload_ids:[photo,clip],report_upload_id:doc}}); assert.equal(r.status,201); const stage=r.data.id;
  const updates = (await a(`/api/work-orders/${job.id}/updates`)).data; assert.equal(updates[0].photos.length,2); assert.deepEqual(updates[0].photo_videos,[updates[0].photos[1]]); assert.equal(updates[0].report.original_name,'Inspection <report>.pdf');
  r=await a(`/api/work-orders/${job.id}/updates/${stage}/photos/${updates[0].photos[1]}`,{headers:{range:'bytes=4-11'}}); assert.equal(r.status,206); assert.deepEqual(r.bytes,video.subarray(4,12));
  r=await a(`/api/work-orders/${job.id}/updates/${stage}/report`); assert.equal(r.status,200); assert.deepEqual(r.bytes,pdf); assert.match(r.headers.get('content-disposition'),/^attachment/); assert.equal(r.headers.get('x-content-type-options'),'nosniff');
  assert.equal((await anon(`/api/work-orders/${job.id}/updates/${stage}/report`)).status,401);
  const snapshot=(await a(`/api/work-orders/${job.id}/print`)).data; assert.equal(snapshot.job.equipment_model,'B-42'); assert.equal(snapshot.job.equipment_serial_number,'SN-88'); assert.equal(snapshot.updates[0].report.original_name,'Inspection <report>.pdf');
  const db=new DatabaseSync(join(dir,'maintain.db')); const saved=db.prepare('SELECT filename FROM work_update_reports WHERE update_id=?').get(stage).filename; const removedPhoto=db.prepare('SELECT filename FROM work_update_photos WHERE id=?').get(updates[0].photos[0]).filename; db.close();
  const doc2=await upload(a,'report',Buffer.from('PK\x03\x04document'),'replacement.docx');
  assert.equal((await t(`/api/work-orders/${job.id}/updates/${stage}`,{method:'PUT',body:{report_upload_id:doc2}})).status,403);
  assert.equal((await a(`/api/work-orders/${job.id}/updates/${stage}`,{method:'PUT',body:{keep_photos:[updates[0].photos[1]],report_upload_id:doc2}})).status,200);
  assert.equal(existsSync(join(mediaDir,saved)),false); assert.equal(existsSync(join(mediaDir,removedPhoto)),false);
  assert.equal((await a(`/api/work-orders/${job.id}/updates/${stage}/report`)).headers.get('content-type'),'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  assert.equal((await a(`/api/work-orders/${job.id}/updates/${stage}`,{method:'DELETE'})).status,200);
  assert.equal((await a(`/api/work-orders/${job.id}/updates/${stage}/report`)).status,404);
  assert.equal(files().length,2); // only machine and fault media remain
  const expired = await upload(t,'report',pdf,'expired.pdf');
  { const expiredDb = new DatabaseSync(join(dir,'maintain.db')); expiredDb.prepare("UPDATE pending_uploads SET created_at = datetime('now', '-2 days') WHERE id = ?").run(expired); expiredDb.close(); }
  const leftover=await upload(t,'report',pdf,'discard.pdf'); assert.equal((await a(`/api/uploads/${leftover}`,{method:'DELETE'})).status,200); assert.equal(files().length,3); assert.equal((await t(`/api/uploads/${leftover}`,{method:'DELETE'})).status,200); assert.equal(files().length,2);
  const v2=await upload(a,'media',video), d2=await upload(a,'report',pdf);
  assert.equal((await a(`/api/work-orders/${job.id}/updates`,{method:'POST',body:{message:'Again',hours:1,assigned_to:1,upload_ids:[v2],report_upload_id:d2}})).status,201);
  assert.equal((await a(`/api/equipment/${m.id}`,{method:'DELETE'})).status,200); assert.deepEqual(files(),[]);
  console.log('Streamed media, range, authorization, reports, stock rollback and cleanup passed');
} finally {
  if (server.exitCode === null && server.signalCode === null) { const done = new Promise((resolve) => server.once('exit',resolve)); server.kill('SIGTERM'); await done; }
  rmSync(dir,{recursive:true,force:true});
}
