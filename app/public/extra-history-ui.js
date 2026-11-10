// Maintenance completions and spare-part usage: independent tabs with the same
// filter, sort and print-snapshot behaviour as machine/work history.
import { register, rowsFor, markTable } from './tables.js';
const config = {
  pm: { list: 'Maintenance', title: 'Maintenance history', view: 'maintenance', note: 'Completed scheduled maintenance. Older schedules show only their last known completion.', columns: [
    ['equipment_name','Machine'], ['category','Category'], ['title','Task'], ['end_day','Completed'], ['owner','Recorded by'], ['source','Record source'],
  ] },
  parts: { list: 'Spare parts', title: 'Spare parts history', view: 'parts', note: 'Current recorded parts used on work orders, not a stock ledger. Purchases and adjustments are not tracked. Older or direct job usage has no recorded date or reliable per-use cost and is excluded by date filters. Stage corrections change the displayed usage.', columns: [
    ['event_day','Usage date'], ['part_name','Part'], ['reference','Reference'], ['equipment_name','Machine'], ['category','Category'], ['code','Work order'], ['title','Job'], ['stage','Stage'], ['qty','Quantity'], ['unit_price','Actual unit cost'], ['cost','Parts cost'], ['source','Record source'],
  ] },
};
const states = { pm: { tab: 'list', run: 0 }, parts: { tab: 'list', run: 0 } };
const id = (kind, name) => document.getElementById(`extra-${kind}-${name}`);
const bodyId = kind => `extra-${kind}-rows`;
const text = (r, key) => {
  if (key === 'source') return r.source === 'legacy' ? 'Last known' : r.source === 'undated' ? 'Undated job usage' : r.source === 'stage' ? 'Stage usage' : 'Recorded';
  if (['unit_price','cost'].includes(key)) return r[key] == null ? '—' : Number(r[key]).toFixed(2);
  return r[key] == null || r[key] === '' ? '—' : String(r[key]);
};
function markup(kind) {
  const c = config[kind];
  id(kind,'tabs').innerHTML = `<div class="section-tabs" role="tablist" aria-label="${c.list} views"><button type="button" role="tab" id="extra-${kind}-tab-list" aria-controls="extra-${kind}-list" aria-selected="true" tabindex="0">${c.list}</button><button type="button" role="tab" id="extra-${kind}-tab-history" aria-controls="extra-${kind}-history" aria-selected="false" tabindex="-1">${c.title}</button></div>`;
  id(kind,'history').innerHTML = `<div class="page-head"><div><h2>${c.title}</h2><p class="page-sub">${c.note}</p></div><button type="button" class="ghost" data-action="refresh">Refresh</button></div>
    <div class="card"><div class="card-toolbar history-filters">
    <label><span>From</span><input type="date" id="extra-${kind}-from"></label><label><span>To</span><input type="date" id="extra-${kind}-to"></label>
    <label><span>Category</span><select id="extra-${kind}-category"><option value="">All categories</option></select></label>
    <label><span>Machines (none = all)</span><select id="extra-${kind}-machines" multiple size="3" aria-label="Choose machines; leave none selected for all"></select></label>
    ${kind === 'parts' ? `<label><span>Parts (none = all)</span><select id="extra-parts-parts" multiple size="3" aria-label="Choose parts; leave none selected for all"></select></label>` : ''}
    <label><span>Search</span><input type="search" maxlength="200" id="extra-${kind}-search" placeholder="Search history"></label>
    <button type="button" class="ghost small" data-action="clear">Clear</button><button type="button" class="ghost small" id="extra-${kind}-csv" data-action="csv" disabled>Download CSV</button><button type="button" class="primary small" id="extra-${kind}-print" data-action="print" disabled>Print / Save as PDF</button></div>
    <p class="hint">Select multiple items with Ctrl or Command; no selection means all. Filters work together.</p><p class="summary-line" role="status" id="extra-${kind}-summary"></p><div class="table-wrap"><table class="table"><thead><tr>${c.columns.map(([key,label])=>`<th aria-sort="none"><button type="button" class="sort-btn" data-sort="${key}">${label}<span class="sort-mark" aria-hidden="true"></span></button></th>`).join('')}${kind === 'parts' ? '<th>Actions</th>' : ''}</tr></thead><tbody id="${bodyId(kind)}"></tbody></table></div></div>`;
  for (const tab of ['list','history']) id(kind,`tab-${tab}`).addEventListener('click',()=>select(kind,tab));
  id(kind,'tabs').addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault(); const next = event.key === 'Home' ? 'list' : event.key === 'End' ? 'history' : states[kind].tab === 'list' ? 'history' : 'list';
    select(kind,next); id(kind,`tab-${next}`).focus();
  });
  for (const field of ['from','to','category','machines',...(kind === 'parts' ? ['parts'] : [])]) id(kind,field).addEventListener('change',()=>load(kind));
  id(kind,'search').addEventListener('input',()=>{ invalidate(kind); clearTimeout(states[kind].timer); states[kind].timer=setTimeout(()=>load(kind),150); });
  id(kind,'history').addEventListener('click', event => {
    const button = event.target.closest('button[data-action]'); if (!button) return;
    if (button.dataset.action === 'refresh') load(kind);
    if (button.dataset.action === 'clear') clear(kind);
    if (button.dataset.action === 'csv') download(kind);
    if (button.dataset.action === 'print') print(kind);
    if (button.dataset.action === 'timeline') timeline(kind,Number(button.dataset.id));
  });
  register(bodyId(kind), Object.fromEntries(c.columns.map(([key])=>[key,row=>row[key]])),()=>draw(kind));
}
function select(kind, tab, shouldLoad = true) {
  if (!states[kind] || !['list','history'].includes(tab)) return;
  states[kind].tab = tab;
  for (const name of ['list','history']) { const selected = name === tab; id(kind,`tab-${name}`).setAttribute('aria-selected',String(selected)); id(kind,`tab-${name}`).tabIndex=selected?0:-1; id(kind,name).hidden=!selected; }
  if (shouldLoad) return tab === 'history' ? load(kind) : (kind === 'pm' ? window.loadPm() : window.loadParts());
}
function query(kind) {
  const p = new URLSearchParams({view:config[kind].view});
  for (const name of ['from','to','category','search']) { const v=id(kind,name).value.trim(); if (v) p.set(name === 'search' ? 'q' : name,v); }
  for (const name of ['machines',...(kind === 'parts' ? ['parts'] : [])]) { const values=[...id(kind,name).selectedOptions].map(o=>o.value); if(values.length) p.set(name,values.join(',')); }
  return p.toString();
}
function fillSelect(select, rows, label) {
  const old=new Map([...select.selectedOptions].map(o=>[o.value,o.textContent]));
  const available=new Set(rows.map(r=>String(r.id)));
  select.innerHTML=rows.map(r=>`<option value="${Number(r.id)}"${old.has(String(r.id))?' selected':''}>${esc(label(r))}</option>`).join('') + [...old].filter(([v])=>!available.has(v)).map(([v,name])=>`<option value="${esc(v)}" selected>${esc(name.replace(/ \(unavailable\)$/,''))} (unavailable)</option>`).join('');
}
function populate(kind, machines, parts) {
  fillSelect(id(kind,'machines'),machines,m=>m.name+(m.status==='retired'?' (retired)':''));
  if (kind === 'parts') fillSelect(id(kind,'parts'),parts,p=>p.name+(p.reference?` · ${p.reference}`:''));
  const field=id(kind,'category'), previous=field.value;
  const categories=[...new Set([...machines.map(m=>m.category).filter(Boolean),...(previous?[previous]:[])])].sort((a,b)=>a.localeCompare(b));
  field.innerHTML='<option value="">All categories</option>'+categories.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join(''); field.value=previous;
}
function disable(kind, value) { id(kind,'print').disabled=value; id(kind,'csv').disabled=value; }
function invalidate(kind) { const s=states[kind]; ++s.run; s.rows=null; s.query=null; disable(kind,true); id(kind,'summary').textContent='Loading history…'; id(kind,'rows').innerHTML=emptyRow(config[kind].columns.length+(kind==='parts'?1:0),'Loading history…'); }
function draw(kind) {
  const c=config[kind], rows=rowsFor(bodyId(kind),states[kind].rows || []);
  id(kind,'rows').innerHTML=rows.map(r=>`<tr>${c.columns.map(([key])=>`<td>${esc(text(r,key))}</td>`).join('')}${kind==='parts'?`<td><button type="button" class="ghost small" data-action="timeline" data-id="${Number(r.work_id)}">Timeline</button></td>`:''}</tr>`).join('') || emptyRow(c.columns.length+(kind==='parts'?1:0),'No history matches these filters.');
  markTable(bodyId(kind));
}
async function load(kind) {
  const s=states[kind]; if (!s) return; clearTimeout(s.timer); invalidate(kind);
  const run=s.run, requested=query(kind);
  try {
    const [result,machines,parts]=await Promise.all([api(`/history-table?${requested}`),api('/equipment'),kind==='parts'?api('/parts'):Promise.resolve([])]);
    if (run!==s.run) return;
    populate(kind,machines,parts); if (query(kind)!==requested) return load(kind);
    s.rows=result.rows; s.query=requested; s.zone=result.time_zone;
    id(kind,'summary').textContent=`${result.total} ${result.total===1?'record':'records'} · dates use ${result.time_zone}`;
    draw(kind); disable(kind,false);
  } catch(error) { if(run!==s.run)return; s.rows=null; s.query=null; id(kind,'summary').textContent=`Could not load history: ${error.message}`; id(kind,'rows').innerHTML=''; }
}
function clear(kind) {
  for (const name of ['from','to','category','search']) id(kind,name).value='';
  for (const name of ['machines',...(kind==='parts'?['parts']:[])]) for (const option of id(kind,name).options) option.selected=false;
  return load(kind);
}
function download(kind) { if(states[kind].query && states[kind].query===query(kind)) window.location=`/api/export/history-table.csv?${states[kind].query}`; }
function print(kind) {
  const s=states[kind], c=config[kind]; if(!s.rows || s.query!==query(kind)) return;
  const win=window.open('','_blank'); if(!win) return alert('Allow pop-ups to print this report.');
  const rows=rowsFor(bodyId(kind),s.rows), selected=name=>[...id(kind,name).selectedOptions].map(o=>o.textContent).join(', ') || `All ${name}`;
  const filters=`Dates: ${id(kind,'from').value||'Any'} to ${id(kind,'to').value||'Any'} · ${id(kind,'category').value||'All categories'} · ${selected('machines')}${kind==='parts'?' · '+selected('parts'):''} · Search: ${id(kind,'search').value||'none'} · Time zone: ${s.zone}`;
  win.document.open(); win.document.write(`<!doctype html><html><head><title>${esc(c.title)}</title><style>body{font:12px Arial,sans-serif;color:#111}table{border-collapse:collapse;width:100%}th,td{border:1px solid #aaa;padding:5px;text-align:left;vertical-align:top}thead{display:table-header-group}tr{break-inside:avoid}h1{font-size:20px}@page{size:landscape;margin:12mm}</style></head><body><h1>${esc(c.title)}</h1><p>${esc(filters)}</p><p>${esc(c.note)}</p><p>${rows.length} records</p><table><thead><tr>${c.columns.map(([,label])=>`<th>${esc(label)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${c.columns.map(([key])=>`<td>${esc(text(r,key))}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${c.columns.length}">No records</td></tr>`}</tbody></table></body></html>`); win.document.close(); win.focus(); setTimeout(()=>win.print(),100);
}
async function timeline(kind, workId) {
  const s=states[kind], row=s.rows?.find(r=>r.work_id===workId); if(!row)return;
  const run=s.run, token=s.timeline=(s.timeline||0)+1;
  const visible=()=>s.run===run && s.timeline===token && !id(kind,'history').hidden && !document.querySelector(`section[data-page="${kind}"]`).classList.contains('hidden');
  try { const jobs=await api(`/work-orders?equipment_id=${row.equipment_id}`), job=jobs.find(j=>j.id===workId); if(!job)throw Error('This work order is no longer available'); if(!visible())return; const ui=await import('./work-updates.js'); if(visible())await ui.openWorkUpdates(job,true,()=>load(kind)); }
  catch(error) { if(visible())id(kind,'summary').textContent=`Could not open timeline: ${error.message}`; }
}
for (const kind of Object.keys(config)) markup(kind);
window.extraHistoryTabs={select,load,isHistory:kind=>states[kind]?.tab==='history'};
