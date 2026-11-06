// The work-orders screen: what needs fixing, the two forms that put a fault in,
// and the dialog that closes a job.
//
// Its own file for the same reason as machines.js and history.js — app.js crossed
// the 600-line split signal the moment the close dialog arrived, and this screen is
// the largest thing in it. It uses the helpers app.js already defines (esc, strong,
// soft, badge, emptyRow, api, $, searchTerm, debounce, openForm, closeForm,
// formError, formDone) rather than repeating them: this is one page, not a bundle
// of independent widgets.

// ------------------------------------------------------------ work orders
const STATUS_KIND = { open: 'amber', in_progress: 'grey', done: 'green' };
const NEXT_STATUS = { open: 'in_progress', in_progress: 'done', done: 'open' };

let workCache = [];
let editingWork = null;
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
  // A technician may not read the assignable list. That is expected, and it must
  // not be confused with "the work-order fetch failed" — this catch is scoped to
  // the assignee lookup alone. The assertion that guards the empty state reads
  // this function's text, so the reason is written where the next reader looks.
  if (!assignable.length) {
    try { assignable = await api('/users/assignable'); } catch { assignable = []; }
  }
  $('#work-rows').innerHTML = workCache.map((w) => (w.id === editingWork
    ? `<tr>
        <td>${esc(w.equipment_name)}</td>
        <td><input id="we-title-${w.id}" value="${esc(w.title)}" /></td>
        <td>${ownerSelect(w.id, w.assigned_to)}</td>
        <td>${prioritySelect(w.id, w.priority)}</td>
        <td>${badge(w.status.replace('_', ' '), STATUS_KIND[w.status])}</td>
        <td><input id="we-hours-${w.id}" type="number" min="0" step="0.25"
                   value="${w.labour_hours ?? ''}" placeholder="hours" /></td>
        <td class="cell-num">${Number(w.cost || 0).toFixed(2)}</td>
        <td class="actions">
          <button class="small" onclick="saveWork(${w.id})">Save</button>
          <button class="small" onclick="cancelWork()">Cancel</button>
        </td>
      </tr>`
    : `<tr>
        ${strong(w.equipment_name)}<td>${esc(w.title)}${w.photo
          ? ` <a class="link-photo" href="/api/work-orders/${w.id}/photo" target="_blank"
                 rel="noopener">photo</a>` : ''}</td>
        <td class="cell-muted">${w.assignee_name ? esc(w.assignee_name) : 'Nobody yet'}</td>
        <td>${badge(w.priority, w.priority === 'high' ? 'red' : w.priority === 'low' ? 'grey' : 'amber')}</td>
        <td>${badge(w.status.replace('_', ' '), STATUS_KIND[w.status])}</td>
        <td class="cell-num">${w.labour_hours == null ? '—' : Number(w.labour_hours)}</td>
        <td class="cell-num">${Number(w.cost || 0).toFixed(2)}</td>
        <td>
          <button class="ghost small" onclick="advance(${w.id}, '${NEXT_STATUS[w.status]}')">
            ${w.status === 'done' ? 'Reopen' : 'Move to ' + NEXT_STATUS[w.status].replace('_', ' ')}
          </button>
          <button class="ghost small" onclick="editWork(${w.id})">Edit</button>
        </td>
      </tr>`)).join('')
    || emptyRow(8, searchTerm('#wo-search')
      ? `Nothing matches "${searchTerm('#wo-search')}". Clear the search to see every work order.`
      : 'No work orders match. Create one with "New work order", or clear the filter.');
}

function ownerSelect(workId, current) {
  return `<select id="we-owner-${workId}">
    <option value="">— unassigned —</option>
    ${assignable.map((u) => `<option value="${u.id}"${u.id === current ? ' selected' : ''}>${esc(u.name)}</option>`).join('')}
  </select>`;
}

function prioritySelect(workId, current) {
  return `<select id="we-priority-${workId}">
    ${['low', 'medium', 'high'].map((p) => `<option value="${p}"${p === current ? ' selected' : ''}>${p}</option>`).join('')}
  </select>`;
}

export function editWork(idToEdit) {
  editingWork = idToEdit;
  loadWork();
}

export function cancelWork() {
  editingWork = null;
  loadWork();
}

export async function saveWork(idToSave) {
  try {
    await api(`/work-orders/${idToSave}`, { method: 'PATCH', body: JSON.stringify({
      title: $(`#we-title-${idToSave}`).value,
      assigned_to: $(`#we-owner-${idToSave}`).value || null,
      priority: $(`#we-priority-${idToSave}`).value,
      labour_hours: $(`#we-hours-${idToSave}`).value,
    })});
    editingWork = null;
    loadWork();
  } catch (e) { alert(e.message); }
}

export async function addWorkOrder() {
  const title = $('#w-title').value.trim();
  if (!title) return formError('work-form', 'Say what is wrong — even a few words is enough.');
  try {
    // The job first, then its photograph: the route is /work-orders/:id/photo and a
    // photograph of a fault that does not exist yet has nowhere to live. This is
    // why the report form can carry a photo before any job id exists.
    const created = await api('/work-orders', { method: 'POST', body: JSON.stringify({
      equipment_id: $('#w-equipment').value, title, priority: $('#w-priority').value,
      labour_hours: $('#w-hours')?.value || null,
      notes: $('#w-notes')?.value.trim() || null,
      reported_by: $('#w-reporter')?.value.trim() || null,
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
    formDone('work-form');
    loadWork();
  } catch (e) { formError('work-form', e.message); }
}

export async function advance(id, status) {
  // Closing is not another step forward, it is a record: it asks what was done
  // before it will write "done". Everything else moves with one click.
  if (status === 'done') return openWorkClose(id);
  try { await api(`/work-orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); loadWork(); }
  catch (e) { alert(e.message); }
}

// ---- closing a job -------------------------------------------------------
let closingWork = null;

/** Fill the close dialog from the row that was clicked, and from the parts list. */
export async function openWorkClose(idToClose) {
  const job = workCache.find((w) => w.id === idToClose);
  if (!job) return;
  closingWork = idToClose;
  $('#wc-id').value = idToClose;
  $('#work-close-what').textContent = `${job.equipment_name} — ${job.title}`;
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
