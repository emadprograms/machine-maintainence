// One place to choose and generate every report. Monthly calculations stay in report.js.
import { register, rowsFor, markTable } from './tables.js';
let jobs = [], machines = [], machineReport = null, stockReport = null, sequence = 0;
const money = (v) => Number(v || 0).toFixed(2);
const type = () => $('#report-type').value;
function buttons() {
  const t = type();
  $('#report-csv').hidden = t === 'work';
  $('#report-print').disabled = t === 'work' ? !$('#report-work-select').value
    : t === 'machine' ? !machineReport : t === 'parts' ? !stockReport : false;
  $('#report-csv').disabled = t === 'machine' ? !machineReport : t === 'parts' ? !stockReport : false;
}
function drawMachine() {
  const rows = rowsFor('report-machine-rows', machineReport?.jobs || []);
  $('#report-machine-rows').innerHTML = rows.map((j) => `<tr>${strong(j.code || `Job ${j.id}`)}${soft(j.title)}${soft(j.status.replace('_', ' '))}<td>${Number(j.hours)}</td><td>${money(j.cost)}</td></tr>`).join('') || emptyRow(5, 'No work orders for this machine.');
  markTable('report-machine-rows');
}
function drawParts() {
  const rows = rowsFor('report-parts-rows', stockReport?.parts || []);
  $('#report-parts-rows').innerHTML = rows.map((p) => `<tr>${strong(p.name)}${soft(p.reference)}<td>${Number(p.qty)}</td><td>${p.unit_price == null ? 'Not set' : money(p.unit_price)}</td><td>${Number(p.reorder_level)}</td></tr>`).join('') || emptyRow(5, 'No spare parts yet.');
  markTable('report-parts-rows');
}
register('report-machine-rows', { code: j => j.code, title: j => j.title, status: j => j.status, hours: j => Number(j.hours), cost: j => Number(j.cost) }, drawMachine);
register('report-parts-rows', { name: p => p.name, reference: p => p.reference, qty: p => Number(p.qty), unit_price: p => p.unit_price, reorder_level: p => Number(p.reorder_level) }, drawParts);
export async function changeReportType() {
  const t = type(), run = ++sequence;
  for (const name of ['monthly', 'work', 'machine', 'parts']) $(`#report-${name}${name === 'monthly' ? '' : '-panel'}`).hidden = name !== t;
  machineReport = null; stockReport = null; buttons();
  try {
    if (t === 'monthly') { await window.loadReport(); return; }
    if (t === 'work') {
      $('#report-work-status').textContent = 'Loading work orders…';
      const result = await api('/work-orders'); if (run !== sequence) return;
      jobs = result; filterReportJobs();
    } else if (t === 'machine') {
      const previous = $('#report-machine-select').value;
      $('#report-machine-status').textContent = 'Loading machines…'; $('#report-machine-rows').innerHTML = '';
      const result = await api('/equipment'); if (run !== sequence) return; machines = result;
      $('#report-machine-select').innerHTML = `<option value="">Choose a machine</option>${machines.map(m => `<option value="${Number(m.id)}">${esc(m.name)}${m.status === 'retired' ? ' (retired)' : ''}</option>`).join('')}`;
      if (machines.some(m => String(m.id) === previous)) { $('#report-machine-select').value = previous; await loadMachineReport(); return; }
      $('#report-machine-status').textContent = machines.length ? 'Choose a machine to generate its report.' : 'No machines yet.';
    } else if (t === 'parts') {
      await loadInventoryReport(); return;
    }
    buttons();
  } catch (error) {
    if (run !== sequence) return;
    $(`#report-${t}-status`).textContent = `Could not load report: ${error.message}. Choose the report again to retry.`;
    buttons();
  }
}
export function filterReportJobs() {
  const q = $('#report-work-search').value.trim().toLowerCase(), select = $('#report-work-select'), previous = select.value;
  const filtered = jobs.filter(j => `${j.code || ''} ${j.title} ${j.equipment_name}`.toLowerCase().includes(q));
  select.innerHTML = '<option value="">Choose a work order</option>' + filtered.map(j => `<option value="${Number(j.id)}">${esc(j.code || `Job ${j.id}`)} · ${esc(j.equipment_name)} · ${esc(j.title)}</option>`).join('');
  if (filtered.some(j => String(j.id) === previous)) select.value = previous;
  $('#report-work-status').textContent = filtered.length ? `${filtered.length} work ${filtered.length === 1 ? 'order' : 'orders'} available` : 'No matching work orders.';
  buttons();
}
export function reportSelectionChanged() { buttons(); }
export async function loadMachineReport() {
  const machineId = $('#report-machine-select').value, run = ++sequence;
  machineReport = null; buttons(); $('#report-machine-rows').innerHTML = '';
  if (!machineId) { $('#report-machine-status').textContent = 'Choose a machine to generate its report.'; return; }
  $('#report-machine-status').textContent = 'Loading machine report…';
  try {
    const query = $('#report-machine-search').value.trim();
    const r = await api(`/reports/machine/${Number(machineId)}?q=${encodeURIComponent(query)}`); if (run !== sequence) return;
    if (r.cost_basis !== 'parts') throw new Error('Parts-only costs are unavailable. Restart the server after updating');
    machineReport = r;
    $('#report-machine-status').textContent = `${r.total_jobs} work ${r.total_jobs === 1 ? 'order' : 'orders'} · ${r.counts.open} open · ${r.counts.in_progress} in progress · ${r.counts.done} completed · ${r.total_hours} hours · parts cost ${money(r.total_cost)}`;
    drawMachine(); buttons();
  } catch (e) { if (run === sequence) { $('#report-machine-status').textContent = `Could not load report: ${e.message}`; buttons(); } }
}
export async function loadInventoryReport() {
  const run = ++sequence, query = $('#report-parts-search').value.trim();
  stockReport = null; buttons(); $('#report-parts-status').textContent = 'Loading inventory…';
  try {
    const result = await api(`/reports/parts?q=${encodeURIComponent(query)}`); if (run !== sequence) return;
    stockReport = result;
    $('#report-parts-status').textContent = `${result.total_parts} parts · ${result.total_units} units · ${result.low_stock} at or below reorder · known stock value ${money(result.known_stock_value)}${result.missing_prices ? ` · ${result.missing_prices} without a price` : ''}`;
    drawParts(); buttons();
  } catch (e) { if (run === sequence) { $('#report-parts-status').textContent = `Could not load inventory: ${e.message}`; buttons(); } }
}
const reloadFilteredMachine = debounce(() => { if (type() === 'machine') loadMachineReport(); });
const reloadFilteredParts = debounce(() => { if (type() === 'parts') loadInventoryReport(); });
export function filterHubMachine() { ++sequence; machineReport = null; buttons(); reloadFilteredMachine(); }
export function filterHubParts() { ++sequence; stockReport = null; buttons(); reloadFilteredParts(); }
export function printHubReport() {
  const t = type(); let path;
  if (t === 'work' && $('#report-work-select').value) path = `/print-job.html?id=${Number($('#report-work-select').value)}`;
  else if (t === 'machine' && machineReport) path = `/print-report.html?type=machine&id=${Number(machineReport.machine.id)}&q=${encodeURIComponent(machineReport.query || "")}`;
  else if (t === 'parts' && stockReport) path = `/print-report.html?type=parts&q=${encodeURIComponent(stockReport.query || '')}`;
  else if (t === 'monthly' && $('#report-month').value) path = `/print-report.html?type=monthly&month=${encodeURIComponent($('#report-month').value)}`;
  if (path && !window.open(path, '_blank')) alert('Allow pop-ups to print this report.');
}
export function downloadHubReport() {
  const t = type();
  if (t === 'monthly') return window.downloadReport();
  if (t === 'machine' && machineReport) window.location = `/api/export/machine-report.csv?id=${Number(machineReport.machine.id)}&q=${encodeURIComponent(machineReport.query || "")}`;
  if (t === 'parts' && stockReport) window.location = `/api/export/inventory-report.csv?q=${encodeURIComponent(stockReport.query || '')}`;
}
Object.assign(window, { changeReportType, filterReportJobs, reportSelectionChanged, loadMachineReport, filterHubMachine, filterHubParts, printHubReport, downloadHubReport });
