// One machine’s job timeline dialog. The filterable history tables live in history-tables-ui.js.

import { register, rowsFor, markTable } from './tables.js';
import { zoneDate } from './time-zone.js';

const STATUS_LABEL = { open: 'Open', in_progress: 'In progress', done: 'Done' };
const STATUS_COLOUR = { open: 'amber', in_progress: 'blue', done: 'green' };

/** A stored timestamp as the day it happened. "2026-11-06 15:26:57" -> "2026-11-06". */
const dayOf = (stamp) => zoneDate(stamp) || '';

function statusBadge(status) {
  return `<td>${badge(STATUS_LABEL[status] || status, STATUS_COLOUR[status] || 'grey')}</td>`;
}

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
  openMachineHistory, closeMachineHistory, openMachineHistoryJob,
});
