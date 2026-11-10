// Two independent history views share one query, row shape and printable snapshot.
import { register, rowsFor, markTable } from './tables.js';
const states = { machine: { run: 0 }, work: { run: 0 } };
const $id = (kind, suffix) => $(`#ht-${kind}-${suffix}`);
const valid = (kind) => Object.hasOwn(states, kind);
const cols = [
  ['equipment_name','Machine'], ['category','Category'], ['code','Work order'], ['title','Job / maintenance'],
  ['kind','Type'], ['status','Status'], ['opened_day','Reported'], ['start_day','Job start'], ['end_day','Job close / completion'],
  ['owner','Assigned / recorded by'], ['resolution','What was done'], ['hours','Hours'], ['cost','Parts cost'],
];
function text(row, key) {
  if (key === 'kind') return row.kind === 'maintenance' ? (row.source === 'legacy' ? 'Scheduled · last known' : 'Scheduled') : 'Work order';
  if (key === 'status') return String(row.status || '').replaceAll('_', ' ');
  if (key === 'cost') return row.cost == null ? '—' : Number(row.cost).toFixed(2);
  return row[key] == null || row[key] === '' ? '—' : String(row[key]);
}
function controls(kind, disabled) { $id(kind,'print').disabled = disabled; $id(kind,'csv').disabled = disabled; }
function query(kind) {
  const p = new URLSearchParams({ view: kind });
  for (const key of ['from','to','category','status','search']) {
    const value = $id(kind,key).value.trim();
    if (value) p.set(key === 'search' ? 'q' : key, value);
  }
  const ids = [...$id(kind,'machines').selectedOptions].map((o) => o.value);
  if (ids.length) p.set('machines', ids.join(','));
  return p.toString();
}
function populate(kind, machines) {
  const select = $id(kind,'machines'), category = $id(kind,'category');
  const selected = new Map([...select.selectedOptions].map((o) => [o.value, o.textContent]));
  const previous = category.value;
  const available = new Set(machines.map((m) => String(m.id)));
  select.innerHTML = machines.map((m) => `<option value="${Number(m.id)}"${selected.has(String(m.id)) ? ' selected' : ''}>${esc(m.name)}${m.status === 'retired' ? ' (retired)' : ''}</option>`).join('')
    + [...selected].filter(([id]) => !available.has(id)).map(([id, label]) => `<option value="${esc(id)}" selected>${esc(label.replace(/ \(unavailable\)$/, ''))} (unavailable)</option>`).join('');
  const categories = [...new Set([...machines.map((m) => m.category).filter(Boolean), ...(previous ? [previous] : [])])].sort((a,b) => a.localeCompare(b));
  category.innerHTML = '<option value="">All categories</option>' + categories.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  category.value = categories.includes(previous) ? previous : '';
}
function draw(kind) {
  const state = states[kind];
  if (state.loading) { $id(kind,'rows').innerHTML = `<tr><td colspan="${cols.length + 1}">Loading history…</td></tr>`; return; }
  const rows = rowsFor(`ht-${kind}-rows`, state.rows || []);
  $id(kind,'rows').innerHTML = rows.map((row) => `<tr>${cols.map(([key]) => `<td>${esc(text(row,key))}</td>`).join('')}<td>${row.kind === 'work' ? `<button type="button" class="ghost small" onclick="historyTimeline(${Number(row.id)}, '${kind}')">Timeline</button> <button type="button" class="ghost small" onclick="printHistoryJob(${Number(row.id)})">Print job</button>${row.status === 'done' && kind === 'work' ? ` <button type="button" class="ghost small" onclick="reopenHistoryJob(${Number(row.id)})">Reopen</button>` : ''}` : '—'}</td></tr>`).join('')
    || emptyRow(cols.length + 1, 'No history matches these filters.');
  markTable(`ht-${kind}-rows`);
}
for (const kind of Object.keys(states)) {
  register(`ht-${kind}-rows`, Object.fromEntries(cols.map(([key]) => [key, (row) => row[key]])), () => draw(kind));
}
export async function loadHistoryTable(kind) {
  if (!valid(kind)) return;
  const state = states[kind], run = ++state.run, requested = query(kind);
  controls(kind, true); state.loading = true; state.rows = null; state.query = null;
  $id(kind,'summary').textContent = 'Loading history…'; draw(kind);
  try {
    const [result, machines] = await Promise.all([api(`/history-table?${requested}`), api('/equipment')]);
    if (run !== state.run) return;
    // Preserve missing selected values rather than silently widening the query.
    populate(kind, machines);
    if (query(kind) !== requested) return loadHistoryTable(kind);
    state.loading = false; state.rows = result.rows; state.query = requested; state.zone = result.time_zone;
    $id(kind,'summary').textContent = `${result.total} ${result.total === 1 ? 'record' : 'records'} · dates use ${result.time_zone}`;
    draw(kind); controls(kind, false);
  } catch (error) {
    if (run !== state.run) return;
    state.loading = false; state.rows = null; state.query = null;
    $id(kind,'summary').textContent = `Could not load history: ${error.message}`;
    $id(kind,'rows').innerHTML = '';
  }
}
let timers = {};
export function searchHistoryTable(kind) {
  if (!valid(kind)) return;
  ++states[kind].run; states[kind].loading = true; states[kind].rows = null; states[kind].query = null; controls(kind, true);
  $id(kind,'summary').textContent = 'Loading history…'; draw(kind);
  clearTimeout(timers[kind]); timers[kind] = setTimeout(() => loadHistoryTable(kind), 150);
}
export function clearHistoryTable(kind) {
  if (!valid(kind)) return;
  for (const name of ['from','to','category','status','search']) $id(kind,name).value = '';
  for (const option of $id(kind,'machines').options) option.selected = false;
  return loadHistoryTable(kind);
}
export function downloadHistoryTable(kind) {
  if (valid(kind) && states[kind].query === query(kind)) window.location = `/api/export/history-table.csv?${states[kind].query}`;
}
export function printHistoryTable(kind) {
  if (!valid(kind) || !states[kind].rows || states[kind].query !== query(kind)) return;
  const win = window.open('', '_blank');
  if (!win) { alert('Allow pop-ups to print this report.'); return; }
  const rows = rowsFor(`ht-${kind}-rows`, states[kind].rows);
  const title = kind === 'machine' ? 'Machine history' : 'Work order history';
  const from = $id(kind,'from').value || 'Any', to = $id(kind,'to').value || 'Any';
  const selected = [...$id(kind,'machines').selectedOptions].map((o) => o.textContent).join(', ') || 'All machines';
  const category = $id(kind,'category').value || 'All categories';
  const filter = `Date overlap: ${from} to ${to} · ${category} · ${selected} · Status: ${$id(kind,'status').value || 'all'} · Search: ${$id(kind,'search').value || 'none'} · Time zone: ${states[kind].zone}`;
  win.document.open(); win.document.write(`<!doctype html><html><head><title>${esc(title)}</title><style>body{font:12px Arial,sans-serif;color:#111}table{border-collapse:collapse;width:100%}th,td{border:1px solid #aaa;padding:5px;text-align:left;vertical-align:top}thead{display:table-header-group}tr{break-inside:avoid}h1{font-size:20px}@page{size:landscape;margin:12mm}</style></head><body><h1>${esc(title)}</h1><p>${esc(filter)}</p><p>${rows.length} records · Costs are recorded parts only.${kind === 'machine' ? ' Older schedules show only the last known completion.' : ''}</p><table><thead><tr>${cols.map(([,label])=>`<th>${esc(label)}</th>`).join('')}</tr></thead><tbody>${rows.map((row)=>`<tr>${cols.map(([key])=>`<td>${esc(text(row,key))}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cols.length}">No records</td></tr>`}</tbody></table></body></html>`);
  win.document.close(); win.focus(); setTimeout(() => win.print(), 100);
}
export function printHistoryJob(id) {
  if (!window.open(`/print-job.html?id=${Number(id)}`, '_blank')) alert('Allow pop-ups to print this report.');
}
export async function historyTimeline(id, kind) {
  const state = states[kind], row = state?.rows?.find((r) => r.kind === 'work' && r.id === id);
  if (!row) return;
  const run = state.run, request = state.timeline = (state.timeline || 0) + 1;
  const stillVisible = () => state.run === run && state.timeline === request && !$(kind === 'machine' ? '#machine-history-panel' : '#work-history-panel').hidden && !$(kind === 'machine' ? 'section[data-page="equipment"]' : 'section[data-page="work"]').classList.contains('hidden');
  try {
    const jobs = await api(`/work-orders?equipment_id=${row.equipment_id}`);
    const job = jobs.find((j) => j.id === id);
    if (!job) throw new Error('This work order is no longer available');
    if (!stillVisible()) return;
    const ui = await import('./work-updates.js');
    if (!stillVisible()) return;
    await ui.openWorkUpdates(job, true, () => loadHistoryTable(kind));
  } catch (error) { if (stillVisible()) $id(kind,'summary').textContent = `Could not open timeline: ${error.message}`; }
}
export async function reopenHistoryJob(id) {
  try { await api(`/work-orders/${Number(id)}`, { method: 'PATCH', body: JSON.stringify({ status: 'open' }) }); await loadHistoryTable('work'); }
  catch (error) { $id('work','summary').textContent = `Could not reopen work order: ${error.message}`; }
}
Object.assign(window, { loadHistoryTable, searchHistoryTable, clearHistoryTable, downloadHistoryTable, printHistoryTable, printHistoryJob, historyTimeline, reopenHistoryJob });
