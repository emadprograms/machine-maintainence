// Reports and catalog attachment API integration, including auth and rollback.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), dir = mkdtempSync(join(tmpdir(), 'mm-v7-')), port = 3996;
const server = spawn(process.execPath,['--no-warnings=ExperimentalWarning','server.js'],{cwd:root,env:{...process.env,PORT:String(port),MM_DATA:dir,MM_DB:join(dir,'maintain.db'),MM_ADMIN_PASSWORD:'test-password'},stdio:'ignore'});
const base = `http://localhost:${port}`, delay = ms => new Promise(r => setTimeout(r,ms));
function client() { let cookie=''; return async (path,{method='GET',body,raw,headers={}}={}) => {
  const r=await fetch(base+path,{method,headers:{cookie,...(raw?{}:{'content-type':'application/json'}),...headers},body:raw || (body === undefined ? undefined : JSON.stringify(body))});
  if(r.headers.has('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];
  const bytes=Buffer.from(await r.arrayBuffer()); let data;try{data=JSON.parse(bytes)}catch{data=null}return {status:r.status,data,bytes,headers:r.headers}; }; }
const image=Buffer.concat([Buffer.from([0xff,0xd8,0xff]),Buffer.alloc(3*1024*1024)]), video=Buffer.concat([Buffer.from([0,0,0,20]),Buffer.from('ftypisom'),Buffer.alloc(200)]), pdf=Buffer.from('%PDF-1.4\nreceipt\n%%EOF');
try {
  let ready=false;for(let i=0;i<100&&server.exitCode===null;i++){try{await fetch(base);ready=true;break}catch{await delay(100)}}assert.ok(ready,'server did not start');
  const a=client(),t=client(),anon=client();assert.equal((await a('/api/login',{method:'POST',body:{email:'admin@local',password:'test-password'}})).status,200);
  assert.equal((await a('/api/users',{method:'POST',body:{name:'Tech',email:'tech@local',password:'test-password',role:'technician'}})).status,201);
  assert.equal((await t('/api/login',{method:'POST',body:{email:'tech@local',password:'test-password'}})).status,200);
  const upload=async(cl,kind,raw,name)=>{const r=await cl(`/api/uploads?kind=${kind}`,{method:'POST',raw,headers:{'x-upload-name':encodeURIComponent(name)}});assert.equal(r.status,201);return r.data.id};
  const img=await upload(a,'media',image,'bearing.jpg'), vid=await upload(a,'media',video,'delivery.mp4'), receipt=await upload(a,'report',pdf,'receipt.pdf');
  assert.equal((await t('/api/parts',{method:'POST',body:{name:'Cannot steal',media_upload_ids:[img]}})).status,400);
  assert.equal((await a('/api/parts',{method:'POST',body:{name:'',media_upload_ids:[img]}})).status,400);
  let part=await a('/api/parts',{method:'POST',body:{name:'Bearing',qty:20,unit_price:3.5,reorder_level:3,media_upload_ids:[img,vid],document_upload_ids:[receipt]}});assert.equal(part.status,201);part=part.data;
  let attachments=(await a(`/api/parts/${part.id}/attachments`)).data;assert.equal(attachments.length,3);assert.equal(attachments[1].video,true);
  assert.equal((await anon(`/api/parts/${part.id}/attachments`)).status,401);assert.equal((await anon(`/api/parts/${part.id}/attachments/${attachments[0].id}`)).status,401);
  let res=await a(`/api/parts/${part.id}/attachments/${attachments[1].id}`,{headers:{range:'bytes=4-11'}});assert.equal(res.status,206);assert.deepEqual(res.bytes,video.subarray(4,12));
  res=await a(`/api/parts/${part.id}/attachments/${attachments[2].id}`);assert.equal(res.status,200);assert.deepEqual(res.bytes,pdf);assert.match(res.headers.get('content-disposition'),/^attachment/);
  const db=new DatabaseSync(join(dir,'maintain.db'));const old=db.prepare('SELECT filename FROM part_attachments WHERE id=?').get(attachments[0].id).filename;db.close();
  assert.equal((await a(`/api/parts/${part.id}`,{method:'PUT',body:{remove_attachment_ids:[999]}})).status,400);assert.equal((await a(`/api/parts/${part.id}/attachments`)).data.length,3);
  assert.equal((await a(`/api/parts/${part.id}`,{method:'PUT',body:{remove_attachment_ids:[attachments[0].id]}})).status,200);assert.equal(existsSync(join(dir,'photos',old)),false);
  const spare=(await a('/api/parts',{method:'POST',body:{name:'Unpriced',qty:2,reorder_level:4}})).data;
  let stock=(await a('/api/reports/parts')).data;assert.equal(stock.total_parts,2);assert.equal(stock.known_stock_value,70);assert.equal(stock.missing_prices,1);assert.equal(stock.low_stock,1);
  const filteredStock=(await a('/api/reports/parts?q=unpriced')).data; assert.equal(filteredStock.total_parts,1); assert.equal(filteredStock.missing_prices,1); assert.equal(filteredStock.known_stock_value,0);
  const filteredStockCsv=(await a('/api/export/inventory-report.csv?q=unpriced')).bytes.toString(); assert.match(filteredStockCsv,/Unpriced/); assert.doesNotMatch(filteredStockCsv,/Bearing/);
  assert.equal((await anon('/api/reports/parts')).status,401);assert.equal((await t('/api/export/inventory-report.csv')).status,200);
  const machine=(await a('/api/equipment',{method:'POST',body:{name:'Pump',model:'M1',serial_number:'S1'}})).data;
  const job=async title=>(await a('/api/work-orders',{method:'POST',body:{equipment_id:machine.id,title}})).data;
  const open=await job('Open job'), active=await job('Active job'), done=await job('Done job');
  for(const [j,h] of [[active,1],[done,2]]) assert.equal((await a(`/api/work-orders/${j.id}/updates`,{method:'POST',body:{message:'Repair',hours:h,assigned_to:1,machine_running:true,parts:[{part_id:part.id,qty:2,unit_price:3.5}]}})).status,201);
  assert.equal((await a(`/api/work-orders/${done.id}`,{method:'PATCH',body:{status:'done',machine_running:true}})).status,200);
  const report=(await a(`/api/reports/machine/${machine.id}`)).data;assert.equal(report.total_jobs,3);assert.deepEqual(report.counts,{open:1,in_progress:1,done:1});assert.equal(report.total_hours,3);assert.equal(report.total_cost,14);assert.equal(report.cost_basis,'parts');assert.equal(report.machine.serial_number,'S1');
  const filteredMachine=(await a(`/api/reports/machine/${machine.id}?q=done%20job`)).data; assert.equal(filteredMachine.total_jobs,1); assert.equal(filteredMachine.total_cost,7); assert.equal(filteredMachine.total_hours,2);
  const filteredMachineCsv=(await a(`/api/export/machine-report.csv?id=${machine.id}&q=done%20job`)).bytes.toString(); assert.match(filteredMachineCsv,/Done job/); assert.doesNotMatch(filteredMachineCsv,/Active job/);
  assert.equal((await anon(`/api/reports/machine/${machine.id}`)).status,401);assert.equal((await a('/api/reports/machine/999999')).status,404);
  const csv=await t(`/api/export/machine-report.csv?id=${machine.id}`);assert.equal(csv.status,200);assert.match(csv.bytes.toString(),/14/);
  assert.equal((await a(`/api/parts/${part.id}`,{method:'DELETE'})).status,400);assert.equal((await a(`/api/parts/${part.id}/attachments`)).data.length,2);
  assert.equal((await a(`/api/equipment/${machine.id}`,{method:'DELETE'})).status,200);
  assert.equal((await a(`/api/parts/${part.id}`,{method:'DELETE'})).status,200);assert.equal((await a(`/api/parts/${spare.id}`,{method:'DELETE'})).status,200);
  assert.deepEqual(readdirSync(join(dir,'photos')),[]);
  console.log('Report totals, exports, authenticated part attachments, rollback and cleanup passed');
} finally { if(server.exitCode===null&&server.signalCode===null){const done=new Promise(r=>server.once('exit',r));server.kill('SIGTERM');await done}rmSync(dir,{recursive:true,force:true}); }
