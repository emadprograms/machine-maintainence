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

// ------------------------------------------------------------ work orders
const STATUS_KIND = { open: 'amber', in_progress: 'grey', done: 'green' };
const NEXT_STATUS = { open: 'in_progress', in_progress: 'done', done: 'open' };

let workCache = [];
let assignable = [];          // { id, name } — fetched once per session
let partChoices = [];         // every part, for the picker in the close dialog

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
  $('#work-rows').innerHTML = rows.map((w) => `<tr>
        ${strong(w.equipment_name)}<td class="cell-strong">${esc(w.title)}${w.photo
          ? ` <a class="link-photo" href="/api/work-orders/${w.id}/photo" target="_blank"
                 rel="noopener">photo</a>` : ''}<span class="row-sub">${esc(w.code || '')}</span></td>
        <td class="cell-muted">${w.assignee_name ? esc(w.assignee_name) : 'Nobody yet'}</td>
        <td>${badge(w.priority, w.priority === 'high' ? 'red' : w.priority === 'low' ? 'grey' : 'amber')}${
          w.stops_machine ? ` ${badge('stops the machine', 'red')}` : ''}</td>
        <td>${badge(w.status.replace('_', ' '), STATUS_KIND[w.status])}</td>
        <td class="cell-num">${w.labour_hours == null ? '—' : Number(w.labour_hours)}</td>
        <td class="cell-num">${Number(w.cost || 0).toFixed(2)}</td>
        ${rowMenu(`${w.code || w.title} on ${w.equipment_name}`, [
          menuItem(w.status === 'done' ? 'Reopen'
            : NEXT_STATUS[w.status] === 'done' ? 'Close job'
              : `Move to ${NEXT_STATUS[w.status].replace('_', ' ')}`,
          `advance(${w.id}, '${NEXT_STATUS[w.status]}')`),
          menuItem('Edit', `editWork(${w.id})`),
        ])}
      </tr>`).join('')
    || emptyRow(8, searchTerm('#wo-search')
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
  labour_hours: (w) => w.labour_hours,
  cost: (w) => w.cost,
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
  if (!job) return;
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
  $('#we-hours').value = job.labour_hours ?? '';
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
    labour_hours: $('#we-hours').value,
    reported_by: $('#we-reporter').value.trim() || null,
    notes: $('#we-notes').value.trim() || null,
    stops_machine: $('#we-stops').value === '1',
  };
  if (canAssign) body.assigned_to = $('#we-owner').value || null;
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

export async function retryWorkMachines() {
  const formRun = workFormRun;
  const load = ++machineLoad;
  const picker = $('#w-equipment');
  picker.disabled = true;
  picker.innerHTML = '<option value="">Loading machines…</option>';
  $('#w-create').disabled = true;
  $('#w-machine-retry').hidden = true;
  $('#w-machine-status').textContent = 'Loading machines…';
  try {
    const machines = await api('/equipment?service=active');
    if (formRun !== workFormRun || load !== machineLoad) return;
    if (!machines.length) {
      picker.innerHTML = '<option value="">No machines in service</option>';
      $('#w-machine-status').textContent = 'No machines in service. Add or restore a machine, then retry.';
      $('#w-machine-retry').hidden = false;
      return;
    }
    picker.innerHTML = machines.map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join('');
    picker.disabled = false;
    $('#w-create').disabled = false;
    $('#w-machine-status').textContent = '';
  } catch (e) {
    if (formRun !== workFormRun || load !== machineLoad) return;
    picker.innerHTML = '<option value="">Could not load machines</option>';
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
      labour_hours: $('#w-hours')?.value || null,
      notes: $('#w-notes')?.value.trim() || null,
      reported_by: $('#w-reporter')?.value.trim() || null,
      // The ticket says whether the machine stops; the server does not guess from
      // the priority, and neither does this form.
      stops_machine: $('#w-stops')?.value === '1',
    })});
    const file = $('#w-photo')?.files?.[0];
    if (file) {
      try { await postPhoto(`/api/work-orders/${created.id}/photo`, file); }
      catch (e) { formError('work-form', `${e.message} The work order itself was saved.`); return; }
    }
    ['#w-title', '#w-notes', '#w-reporter', '#w-hours'].forEach((sel) => {
      const el = $(sel); if (el) el.value = '';
    });
    if ($('#w-photo')) $('#w-photo').value = '';
    $('#w-owner').value = '';
    formDone('work-form');
    loadWork();
  } catch (e) { formError('work-form', e.message); }
}

export async function advance(id, status) {
  // Closing is not another step forward, it is a record: it asks what was done
  // before it will write "done".
  if (status === 'done') return openWorkClose(id);
  // So is starting one: a job in progress belongs to somebody. The move asks who,
  // rather than being refused or — worse — quietly starting an unowned job. A job
  // that already has a name on it moves with one click, as before.
  const job = workCache.find((w) => w.id === id);
  if (status === 'in_progress' && job && !job.assigned_to) return openWorkAssign(id);
  try { await api(`/work-orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); loadWork(); }
  catch (e) {
    // Another user may have removed the assignee since this list was loaded.
    if (status === 'in_progress' && /assign the job to someone/i.test(e.message)) {
      try { await loadWork(); return openWorkAssign(id); } catch (refreshError) { alert(refreshError.message); return; }
    }
    alert(e.message);
  }
}

// ---- who is doing it ------------------------------------------------------
let assigningWork = null;

// Ask both administrators and technicians; the limited names endpoint is available
// to both. If it fails, leave the dialog open and explain rather than guessing.
export async function openWorkAssign(idToStart) {
  const job = workCache.find((w) => w.id === idToStart);
  if (!job) return;
  assigningWork = idToStart;
  $('#work-assign-what').textContent = `${job.code ? `${job.code} · ` : ''}${job.equipment_name} — ${job.title}`;
  $('#wa-owner').innerHTML = '<option value="">Loading people…</option>';
  $('#wa-owner').disabled = true;
  $('#wa-go').disabled = true;
  openForm('work-assign');
  try {
    const people = await api('/users/assignable');
    // A second dialog may have been opened while this request was in flight.
    if (assigningWork !== idToStart) return;
    assignable = people;
    $('#wa-owner').innerHTML = `<option value="">— choose somebody —</option>${people.map((u) =>
      `<option value="${u.id}">${esc(u.name)}</option>`).join('')}`;
    $('#wa-owner').disabled = !people.length;
    $('#wa-go').disabled = !people.length;
    if (!people.length) formError('work-assign', 'No accounts are available to assign.');
  } catch (e) { formError('work-assign', `Could not load people: ${e.message}`); }
}

/** Assign and start atomically, so a failed request cannot leave a partial change. */
export async function startAssigned() {
  if (!assigningWork) return;
  const owner = $('#wa-owner').value;
  if (!owner) return formError('work-assign', 'Choose who is doing it, then start the job.');
  try {
    await api(`/work-orders/${assigningWork}`, { method: 'PATCH', body: JSON.stringify({
      assigned_to: Number(owner),
      status: 'in_progress',
    })});
    assigningWork = null;
    formDone('work-assign');
    loadWork();
  } catch (e) { formError('work-assign', e.message); }
}

// ---- closing a job -------------------------------------------------------
let closingWork = null;

/** Fill the close dialog from the row that was clicked, and from the parts list. */
export async function openWorkClose(idToClose) {
  const job = workCache.find((w) => w.id === idToClose);
  if (!job) return;
  closingWork = idToClose;
  $('#wc-id').value = idToClose;
  $('#work-close-what').textContent = `${job.code ? `${job.code} · ` : ''}${job.equipment_name} — ${job.title}`;
  $('#wc-resolution').value = job.resolution || '';
  $('#wc-hours').value = job.labour_hours ?? '';
  $('#wc-verified').value = job.verified_by || '';
  formError('work-close', '');
  // The parts screen may never have been opened in this session; the select must
  // still offer something to add.
  if (!partChoices.length) { try { partChoices = await api('/parts'); } catch { partChoices = []; } }
  fillPartChoices();
  await showUsedParts(idToClose);
  openForm('work-close');
}

export function fillPartChoices() {
  $('#wc-part').innerHTML = partChoices.map((p) =>
    `<option value="${p.id}">${esc(p.name)} — ${p.qty} in stock</option>`).join('')
    || '<option value="">No parts on the shelf</option>';
}

export async function showUsedParts(workId) {
  const used = await api(`/work-orders/${workId}/parts`).catch(() => []);
  $('#wc-parts').innerHTML = used.map((p) => `<li>${esc(p.name)} × ${p.qty}</li>`).join('');
}

/** Add one part to the job being closed. Stock moves here, not on save: a part
 *  taken off the shelf is off the shelf whether or not the job is closed next. */
export async function usePart() {
  const partId = $('#wc-part').value;
  if (!partId) return formError('work-close', 'There is no part to add.');
  const qty = Number($('#wc-qty').value) || 1;
  try {
    await api(`/work-orders/${closingWork}/parts`, { method: 'POST',
      body: JSON.stringify({ part_id: partId, qty }) });
    partChoices = await api('/parts');
    fillPartChoices();
    $('#wc-qty').value = 1;
    await showUsedParts(closingWork);
  } catch (e) { formError('work-close', e.message); }
}

export async function confirmCloseWork() {
  const resolution = $('#wc-resolution').value.trim();
  if (!resolution) {
    return formError('work-close', 'Say what was done — that sentence is the whole history of the job.');
  }
  try {
    await api(`/work-orders/${closingWork}`, { method: 'PATCH', body: JSON.stringify({
      status: 'done',
      resolution,
      labour_hours: $('#wc-hours').value,
      verified_by: $('#wc-verified').value.trim() || null,
    })});
    closingWork = null;
    formDone('work-close');
    loadWork();
  } catch (e) { formError('work-close', e.message); }
}
