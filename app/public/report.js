// One month of work: how much was closed, how long it took, and what it cost.
//
// The rate is a setting, not a constant, because an hourly rate changes and a
// deployment should not be how you change it. Everything else here is
// presentation — the numbers arrive from /api/report already added up, for the
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
    <td class="cell-num">${money(m.parts_cost)}</td>
    <td class="cell-num">${money(m.labour_cost)}</td>
    <td class="cell-num">${money(m.total)}</td>
  </tr>`;
}

let reportMachines = [];
let reportMonth = '';
let defaultMonth = '';

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
    : emptyRow(6, `Nothing was closed in ${reportMonth}. Pick another month, or finish a job first.`);
  markTable('report-rows');
}

// The six columns are already numbers; sorting Total is the one people want first,
// and it costs nothing to offer the other five the same way.
register('report-rows', {
  name: (m) => m.name,
  jobs: (m) => Number(m.jobs),
  hours: (m) => Number(m.hours),
  parts_cost: (m) => Number(m.parts_cost),
  labour_cost: (m) => Number(m.labour_cost),
  total: (m) => Number(m.total),
}, drawReport);

export function renderReport(r) {
  $('#report-summary').textContent = r.jobs === 0 ? ''
    : `${r.jobs} ${r.jobs === 1 ? 'job' : 'jobs'} · ${r.hours} h · parts ${money(r.parts_cost)}`
      + ` · labour ${money(r.labour_cost)} · total ${money(r.total)}`;
  reportMachines = r.machines;
  reportMonth = r.month;
  drawReport();
}

export function renderReportError(message) {
  // An error is not a month with nothing in it. Same rule as the dashboard and
  // the history: a failed request may not say "all clear".
  $('#report-summary').textContent = '';
  $('#report-rows').innerHTML = `<tr><td colspan="6" class="cell-say cell-error">` +
    `Could not build the report. ${esc(message)}</td></tr>`;
}

export async function loadReport() {
  const month = $('#report-month');
  if (month && !month.value) { month.value = thisMonth(); defaultMonth = month.value; }
  else if (month && month.value !== defaultMonth) defaultMonth = '';
  try {
    const report = await api(`/report?month=${encodeURIComponent(month.value)}`);
    // The rate belongs to the installation, not to the month, so it is filled in
    // once — otherwise changing the month would overwrite what someone is typing.
    const rate = $('#report-rate');
    if (rate && !rate.dataset.filled) {
      rate.value = report.hourly_rate;
      rate.dataset.filled = '1';
    }
    renderReport(report);
  } catch (e) {
    renderReportError(e.message);
  }
}

export async function saveRate() {
  try {
    await api('/settings', {
      method: 'PUT',
      body: JSON.stringify({ hourly_rate: $('#report-rate').value }),
    });
    await loadReport();
  } catch (e) {
    alert(e.message);          // the server's sentence, unchanged, as everywhere else
  }
}

export function downloadReport() {
  const month = $('#report-month').value || thisMonth();
  window.location = `/api/export/report.csv?month=${encodeURIComponent(month)}`;
}

Object.assign(window, { loadReport, saveRate, downloadReport });
