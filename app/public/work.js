// The work-orders screen: what needs fixing, the two forms that put a fault in,
// and the dialog that closes a job.
//
// Its own file for the same reason as machines.js and history.js — app.js crossed
// the 600-line split signal the moment the close dialog arrived, and this screen is
// the largest thing in it. It uses the helpers app.js already defines (esc, strong,
// soft, badge, emptyRow, api, $, searchTerm, debounce, openForm, closeForm,
// formError, formDone) rather than repeating them: this is one page, not a bundle
// of independent widgets.

import { register, rowsFor, markTable, rowMenu, menuItem } from './tables.js';
import { zoneDateTime } from './time-zone.js';
import { numericCost } from './machine-cost.js';
import * as updateUI from './work-updates.js';

// ------------------------------------------------------------ work orders
const STATUS_KIND = { open: 'amber', in_progress: 'grey', done: 'green' };
const NEXT_STATUS = { open: 'in_progress', in_progress: 'done', done: 'open' };

let workCache = [];
let assignable = [];          // { id, name } — fetched once per session

/**
 * The filters on the Work orders screen, as a query string. The list and the CSV
 * download both call this, so the file cannot disagree with the screen.
 */
export function workQuery() {
  const params = new URLSearchParams();
  const status = $('#wo-status-filter')?.value;
  const q = searchTerm('#wo-search');
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const searchWork = debounce(() => loadWork());

export async function loadWork() {
  workCache = await api(`/work-orders${workQuery()}`);
  // A failed assignee lookup must not be confused with a failed work-order fetch.
  // Both administrators and technicians can read this limited list of names.
  if (!assignable.length) {
    try { assignable = await api('/users/assignable'); } catch { assignable = []; }
  }
  drawWork();
}

/** The table, drawn from `workCache`. Separate from the fetch so a heading can be
 *  clicked without asking the server for the same rows again. */
function drawWork() {
  const rows = rowsFor('work-rows', workCache);
  const notice = $('#work-cost-status');
  if (notice) {
    notice.hidden = !workCache.some((w) => w.cost_basis !== 'parts' || numericCost(w.cost) === null);
    notice.textContent = notice.hidden ? '' : 'Parts-only costs are unavailable. Restart the server after updating.';
  }
  $('#work-rows').innerHTML = rows.map((w) => `<tr>
        ${strong(w.equipment_name)}<td class="cell-strong">${esc(w.title)}${w.photo
          ? ` <a class="link-photo" href="/api/work-orders/${w.id}/photo" target="_blank"
                 rel="noopener">${/\.(mp4|mov|webm)$/i.test(w.photo) ? 'video' : 'photo'}</a>` : ''}<span class="row-sub">${esc(w.code || '')}</span></td>
        <td class="cell-muted">${w.assignee_name ? esc(w.assignee_name) : 'Nobody yet'}</td>
        <td>${badge(w.priority, w.priority === 'high' ? 'red' : w.priority === 'low' ? 'grey' : 'amber')}${
          w.stops_machine ? ` ${badge('last noted out of service', 'red')}` : ''}</td>
        <td>${badge(w.status.replace('_', ' '), STATUS_KIND[w.status])}${w.status === 'in_progress' && w.current_stage ? ` <span class="row-sub">Stage ${Number(w.current_stage)}</span>` : ''}</td>
        <td class="cell-muted cell-date">${w.last_activity_at ? esc(zoneDateTime(w.last_activity_at) || w.last_activity_at) : '—'}</td>
        <td class="cell-num">${w.effective_hours == null ? '—' : Number(w.effective_hours)}</td>
        <td class="cell-num">${w.cost_basis === 'parts' && numericCost(w.cost) !== null ? numericCost(w.cost).toFixed(2) : '—'}</td>
        ${rowMenu(`${w.code || w.title} on ${w.equipment_name}`, [
          menuItem('View updates', `openWorkUpdates(${w.id}, true)`, { icon: 'view' }),
          ...(w.status !== 'done' ? [menuItem('Add update', `openWorkUpdates(${w.id})`, { icon: 'add' })] : []),
          ...(w.current_stage == null ? [menuItem('Edit', `editWork(${w.id})`, { icon: 'edit' })] : []),
          ...(w.status === 'in_progress' ? [menuItem('Close job', `advance(${w.id}, 'done')`, { icon: 'close' })] : []),
          ...(w.status === 'done' ? [menuItem('Reopen', `advance(${w.id}, 'open')`, { icon: 'reopen' })] : []),
        ])}
      </tr>`).join('')
    || emptyRow(9, searchTerm('#wo-search')
      ? `Nothing matches "${searchTerm('#wo-search')}". Clear the search to see every work order.`
      : 'No work orders match. Create one with "New work order", or clear the filter.');
  markTable('work-rows');
}

// Priority is not an alphabetical column: high, low, medium is not an order anybody
// meant. Ascending is most urgent first. Status is the same: the pipeline runs open,
// in progress, done — sorting it alphabetically would put finished work at the top.
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
const WORK_STATUS_RANK = { open: 0, in_progress: 1, done: 2 };

register('work-rows', {
  equipment_name: (w) => w.equipment_name,
  title: (w) => w.title,
  assignee_name: (w) => w.assignee_name,
  priority: (w) => PRIORITY_RANK[w.priority] ?? 3,
  status: (w) => WORK_STATUS_RANK[w.status] ?? 3,
  last_activity_at: (w) => w.last_activity_at,
  labour_hours: (w) => w.effective_hours,
  cost: (w) => w.cost_basis === 'parts' ? numericCost(w.cost) : null,
}, drawWork);

// ---- editing a job -------------------------------------------------------
// It was a row of inputs inside the table, which could change four things and
// nothing else: not the notes, not who reported it, not the photograph, and the
// answer to "does this stop the machine" was a dropdown squeezed into a cell. The
// dialog asks for everything the record holds, in the same order the report form
// does, and one Save writes it all.
let editingJob = null;
// If the people lookup failed, do not send an assignment: missing must not mean
// "unassign".
let canAssign = false;

export function editWork(idToEdit) {
  const job = workCache.find((w) => w.id === idToEdit);
  if (!job || job.current_stage != null) return;
  editingJob = idToEdit;
  canAssign = assignable.length > 0;
  $('#we-id').value = idToEdit;
  $('#work-edit-what').textContent =
    `${job.code ? `${job.code} · ` : ''}${job.equipment_name} — ${job.title}`;
  $('#we-title').value = job.title || '';
  // One owner field, always. With the list of people it is a choice; without it the
  // same control shows the one true answer and cannot be changed — rather than a
  // second, read-only control appearing beside the first.
  $('#we-owner').innerHTML = canAssign
    ? `<option value="">— unassigned —</option>${assignable.map((u) =>
        `<option value="${u.id}"${u.id === job.assigned_to ? ' selected' : ''}>${esc(u.name)}</option>`).join('')}`
    : `<option value="">${esc(job.assignee_name || 'Nobody yet')}</option>`;
  $('#we-owner').disabled = !canAssign;
  $('#we-owner-hint').hidden = canAssign;
  $('#we-priority').value = job.priority || 'medium';
  $('#we-stops').value = job.stops_machine ? '1' : '0';
  $('#we-reporter').value = job.reported_by || '';
  $('#we-notes').value = job.notes || '';
  $('#we-photo').value = '';
  $('#we-photo-clear').checked = false;
  $('#we-photo-now').innerHTML = job.photo
    ? `There is one — <a href="/api/work-orders/${job.id}/photo" target="_blank" rel="noopener">open it</a>.`
    : 'None yet.';
  formError('work-edit', '');
  openForm('work-edit');
}

export async function saveWork() {
  const idToSave = Number($('#we-id').value) || editingJob;
  const title = $('#we-title').value.trim();
  if (!title) return formError('work-edit', 'A job needs a problem — even a few words is enough.');
  const body = {
    title,
    priority: $('#we-priority').value,
    reported_by: $('#we-reporter').value.trim() || null,
    notes: $('#we-notes').value.trim() || null,
  };
  if (canAssign) body.assigned_to = $('#we-owner').value || null;
  const previous = workCache.find((w) => w.id === idToSave);
  const stops = $('#we-stops').value === '1';
  if (previous && stops !== Boolean(previous.stops_machine)) body.stops_machine = stops;
  try {
    await api(`/work-orders/${idToSave}`, { method: 'PATCH', body: JSON.stringify(body) });
    // The photograph last, the same shape as the report form: the record exists, so
    // a failed upload cannot lose the edit that was just saved.
    const file = $('#we-photo').files?.[0];
    if (file) await postPhoto(`/api/work-orders/${idToSave}/photo`, file);
    else if ($('#we-photo-clear').checked) {
      await api(`/work-orders/${idToSave}/photo`, { method: 'DELETE' });
    }
    editingJob = null;
    formDone('work-edit');
    loadWork();
  } catch (e) { formError('work-edit', e.message); }
}

// A fresh form owns its two lookups; an older response must not overwrite it.
let workFormRun = 0;
let machineLoad = 0;
let workMachines = [];

// Reporting starts with the selected machine's current state, not an accidental
// "running" default that could overturn a more recent stoppage.
export function workMachineToggleChanged() {
  $('#w-running-label').textContent = $('#w-running').checked ? 'Running' : 'Out of service';
}
export function syncWorkMachineState() {
  const machine = workMachines.find((m) => String(m.id) === $('#w-equipment').value);
  if (machine) { $('#w-running').checked = machine.status !== 'down'; workMachineToggleChanged(); }
}
Object.assign(window, { syncWorkMachineState, workMachineToggleChanged });

export async function retryWorkMachines() {
  const formRun = workFormRun;
  const load = ++machineLoad;
  const picker = $('#w-equipment');
  picker.disabled = true;
  $('#w-running').disabled = true; $('#w-running-label').textContent = 'Loading…';
  picker.innerHTML = '<option value="">Loading machines…</option>';
  $('#w-create').disabled = true;
  $('#w-machine-retry').hidden = true;
  $('#w-machine-status').textContent = 'Loading machines…';
  try {
    const machines = await api('/equipment?service=active');
    if (formRun !== workFormRun || load !== machineLoad) return;
    if (!machines.length) {
      picker.innerHTML = '<option value="">No machines in service</option>';
      $('#w-running-label').textContent = 'Unavailable';
      $('#w-machine-status').textContent = 'No machines in service. Add or restore a machine, then retry.';
      $('#w-machine-retry').hidden = false;
      return;
    }
    workMachines = machines;
    picker.innerHTML = machines.map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join('');
    syncWorkMachineState();
    picker.disabled = false; $('#w-running').disabled = false;
    $('#w-create').disabled = false;
    $('#w-machine-status').textContent = '';
  } catch (e) {
    if (formRun !== workFormRun || load !== machineLoad) return;
    picker.innerHTML = '<option value="">Could not load machines</option>';
    $('#w-running-label').textContent = 'Unavailable';
    $('#w-machine-status').textContent = `Could not load machines: ${e.message}`;
    $('#w-machine-retry').hidden = false;
  }
}

// Machines and people load independently: a slow assignee lookup must not leave
// the machine picker unusable. Opening the form never depends on visiting Machines.
export async function openNewWork() {
  const formRun = ++workFormRun;
  $('#w-owner').innerHTML = '<option value="">— unassigned —</option>';
  $('#w-owner').disabled = true;
  openForm('work-form');
  const machines = retryWorkMachines();
  const people = (async () => {
    try {
      const users = await api('/users/assignable');
      if (formRun !== workFormRun) return;
      assignable = users;
      $('#w-owner').innerHTML = `<option value="">— unassigned —</option>${users.map((u) =>
        `<option value="${u.id}">${esc(u.name)}</option>`).join('')}`;
      $('#w-owner').disabled = false;
    } catch (e) {
      if (formRun === workFormRun) formError('work-form', `Could not load people: ${e.message}. You can create it unassigned.`);
    }
  })();
  await Promise.all([machines, people]);
}

export async function addWorkOrder() {
  const title = $('#w-title').value.trim();
  if (!title) return formError('work-form', 'Say what is wrong — even a few words is enough.');
  if (!$('#w-equipment').value || $('#w-equipment').disabled) return formError('work-form', 'Choose a machine first.');
  try {
    // The job first, then its photograph: the route is /work-orders/:id/photo and a
    // photograph of a fault that does not exist yet has nowhere to live. This is
    // why the report form can carry a photo before any job id exists.
    const created = await api('/work-orders', { method: 'POST', body: JSON.stringify({
      equipment_id: $('#w-equipment').value, title, priority: $('#w-priority').value,
      assigned_to: $('#w-owner').value || null,
      notes: $('#w-notes')?.value.trim() || null,
      reported_by: $('#w-reporter')?.value.trim() || null,
      // The ticket says whether the machine stops; the server does not guess from
      // the priority, and neither does this form.
      stops_machine: !$('#w-running').checked,
    })});
    const file = $('#w-photo')?.files?.[0];
    if (file) {
      try { await postPhoto(`/api/work-orders/${created.id}/photo`, file); }
      catch (e) { formError('work-form', `${e.message} The work order itself was saved.`); return; }
    }
    ['#w-title', '#w-notes', '#w-reporter'].forEach((sel) => {
      const el = $(sel); if (el) el.value = '';
    });
    if ($('#w-photo')) $('#w-photo').value = '';
    $('#w-owner').value = '';
    formDone('work-form');
    loadWork();
  } catch (e) { formError('work-form', e.message); }
}

export async function advance(id, status) {
  if (status === 'done') return openWorkClose(id);
  if (status === 'in_progress') return openWorkUpdates(id);
  try { await api(`/work-orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); loadWork(); }
  catch (e) { alert(e.message); }
}

// Keep the stage editor separate from the table and close dialog.
export function openWorkUpdates(id, viewOnly = false) {
  return updateUI.openWorkUpdates(workCache.find((w) => w.id === id), viewOnly, async () => {
    await loadWork();
  }, (users) => { assignable = users; });
}
export const retryWorkUpdateLoading = () => updateUI.retryWorkUpdateLoading();
export const startAssigned = () => updateUI.startAssigned();

// ---- closing a job -------------------------------------------------------
let closingWork = null, closeJob = null, closeLoad = 0, closeStateReady = false, closeSaving = false;
function showCloseToggle(running) {
  $('#wc-running').checked = Boolean(running);
  $('#wc-running-label').textContent = running ? 'Running' : 'Out of service';
}
function syncCloseAction() {
  const blocked = closeStateReady && !$('#wc-running').checked && !closeSaving;
  $('#wc-go').disabled = !closeStateReady || !$('#wc-running').checked || closeSaving;
  $('#wc-disabled-tip').hidden = !blocked;
  $('#wc-action').tabIndex = blocked ? 0 : -1;
}
export function closeToggleChanged() { showCloseToggle($('#wc-running').checked); syncCloseAction(); formError('work-close', ''); }
export async function openWorkClose(idToClose) {
  const job = workCache.find((w) => w.id === idToClose);
  if (!job) return;
  closingWork = idToClose; closeJob = job; closeSaving = false;
  $('#work-close-what').textContent = `${job.code ? `${job.code} · ` : ''}${job.equipment_name} — ${job.title}`;
  $('#wc-resolution').value = '';
  formError('work-close', '');
  openForm('work-close');
  return retryCloseState();
}
export async function retryCloseState() {
  if (!closingWork || !closeJob) return;
  const run = ++closeLoad, job = closeJob;
  closeStateReady = false;
  syncCloseAction(); $('#wc-running').disabled = true; $('#wc-retry').hidden = true;
  $('#wc-load').hidden = false; $('#wc-current').textContent = 'Loading machine state…';
  $('#wc-running-label').textContent = 'Loading…';
  try {
    const machines = await api('/equipment');
    if (run !== closeLoad) return;
    const machine = machines.find((m) => Number(m.id) === Number(job.equipment_id));
    if (!machine) throw new Error('Machine not found');
    if (machine.status === 'retired') {
      showCloseToggle(false);
      $('#wc-current').textContent = 'This machine is retired and must be restored before closing.';
      $('#wc-retry').hidden = false;
      return;
    }
    showCloseToggle(machine.status === 'active');
    $('#wc-running').disabled = false;
    $('#wc-current').textContent = ''; $('#wc-load').hidden = true;
    closeStateReady = true; syncCloseAction();
  } catch (e) {
    if (run !== closeLoad) return;
    $('#wc-running-label').textContent = 'Unavailable';
    $('#wc-current').textContent = `Could not load machine state: ${e.message}.`;
    $('#wc-retry').hidden = false;
  }
}
export async function confirmCloseWork() {
  if (!closingWork || !closeStateReady || $('#wc-go').disabled) return;
  if (!$('#wc-running').checked)
    return formError('work-close', 'The machine must be running before this job can be closed.');
  closeSaving = true; $('#wc-running').disabled = true; syncCloseAction();
  try {
    await api(`/work-orders/${closingWork}`, { method: 'PATCH', body: JSON.stringify({
      status: 'done', machine_running: true, resolution: $('#wc-resolution').value.trim() || null,
    })});
    closingWork = null; closeJob = null; closeStateReady = false; closeSaving = false; ++closeLoad; syncCloseAction();
    formDone('work-close');
    await loadWork();
  } catch (e) { closeSaving = false; $('#wc-running').disabled = !closeStateReady; syncCloseAction(); formError('work-close', e.message); }
}
