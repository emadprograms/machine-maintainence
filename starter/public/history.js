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

const STATUS_LABEL = { open: 'Open', in_progress: 'In progress', done: 'Done' };
const STATUS_COLOUR = { open: 'amber', in_progress: 'blue', done: 'green' };

/** A stored timestamp as the day it happened. "2026-11-06 15:26:57" -> "2026-11-06". */
const dayOf = (stamp) => (stamp ? String(stamp).slice(0, 10) : '');

function statusBadge(status) {
  return `<td>${badge(STATUS_LABEL[status] || status, STATUS_COLOUR[status] || 'grey')}</td>`;
}

// ------------------------------------------------------------ the screen
function historyQuery() {
  const params = new URLSearchParams();
  // The History screen is about finished work; a job still running belongs on
  // the work orders screen, where you can act on it.
  params.set('status', 'done');
  const from = $('#history-from').value;
  const to = $('#history-to').value;
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return `?${params.toString()}`;
}

function historyHasRange() {
  return Boolean($('#history-from').value || $('#history-to').value);
}

function historyRow(w) {
  return `<tr>
    ${strong(w.equipment_name)}
    <td>${esc(w.title)}</td>
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
  const range = historyHasRange();
  const count = Number(total ?? 0);
  $('#history-summary').textContent = count === 0 ? ''
    : `${count} closed ${count === 1 ? 'job' : 'jobs'}`
      + (shown < count ? ` · showing the most recent ${shown}` : '');
  $('#history-rows').innerHTML = rows.length
    ? rows.map(historyRow).join('')
    : emptyRow(5, range
      ? 'Nothing was closed between those dates. Widen the range, or clear it.'
      : 'Nothing has been closed yet. A work order appears here once it is marked done.');
}

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
  return loadHistory();
}

// --------------------------------------------------- one machine's history
function machineHistoryRow(w) {
  return `<tr>
    <td>${esc(w.title)}</td>
    ${statusBadge(w.status)}
    ${soft(w.owner, 'Nobody')}
    <td class="cell-num">${esc(dayOf(w.created_at))}</td>
    <td class="cell-num">${esc(dayOf(w.closed_at) || '—')}</td>
  </tr>`;
}

/**
 * Opened from a machine's row. `el` is the button, so the machine's name comes
 * from the row it sits in rather than being threaded through an attribute where
 * an apostrophe in a name would break the markup.
 */
export async function openMachineHistory(id, el) {
  const name = el?.closest('tr')?.querySelector('td')?.textContent?.trim() || 'This machine';
  $('#machine-history-title').textContent = name;
  $('#machine-history-rows').innerHTML = emptyRow(5, 'Loading this machine’s history…');
  openForm('machine-history');
  try {
    const data = await api(`/history?equipment_id=${encodeURIComponent(id)}`);
    $('#machine-history-rows').innerHTML = data.rows.length
      ? data.rows.map(machineHistoryRow).join('')
      : emptyRow(5, `Nothing has been reported against ${name} yet.`);
  } catch (e) {
    $('#machine-history-rows').innerHTML = `<tr><td colspan="5" class="cell-say cell-error">` +
      `Could not load this machine’s history. ${esc(e.message)}</td></tr>`;
  }
}

export function closeMachineHistory() {
  closeForm('machine-history');
}

// The markup calls these by name from onclick attributes, which cannot see a
// module's exports. Four lines here beats four wrappers in app.js.
Object.assign(window, {
  loadHistory, clearHistoryFilters, openMachineHistory, closeMachineHistory,
});
