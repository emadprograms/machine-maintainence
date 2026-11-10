// One month of work: how much was closed, how long it took, and what it cost.
//
// Everything here is presentation — the numbers arrive from /api/report already added up, for the
// same reason as the dashboard: a number the database can compute should not be
// computed in the browser where nothing tests it.

import { register, rowsFor, markTable } from './tables.js';
import { todayInZone } from './time-zone.js';

const money = (n) => Number(n || 0).toFixed(2);

/** "2026-11" — the shape an <input type="month"> and the server both use. */
function thisMonth() {
  return todayInZone().slice(0, 7);
}

function reportRow(m) {
  return `<tr>
    ${strong(m.name)}
    <td class="cell-num">${Number(m.jobs)}</td>
    <td class="cell-num">${Number(m.hours)}</td>
    <td class="cell-num">${money(m.total)}</td>
  </tr>`;
}

let reportMachines = [];
let reportMonth = '';
let defaultMonth = '';
let partsOnlyReport = false;

// Preserve an explicitly selected month, but move an untouched default when
// the workshop zone changes across a month boundary.
export function workshopZoneChanged(zone) {
  const field = $('#report-month');
  if (field && defaultMonth && field.value === defaultMonth) {
    defaultMonth = todayInZone(zone).slice(0, 7);
    field.value = defaultMonth;
  }
}

function drawReport() {
  const rows = rowsFor('report-rows', reportMachines);
  $('#report-rows').innerHTML = rows.length
    ? rows.map(reportRow).join('')
    : emptyRow(4, `Nothing was closed in ${reportMonth}. Pick another month, or finish a job first.`);
  markTable('report-rows');
}

// Sort the four report columns.
register('report-rows', {
  name: (m) => m.name,
  jobs: (m) => Number(m.jobs),
  hours: (m) => Number(m.hours),
  total: (m) => Number(m.total),
}, drawReport);

export function renderReport(r) {
  $('#report-summary').textContent = r.jobs === 0 ? ''
    : `${r.jobs} ${r.jobs === 1 ? 'job' : 'jobs'} · ${r.hours} h · parts cost ${money(r.total)}`;
  reportMachines = r.machines;
  reportMonth = r.month;
  drawReport();
}

export function renderReportError(message) {
  // An error is not a month with nothing in it. Same rule as the dashboard and
  // the history: a failed request may not say "all clear".
  $('#report-summary').textContent = '';
  $('#report-rows').innerHTML = `<tr><td colspan="4" class="cell-say cell-error">` +
    `Could not build the report. ${esc(message)}</td></tr>`;
}

export async function loadReport() {
  const month = $('#report-month');
  if (month && !month.value) { month.value = thisMonth(); defaultMonth = month.value; }
  else if (month && month.value !== defaultMonth) defaultMonth = '';
  partsOnlyReport = false;
  try {
    const report = await api(`/report?month=${encodeURIComponent(month.value)}`);
    if (report.cost_basis !== 'parts') throw new Error('Parts-only costs are unavailable. Restart the server after updating.');
    partsOnlyReport = true;
    renderReport(report);
  } catch (e) {
    renderReportError(e.message);
  }
}

export function downloadReport() {
  if (!partsOnlyReport) { alert('Parts-only report is unavailable. Reload this page or restart the server after updating.'); return; }
  const month = $('#report-month').value || thisMonth();
  window.location = `/api/export/report.csv?month=${encodeURIComponent(month)}`;
}

Object.assign(window, { loadReport, downloadReport });
