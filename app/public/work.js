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
        <td>${badge(w.status.replace('_', ' '), STATUS_KIND[w.status])}${w.status === 'in_progress' && w.current_stage ? ` <span class="row-sub">Stage ${Number(w.current_stage)}</span>` : ''}</td>
        <td class="cell-num">${w.labour_hours == null ? '—' : Number(w.labour_hours)}</td>
        <td class="cell-num">${Number(w.cost || 0).toFixed(2)}</td>
        ${rowMenu(`${w.code || w.title} on ${w.equipment_name}`, [
          menuItem(w.status === 'done' ? 'Reopen'
            : NEXT_STATUS[w.status] === 'done' ? 'Close job'
              : `Move to ${NEXT_STATUS[w.status].replace('_', ' ')}`,
          `advance(${w.id}, '${NEXT_STATUS[w.status]}')`),
          ...(w.status === 'in_progress' ? [menuItem('Add update', `openWorkUpdates(${w.id})`)] : []),
          menuItem('View updates', `openWorkUpdates(${w.id}, true)`),
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

let updatingWork = null;
let updateJob = null;
let updateRun = 0;
let updateLoad = 0;
let updateEditing = false;

// A single dialog is both the full timeline and the next-stage editor. It remains
// available in read-only mode after closing; no update overwrites an earlier one.
export async function openWorkUpdates(idToUpdate, viewOnly = false) {
  const job = workCache.find((w) => w.id === idToUpdate);
  if (!job) return;
  updatingWork = idToUpdate;
  updateJob = job;
  ++updateRun;
  const editing = !viewOnly && job.status !== 'done';
  updateEditing = editing;
  $('#work-assign-title').textContent = editing ? (job.status === 'open' ? 'Start the job' : 'Add an update') : 'Work order updates';
  $('#work-assign-what').textContent = `${job.code ? `${job.code} · ` : ''}${job.equipment_name} — ${job.title}`;
  $('#wa-entry').hidden = !editing;
  $('#wa-go').hidden = !editing;
  $('#wa-message').value = '';
  $('#wa-hours').value = '';
  $('#wa-photos').value = '';
  $('#wa-owner-field').hidden = !(editing && (job.status === 'open' || !job.assigned_to));
  $('#wa-owner').innerHTML = '<option value="">Loading people…</option>';
  $('#wa-owner').disabled = true;
  openForm('work-assign');
  return retryWorkUpdateLoading();
}

// The people and history requests are independent. A slow or failed history
// request must not leave an otherwise available assignee picker blank.
export async function retryWorkUpdateLoading() {
  if (!updatingWork || !updateJob) return;
  const run = updateRun, load = ++updateLoad, workId = updatingWork, job = updateJob;
  const editing = updateEditing;
  const choose = editing && (job.status === 'open' || !job.assigned_to);
  const selected = $('#wa-owner').value || (job.assigned_to ? String(job.assigned_to) : '');
  let historyReady = false, peopleReady = !choose;
  const failures = [];
  const current = () => run === updateRun && load === updateLoad;
  const refresh = () => {
    if (!current()) return;
    const pending = !historyReady || !peopleReady;
    $('#wa-load-status').textContent = failures.length ? failures.join(' ') : (pending ? 'Loading updates and people…' : '');
    $('#wa-retry').hidden = failures.length === 0;
    $('#wa-go').disabled = !editing || pending || failures.length > 0;
  };
  $('#wa-go').disabled = true;
  $('#wa-retry').hidden = true;
  formError('work-assign', '');
  // The list already identifies a freshly opened ticket with no stages. Show
  // that known empty state while checking the latest history in the background.
  if (job.status === 'open' && job.current_stage === null)
    $('#wa-history').innerHTML = '<p class="hint">No updates yet.</p>';
  else $('#wa-history').textContent = 'Loading updates…';
  if (choose) {
    $('#wa-owner').innerHTML = '<option value="">Loading people…</option>';
    $('#wa-owner').disabled = true;
  }
  refresh();
  const history = api(`/work-orders/${workId}/updates`).then((updates) => {
    if (!current()) return;
    if (!Array.isArray(updates)) throw new Error('The server returned an invalid updates list. Restart the app after updating, then retry');
    $('#wa-history').innerHTML = updates.map((u) => `<div class="update-entry"><strong>Stage ${Number(u.stage)}</strong>
      <small> · ${esc(u.created_at)} UTC · ${esc(u.author)} · ${Number(u.hours)} hours</small>
      <p>${esc(u.message)}</p>${u.photos.map((photo, i) => `<a class="link-photo" target="_blank" rel="noopener"
        href="/api/work-orders/${workId}/updates/${u.id}/photos/${photo}">Photo ${i + 1}</a>`).join(' ')}</div>`).join('')
      || '<p class="hint">No updates yet.</p>';
    $('#wa-stage-title').textContent = `Stage ${updates.length ? Number(updates.at(-1).stage) + 1 : 1}`;
    historyReady = true;
    refresh();
  }).catch((e) => {
    if (!current()) return;
    $('#wa-history').textContent = '';
    failures.push(e.status === 404 && e.nonJson
      ? 'Updates are unavailable on this server. Restart the app after updating, then retry.'
      : `Could not load updates: ${e.message}.`);
    refresh();
  });
  const people = choose ? api('/users/assignable').then((users) => {
    if (!current()) return;
    assignable = users;
    $('#wa-owner').innerHTML = `<option value="">— choose somebody —</option>${users.map((u) =>
      `<option value="${u.id}">${esc(u.name)}</option>`).join('')}`;
    if (selected && users.some((u) => String(u.id) === selected)) $('#wa-owner').value = selected;
    $('#wa-owner').disabled = users.length === 0;
    if (!users.length) failures.push('No accounts are available to assign. Ask an admin to add one.');
    peopleReady = users.length > 0;
    refresh();
  }).catch((e) => {
    if (!current()) return;
    $('#wa-owner').innerHTML = '<option value="">Could not load people</option>';
    failures.push(`Could not load people: ${e.message}.`);
    refresh();
  }) : Promise.resolve();
  await Promise.all([history, people]);
}

function photoData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read a photo'));
    reader.readAsDataURL(file);
  });
}

export async function startAssigned() {
  if (!updatingWork || !updateJob || $('#wa-go').disabled) return;
  const run = updateRun, workId = updatingWork, job = updateJob;
  const message = $('#wa-message').value.trim();
  const hours = $('#wa-hours').value;
  const owner = $('#wa-owner').value;
  const photos = Array.from($('#wa-photos').files || []);
  if (!message) return formError('work-assign', 'Write an update for this stage.');
  if (hours === '' || !Number.isFinite(Number(hours)) || Number(hours) < 0)
    return formError('work-assign', 'Enter the time spent in hours.');
  const choose = job.status === 'open' || !job.assigned_to;
  if (choose && !owner) return formError('work-assign', 'Choose who is doing this job.');
  if (photos.length > 5 || photos.some((p) => p.size > 2 * 1024 * 1024))
    return formError('work-assign', 'Choose up to five photos, each under 2 MB.');
  $('#wa-go').disabled = true;
  try {
    const body = { message, hours, photos: await Promise.all(photos.map(photoData)) };
    if (choose) body.assigned_to = Number(owner);
    await api(`/work-orders/${workId}/updates`, { method: 'POST', body: JSON.stringify(body) });
    if (updateRun === run) {
      updatingWork = null;
      updateJob = null;
      formDone('work-assign');
    }
    await loadWork();
  } catch (e) {
    if (updateRun === run) { formError('work-assign', e.message); $('#wa-go').disabled = false; }
  }
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
  // Prefill the final total from the stages, without adding it to the recorded
  // total a second time. A previously closed job keeps its existing total.
  let updates = [];
  try { updates = await api(`/work-orders/${idToClose}/updates`); } catch { /* final total can still be entered manually */ }
  const stageHours = Math.round(updates.reduce((sum, u) => sum + Number(u.hours), 0) * 1e6) / 1e6;
  $('#wc-hours').value = job.labour_hours ?? (updates.length ? stageHours : '');
  $('#wc-hours-hint').textContent = updates.length
    ? `Stages total ${stageHours} hours. Review the final total before closing.` : '';
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
