// The Machines screen: the list every other screen points at, and the form that
// corrects a record.
//
// Its own file for the same reason as shell.js, dashboard.js and history.js. It
// uses the helpers app.js already defines (esc, strong, soft, badge, emptyRow,
// api, $, searchTerm, openForm, closeForm, formError, formDone) rather than
// repeating them: this is one page, not a bundle of independent widgets.

import { register, rowsFor, markTable, rowMenu, menuItem } from './tables.js';
import { numericCost, needsMachineCosts, fillMissingMachineCosts, clearUntrustedMachineCosts } from './machine-cost.js';

// ---- what a row shows ------------------------------------------------------
// status.js sends the latest reported operating state and an explanation. The
// screen presents it; an admin's retirement decision takes precedence.

const STATUS_WORD = { active: 'Running', down: 'Down', retired: 'Retired' };
const STATUS_KIND = { active: 'green', down: 'red', retired: 'grey' };

function thumbnail(machine) {
  if (machine.photo) {
    if (/\.(mp4|mov|webm)$/i.test(machine.photo)) return `<a href="/api/equipment/${machine.id}/photo" target="_blank" rel="noopener" aria-label="Open video of ${esc(machine.name)}">▶ Video</a>`;
    return `<img class="thumb" src="/api/equipment/${machine.id}/photo"
      alt="${esc(machine.name)}" loading="lazy" />`;
  }
  return `<span class="thumb thumb-empty" aria-hidden="true">${esc((machine.name || '?').slice(0, 1))}</span>`;
}

function statusCell(machine) {
  const why = machine.status === 'down' && machine.status_reason
    ? `<span class="status-why">${esc(machine.status_reason)}</span>` : '';
  return `<td>${badge(STATUS_WORD[machine.status] || machine.status, STATUS_KIND[machine.status] || 'grey')}${why}</td>`;
}

/**
 * Everything you can do to one machine, behind three dots. It used to be four
 * buttons on every row, which made a table of twenty machines look like a toolbar;
 * and the ones a technician may not use were drawn for them anyway, in the hope
 * that the server would say no. The markup itself lives in tables.js, shared with
 * every other table's menu.
 */
function actions(machine) {
  const admin = window.me?.role === 'admin';
  return rowMenu(machine.name, [
    admin ? menuItem('Edit machine details', `editEquipment(${machine.id})`, { icon: 'edit' }) : '',
    menuItem('History', `openMachineHistory(${machine.id}, this)`, { icon: 'history' }),
    admin ? menuItem(machine.service_status === 'retired' ? 'Return to service' : 'Retire machine',
      `toggleStatus(${machine.id}, '${machine.service_status}')`, { icon: machine.service_status === 'retired' ? 'restore' : 'retire' }) : '',
    admin ? menuItem('Delete machine', `openEquipmentDelete(${machine.id})`, { danger: true, icon: 'delete' }) : '',
  ]);
}

// The list as last loaded.// The list as last loaded. Edit needs the whole record to fill its form, and
// looking it up here beats inventing a GET /api/equipment/:id that nothing else
// would use.
let equipmentRows = [];
let machineCostUnavailable = false, equipmentLoad = 0;

// The four views of the machine list. One filter with four answers, instead of a
// checkbox that could only say "hide the scrap" or "show me everything everywhere".
// It opens on everything: a machine missing from the list looks deleted, and the
// first question anybody asks a maintenance log is "where is the machine I mean".
// In service is one click away for the everyday case.
const VIEWS = {
  in: { query: 'service=active', empty: 'No machines in service. Add the first one.' },
  down: { query: 'service=active&status=down', empty: 'Nothing is down right now.' },
  retired: { query: 'service=retired', empty: 'No machines have been retired.' },
  all: { query: 'service=all', empty: 'No machines yet. Add the first one and it will appear here.' },
};

// ---- which column, which way ---------------------------------------------
// Nothing is sorted until a heading is clicked. The list already arrives by name
// from the server, and a table that shows an arrow before anybody asked for one is
// claiming a decision nobody made. The state and the arrow live in tables.js now
// that every table sorts; only the meaning of each column is local.

// What "sorted by this column" means, per column. Status sorts by the word the row
// shows — Down, Retired, Running — because that is what the heading says and what a
// person reading the column sees. Anything not in here is not sortable.

/** The filter and the search box, read at the moment they are needed. The table is
 *  drawn from these, and the request is built from the same function, so a redraw
 *  can never disagree with the query that filled it. */
function currentView() {
  return {
    q: searchTerm('#eq-search'),
    view: VIEWS[$('#eq-filter')?.value] ?? VIEWS.all,
  };
}

/** Draw the table from `equipmentRows`, in whatever order has been asked for.
 *  Separate from loading so sorting costs nothing but a redraw. */
function drawEquipment() {
  const { q, view } = currentView();
  const rows = rowsFor('equipment-rows', equipmentRows);
  const notice = $('#machine-cost-status');
  if (notice) {
    const messages = [];
    if (machineCostUnavailable) messages.push('Some service costs are unavailable. Restart the server after updating and try again.');
    notice.textContent = messages.join(' '); notice.hidden = !messages.length;
  }
  $('#equipment-rows').innerHTML = rows.map((e) => `
    <tr${e.service_status === 'retired' ? ' class="row-quiet"' : ''}>
      <td class="cell-thumb">${thumbnail(e)}</td>
      ${strong(e.name, [e.model && `Model: ${e.model}`, e.serial_number && `Serial: ${e.serial_number}`].filter(Boolean).join(' · '))}${soft(e.asset_tag)}${soft(e.manufacturer)}
      ${soft(e.category)}${soft(e.location)}
      ${statusCell(e)}
      <td class="cell-num">${Number(e.total_hours || 0)}</td>
      <td class="cell-num">${numericCost(e.total_service_cost) === null ? '—' : numericCost(e.total_service_cost).toFixed(2)}</td>
      ${actions(e)}
    </tr>`).join('')
    || emptyRow(10, q
      ? `Nothing in this filter matches "${q}". Clear the search to see the rest.`
      : view.empty);
  markTable('equipment-rows');
}

// Registered once, so the six headings and the arrow work without a line per column
// in the click handler. Redrawing from memory is the whole point: `drawEquipment`
// never fetches.
//
// What "sorted by this column" means, per column. Status sorts by the word the row
// shows — Down, Retired, Running — because that is what the heading says and what a
// person reading the column sees. A column that is not in here cannot be sorted, and
// the markup cannot offer one.
register('equipment-rows', {
  name: (machine) => machine.name,
  asset_tag: (machine) => machine.asset_tag,
  manufacturer: (machine) => machine.manufacturer,
  category: (machine) => machine.category,
  location: (machine) => machine.location,
  status: (machine) => STATUS_WORD[machine.status] || machine.status,
  total_hours: (machine) => Number(machine.total_hours || 0),
  total_service_cost: (machine) => numericCost(machine.total_service_cost),
}, drawEquipment);

export async function loadEquipment() {
  const load = ++equipmentLoad;
  const { q, view } = currentView();
  // Form pickers fetch their own unfiltered, in-service machines when opened;
  // this table's search must never constrain those choices.
  const rows = await api(`/equipment?${view.query}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
  let nextRows = rows, unavailable = false;
  if (needsMachineCosts(rows)) {
    try { nextRows = fillMissingMachineCosts(rows, await api('/work-orders')); }
    catch { nextRows = clearUntrustedMachineCosts(rows); unavailable = true; }
  }
  if (load !== equipmentLoad) return;
  equipmentRows = nextRows;
  machineCostUnavailable = unavailable;
  // The chosen column survives a refresh, a filter change and a save: losing the
  // order every time the list reloads would make the arrows decorative.
  drawEquipment();
}

export async function addEquipment() {
  const name = $('#e-name').value.trim();
  if (!name) return formError('equipment-form', 'A machine needs a name.');
  try {
    // The whole record, not the four fields this form used to have. POST has
    // accepted manufacturer and notes since v2.0 while the form offered neither,
    // so the only way to describe a new machine was to create it and edit it again.
    const created = await api('/equipment', { method: 'POST', body: JSON.stringify({
      name,
      asset_tag: $('#e-tag').value.trim() || null,
      manufacturer: $('#e-maker').value.trim() || null,
      model: $('#e-model').value.trim() || null, serial_number: $('#e-serial').value.trim() || null,
      category: $('#e-cat').value.trim() || null,
      location: $('#e-loc').value.trim() || null,
      notes: $('#e-notes').value.trim() || null,
    })});
    // Then the photograph: the route is /equipment/:id/photo, so the machine has to
    // exist first. If the photo fails the machine is already created, and the
    // message says so rather than pretending nothing happened.
    const file = $('#e-photo').files?.[0];
    if (file) {
      try { await uploadPhoto(created.id, file); }
      catch (e) { formError('equipment-form', `${e.message} The machine itself was saved.`); loadEquipment(); return; }
    }
    ['#e-name', '#e-tag', '#e-maker', '#e-model', '#e-serial', '#e-cat', '#e-loc', '#e-notes'].forEach((s) => {
      const el = $(s); if (el) el.value = '';
    });
    if ($('#e-photo')) $('#e-photo').value = '';
    formDone('equipment-form');
    loadEquipment();
  } catch (e) { formError('equipment-form', e.message); }
}

/** Open the edit form filled with what the row already says. Nothing is fetched:
 *  the machine is in the list that drew the button. */
export function editEquipment(idToEdit) {
  const machine = equipmentRows.find((e) => e.id === idToEdit);
  if (!machine) return;
  $('#ee-id').value = String(machine.id);
  $('#ee-name').value = machine.name || '';
  $('#ee-tag').value = machine.asset_tag || '';
  $('#ee-cat').value = machine.category || '';
  $('#ee-loc').value = machine.location || '';
  $('#ee-maker').value = machine.manufacturer || '';
  $('#ee-model').value = machine.model || ''; $('#ee-serial').value = machine.serial_number || '';
  $('#ee-notes').value = machine.notes || '';
  // A file input cannot be filled from script, so an empty one means "keep what
  // is there". The preview is what tells the admin a photograph already exists.
  $('#ee-photo').value = '';
  $('#ee-photo-clear').checked = false;
  $('#ee-photo-preview').innerHTML = machine.photo
    ? (/\.(mp4|mov|webm)$/i.test(machine.photo) ? `<video src="/api/equipment/${machine.id}/photo" controls playsinline></video>` : `<img src="/api/equipment/${machine.id}/photo?t=${Date.now()}" alt="${esc(machine.name)}" />`)
    : '<span>No photograph yet</span>';
  $('#equipment-edit-title').textContent = `Edit machine details · ${machine.name}`;
  $('#ee-photo-undo').hidden = true;
  if (machine.photo) $('#ee-photo-preview').insertAdjacentHTML('beforeend', '<button type="button" class="photo-remove" onclick="removeEquipmentPhoto()" aria-label="Remove photograph" title="Remove photograph">−</button>');
  openForm('equipment-edit');
}

let photoBeforeRemoval = '';
export function removeEquipmentPhoto() {
  photoBeforeRemoval = $('#ee-photo-preview').innerHTML;
  $('#ee-photo-clear').checked = true;
  $('#ee-photo-preview').innerHTML = '<span>Photograph will be removed</span>';
  $('#ee-photo-undo').hidden = false;
}
export function undoEquipmentPhotoRemoval() {
  $('#ee-photo-clear').checked = false;
  $('#ee-photo-preview').innerHTML = photoBeforeRemoval;
  $('#ee-photo-undo').hidden = true;
}
Object.assign(window, { removeEquipmentPhoto, undoEquipmentPhotoRemoval });

/** Send the bytes as they are. The server sniffs the type and picks the name;
 *  the header below is a courtesy, not a claim it will believe. */
// The shared streaming uploader lives in app.js: a fault photograph on a
// work order goes through exactly the same door, and two copies of that check would
// drift the day one cap changes.
async function uploadPhoto(machineId, file) {
  return postPhoto(`/api/equipment/${machineId}/photo`, file);
}

/** Save the record, then the photograph if one was chosen. Two calls because the
 *  photograph is bytes and the rest is JSON, and because a failed upload must not
 *  lose a corrected name. */
export async function saveEquipment() {
  const machineId = Number($('#ee-id').value);
  const name = $('#ee-name').value.trim();
  if (!name) return formError('equipment-edit', 'A machine needs a name.');
  const body = {
    name,
    asset_tag: $('#ee-tag').value.trim() || null,
    category: $('#ee-cat').value.trim() || null,
    location: $('#ee-loc').value.trim() || null,
    manufacturer: $('#ee-maker').value.trim() || null,
    model: $('#ee-model').value.trim() || null, serial_number: $('#ee-serial').value.trim() || null,
    notes: $('#ee-notes').value.trim() || null,
    // No status: it is not a field. The server refuses one anyway, with a message
    // that says to close the job instead.
  };
  try {
    await api(`/equipment/${machineId}`, { method: 'PUT', body: JSON.stringify(body) });
    const file = $('#ee-photo').files?.[0];
    if (file) await uploadPhoto(machineId, file);
    else if ($('#ee-photo-clear').checked) {
      await api(`/equipment/${machineId}/photo`, { method: 'DELETE' });
    }
    formDone('equipment-edit');
    loadEquipment();
  } catch (e) { formError('equipment-edit', e.message); }
}

/** Retire or restore. `service_status` is what is stored; the badge is derived. */
export async function toggleStatus(id, serviceStatus) {
  await api(`/equipment/${id}`, { method: 'PUT', body: JSON.stringify({
    status: serviceStatus === 'retired' ? 'active' : 'retired',
  })});
  loadEquipment();
}

/** What a delete would destroy, counted before it happens: "3 work orders and 1
 *  maintenance task" is a different decision from "this machine". */
let pendingDelete = null;

export async function openEquipmentDelete(id) {
  const machine = equipmentRows.find((e) => e.id === id);
  if (!machine) return;
  // The server cascades work orders, their parts and maintenance schedules; this is
  // the only chance to say so before it happens.
  const [jobs, schedules] = await Promise.all([
    api(`/work-orders?equipment_id=${id}`),
    api('/pm'),
  ]);
  const mine = schedules.filter((s) => Number(s.equipment_id) === Number(id));
  const phrase = `delete machine ${machine.name}`;
  pendingDelete = { id, phrase: phrase.toLowerCase() };

  $('#equipment-delete-title').textContent = `Delete ${machine.name}?`;
  $('#equipment-delete-phrase').textContent = phrase;
  $('#equipment-delete-confirm').value = '';
  $('#equipment-delete-go').disabled = true;
  formError('equipment-delete', '');

  const counted = [];
  if (jobs.length) counted.push(`${jobs.length} work order${jobs.length === 1 ? '' : 's'}`);
  if (mine.length) counted.push(`${mine.length} maintenance task${mine.length === 1 ? '' : 's'}`);
  $('#equipment-delete-consequences').textContent =
    `Deleting this machine deletes ${counted.length ? counted.join(' and ') : 'everything recorded against it'},`
    + ' the whole of its history, and its photograph. There is no undo.';
  openForm('equipment-delete');
}

/** The button stays disabled until the sentence matches. Two guards, not one:
 *  a disabled button for the honest mistake, and this check for the rest. */
export function checkDeletePhrase() {
  if (!pendingDelete) return;
  const typed = $('#equipment-delete-confirm').value.trim().toLowerCase().replace(/\s+/g, ' ');
  $('#equipment-delete-go').disabled = typed !== pendingDelete.phrase;
}

export async function confirmEquipmentDelete() {
  if (!pendingDelete) return;
  const typed = $('#equipment-delete-confirm').value.trim().toLowerCase().replace(/\s+/g, ' ');
  if (typed !== pendingDelete.phrase) {
    return formError('equipment-delete', 'Type the sentence exactly as it is written above.');
  }
  try {
    await removeEquipment(pendingDelete.id);
    pendingDelete = null;
    formDone('equipment-delete');
    loadEquipment();
  } catch (e) { formError('equipment-delete', e.message); }
}

/** The call itself. No `confirm()` any more: the dialog is the confirmation, and
 *  it knows how much is about to go. */
export async function removeEquipment(id) {
  await api(`/equipment/${id}`, { method: 'DELETE' });
}
