// The record: everything that has been closed, and everything that ever happened
// to one machine.
//
// Its own file for the same reason as shell.js and dashboard.js — the
// readability promise is per file. The two views share one endpoint, because a
// machine's history and the workshop's history are the same query with a
// different filter, and two queries would drift.
//
// It uses the helpers app.js already defines (esc, strong, soft, badge,
// emptyRow, api, $) rather than repeating them: this is one page, not a bundle
// of independent widgets.

import { register, rowsFor, markTable } from './tables.js';
import { zoneDate } from './time-zone.js';

const STATUS_LABEL = { open: 'Open', in_progress: 'In progress', done: 'Done' };
const STATUS_COLOUR = { open: 'amber', in_progress: 'blue', done: 'green' };

/** A stored timestamp as the day it happened. "2026-11-06 15:26:57" -> "2026-11-06". */
const dayOf = (stamp) => zoneDate(stamp) || '';

function statusBadge(status) {
  return `<td>${badge(STATUS_LABEL[status] || status, STATUS_COLOUR[status] || 'grey')}</td>`;
}

// ------------------------------------------------------------ the screen
/**
 * The filters on the History screen, as a query string. The screen and its CSV
 * download both call this — the file is the screen's query with another output.
 */
function historyQuery() {
  const params = new URLSearchParams();
  // The History screen is about finished work; a job still running belongs on
  // the work orders screen, where you can act on it.
  params.set('status', 'done');
  const from = $('#history-from').value;
  const to = $('#history-to').value;
  const q = ($('#history-search')?.value || '').trim();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (q) params.set('q', q);
  return `?${params.toString()}`;
}

function historyHasRange() {
  return Boolean($('#history-from').value || $('#history-to').value);
}

let historyRows = [];

function historyRow(w) {
  return `<tr>
    ${strong(w.equipment_name)}
    <td class="cell-strong">${esc(w.title)}<span class="row-sub">${esc(w.code || '')}${w.resolution
      ? ` · ${esc(w.resolution)}` : ''}</span></td>
    <td class="cell-num">${esc(dayOf(w.closed_at))}</td>
    ${soft(w.owner, 'Nobody')}
    <td>${esc(w.priority)}</td>
  </tr>`;
}

function renderHistoryError(message) {
  // A failed load is not an empty range. Without this the two would share a
  // sentence, and "nothing closed" is a claim a broken request cannot make.
  $('#history-summary').textContent = '';
  $('#history-rows').innerHTML = `<tr><td colspan="5" class="cell-say cell-error">` +
    `Could not load the history. ${esc(message)}</td></tr>`;
}

export function renderHistory({ rows, total, shown }) {
  const count = Number(total ?? 0);
  $('#history-summary').textContent = count === 0 ? ''
    : `${count} closed ${count === 1 ? 'job' : 'jobs'}`
      + (shown < count ? ` · showing the most recent ${shown}` : '');
  historyRows = rows;
  drawHistory();
}

/** Drawn from the rows the last load returned, so sorting a column costs no request
 *  and cannot disagree with the summary line above it. */
function drawHistory() {
  const range = historyHasRange();
  const searched = ($('#history-search')?.value || '').trim();
  const rows = rowsFor('history-rows', historyRows);
  $('#history-rows').innerHTML = rows.length
    ? rows.map(historyRow).join('')
    : emptyRow(5, searched
      ? `Nothing closed matches "${searched}". Clear the search to see everything.`
      : range
        ? 'Nothing was closed between those dates. Widen the range, or clear it.'
        : 'Nothing has been closed yet. A work order appears here once it is marked done.');
  markTable('history-rows');
}

register('history-rows', {
  equipment_name: (w) => w.equipment_name,
  title: (w) => w.title,
  closed_at: (w) => w.closed_at,
  owner: (w) => w.owner,
  priority: (w) => ({ high: 0, medium: 1, low: 2 }[w.priority] ?? 3),
}, drawHistory);

export async function loadHistory() {
  try {
    renderHistory(await api(`/history${historyQuery()}`));
  } catch (e) {
    renderHistoryError(e.message);
  }
}

export function clearHistoryFilters() {
  $('#history-from').value = '';
  $('#history-to').value = '';
  if ($('#history-search')) $('#history-search').value = '';
  return loadHistory();
}

/** The same filters as the screen, written out as a file. */
export function downloadHistory() {
  window.location = `/api/export/history.csv${historyQuery()}`;
}

export const searchHistory = debounce(() => loadHistory());

// --------------------------------------------------- one machine's history
let machineHistory = [], machineHistoryId = null, machineHistoryLoad = 0, machineJobLoad = 0;

/** One machine's history, drawn from what was just fetched. Sorting it is the same
 *  click as the main table's, because it is the same kit. */
function drawMachineHistory(name = $('#machine-history-title').textContent) {
  const rows = rowsFor('machine-history-rows', machineHistory);
  $('#machine-history-rows').innerHTML = rows.length
    ? rows.map(machineHistoryRow).join('')
    : emptyRow(6, `Nothing has been reported against ${name} yet.`);
  markTable('machine-history-rows');
}

register('machine-history-rows', {
  code: (w) => w.code,
  title: (w) => w.title,
  status: (w) => ({ open: 0, in_progress: 1, done: 2 }[w.status] ?? 3),
  owner: (w) => w.owner,
  created_at: (w) => w.created_at,
  closed_at: (w) => w.closed_at,
}, drawMachineHistory);

function machineHistoryRow(w) {
  return `<tr class="machine-history-row" onclick="openMachineHistoryJob(${Number(w.id)})">
    <td><button type="button" class="history-job" aria-label="View timeline for ${esc(w.code || w.title)}">${esc(w.code || `Job ${w.id}`)}</button></td>
    <td>${esc(w.title)}</td>
    ${statusBadge(w.status)}
    ${soft(w.owner, 'Nobody')}
    <td class="cell-num">${esc(dayOf(w.created_at))}</td>
    <td class="cell-num">${esc(dayOf(w.closed_at) || '—')}</td>
  </tr>`;
}

// Fetch a fresh, unfiltered work-order snapshot for this machine. The work-list
// cache may contain a different filter, or may never have been opened at all.
export async function openMachineHistoryJob(jobId) {
  const machineId = machineHistoryId;
  if (!machineId || !machineHistory.some((w) => Number(w.id) === Number(jobId))) return;
  const request = ++machineJobLoad;
  const error = $('#machine-history-error'); error.hidden = false; error.textContent = 'Loading timeline…';
  try {
    const jobs = await api(`/work-orders?equipment_id=${encodeURIComponent(machineId)}`);
    const job = jobs.find((w) => Number(w.id) === Number(jobId));
    if (!job) throw new Error('This work order is no longer available');
    if (machineId !== machineHistoryId || request !== machineJobLoad) return;
    const updateUI = await import('./work-updates.js');
    if (machineId !== machineHistoryId || request !== machineJobLoad) return;
    error.hidden = true;
    await updateUI.openWorkUpdates(job, true, async () => {
      await refreshMachineHistory(machineId);
    });
  } catch (e) { if (machineId === machineHistoryId && request === machineJobLoad) { error.textContent = `Could not open this timeline: ${e.message}.`; error.hidden = false; } }
}

async function refreshMachineHistory(id) {
  const request = ++machineHistoryLoad;
  try {
    const data = await api(`/history?equipment_id=${encodeURIComponent(id)}`);
    if (request !== machineHistoryLoad || machineHistoryId !== id) return;
    machineHistory = data.rows;
    drawMachineHistory();
  } catch (e) {
    if (request !== machineHistoryLoad || machineHistoryId !== id) return;
    $('#machine-history-rows').innerHTML = `<tr><td colspan="6" class="cell-say cell-error">` +
      `Could not load this machine’s history. ${esc(e.message)}</td></tr>`;
  }
}

/**
 * Opened from a machine's row. `el` is the button, so the machine's name comes
 * from the row it sits in rather than being threaded through an attribute where
 * an apostrophe in a name would break the markup.
 */
export async function openMachineHistory(id, el) {
  // The name column, by class — not the first cell, which has been the photograph
  // since 261106-eqs. Reading `td` there titled the dialog "A" for a machine with
  // no picture, because the placeholder shows its first letter.
  const name = el?.closest('tr')?.querySelector('.cell-strong')?.textContent?.trim()
    || 'This machine';
  machineHistoryId = id; machineHistory = []; ++machineJobLoad;
  $('#machine-history-title').textContent = name;
  $('#machine-history-error').hidden = true;
  $('#machine-history-rows').innerHTML = emptyRow(6, 'Loading this machine’s history…');
  openForm('machine-history');
  await refreshMachineHistory(id);
}

function invalidateMachineHistory() { machineHistoryId = null; ++machineHistoryLoad; ++machineJobLoad; }
export function closeMachineHistory() {
  invalidateMachineHistory();
  closeForm('machine-history');
}
// Escape and other native dialog closes must invalidate pending requests too.
$('#machine-history').addEventListener?.('close', () => { if (!$('#machine-history').open) invalidateMachineHistory(); });

// The markup calls these by name from onclick attributes, which cannot see a
// module's exports. Four lines here beats four wrappers in app.js.
Object.assign(window, {
  loadHistory, clearHistoryFilters, openMachineHistory, closeMachineHistory, openMachineHistoryJob,
  downloadHistory, searchHistory,
});
