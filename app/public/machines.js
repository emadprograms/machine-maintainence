// The Machines screen: the list every other screen points at, and the form that
// corrects a record.
//
// Its own file for the same reason as shell.js, dashboard.js and history.js. It
// uses the helpers app.js already defines (esc, strong, soft, badge, emptyRow,
// api, $, searchTerm, openForm, closeForm, formError, formDone) rather than
// repeating them: this is one page, not a bundle of independent widgets.

// ---- what a row shows ------------------------------------------------------
// Status is not a field any more: status.js derives it from the work orders and
// sends `status` plus `status_reason`. The screen explains rather than decides,
// so a red badge always comes with the job that caused it.

const STATUS_WORD = { active: 'Running', down: 'Down', retired: 'Retired' };
const STATUS_KIND = { active: 'green', down: 'red', retired: 'grey' };

function thumbnail(machine) {
  if (machine.photo) {
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
 * that the server would say no.
 */
function actions(machine) {
  const admin = window.me?.role === 'admin';
  const items = [
    admin ? `<button type="button" onclick="editEquipment(${machine.id})">Edit machine</button>` : '',
    `<button type="button" onclick="openMachineHistory(${machine.id}, this)">History</button>`,
    admin ? `<button type="button" onclick="toggleStatus(${machine.id}, '${machine.service_status}')">${
      machine.service_status === 'retired' ? 'Return to service' : 'Retire machine'}</button>` : '',
    admin ? `<button type="button" class="danger" onclick="openEquipmentDelete(${machine.id})">Delete machine</button>` : '',
  ].filter(Boolean).join('');
  return `<td class="cell-actions"><details class="row-menu">
      <summary aria-label="Actions for ${esc(machine.name)}">&#8943;</summary>
      <div class="menu">${items}</div>
    </details></td>`;
}

// One listener for the whole page: a menu closes when you pick something from it,
// and when you click anywhere else. A `<details>` open in a table row is otherwise
// the kind of thing that stays open behind the next dialog.
const closeMenus = () => document.querySelectorAll('details.row-menu[open]')
  .forEach((d) => d.removeAttribute('open'));

document.addEventListener('click', (event) => {
  const item = event.target.closest('.row-menu .menu button');
  if (item) closeMenus();
  else if (!event.target.closest('.row-menu')) closeMenus();
});

// The menu is `position: fixed`, so its place is worked out when it opens: below
// the three dots, right-aligned to them, and lifted left on the last column so it
// cannot run off the screen.
document.addEventListener('toggle', (event) => {
  const details = event.target;
  if (!details.classList?.contains('row-menu') || !details.open) return;
  const dot = details.querySelector('summary').getBoundingClientRect();
  const list = details.querySelector('.menu');
  list.style.top = `${dot.bottom + 6}px`;
  list.style.left = `${Math.max(8, dot.right - 196)}px`;
}, true);

// A fixed menu would stay behind while the page moves under it.
window.addEventListener('scroll', closeMenus, true);
window.addEventListener('resize', closeMenus);

// The list as last loaded.// The list as last loaded. Edit needs the whole record to fill its form, and
// looking it up here beats inventing a GET /api/equipment/:id that nothing else
// would use.
let equipmentRows = [];

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

export async function loadEquipment() {
  const q = searchTerm('#eq-search');
  const view = VIEWS[$('#eq-filter')?.value] ?? VIEWS.all;
  // Two requests, deliberately. The table is the view this screen is filtered to;
  // the dropdowns are "every machine in service", because a new job or a new
  // maintenance schedule must not be startable on a machine that has left. They
  // used to share one array, so typing in the search box narrowed the dropdowns
  // too — searching "pump" left only pumps to report a fault against.
  const [rows, inService] = await Promise.all([
    api(`/equipment?${view.query}${q ? `&q=${encodeURIComponent(q)}` : ''}`),
    api('/equipment?service=active'),
  ]);
  equipmentRows = rows;
  $('#equipment-rows').innerHTML = rows.map((e) => `
    <tr${e.service_status === 'retired' ? ' class="row-quiet"' : ''}>
      <td class="cell-thumb">${thumbnail(e)}</td>
      ${strong(e.name)}${soft(e.asset_tag)}${soft(e.manufacturer)}
      ${soft(e.category)}${soft(e.location)}
      ${statusCell(e)}
      ${actions(e)}
    </tr>`).join('')
    || emptyRow(8, q
      ? `Nothing in this filter matches "${q}". Clear the search to see the rest.`
      : view.empty);

  const options = inService.map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join('');
  $('#w-equipment').innerHTML = options;
  $('#pm-equipment').innerHTML = options;
}

export async function addEquipment() {
  const name = $('#e-name').value.trim();
  if (!name) return formError('equipment-form', 'A machine needs a name.');
  try {
    await api('/equipment', { method: 'POST', body: JSON.stringify({
      name, asset_tag: $('#e-tag').value, category: $('#e-cat').value, location: $('#e-loc').value,
    })});
    ['#e-name', '#e-tag', '#e-cat', '#e-loc'].forEach((s) => { $(s).value = ''; });
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
  $('#ee-notes').value = machine.notes || '';
  // A file input cannot be filled from script, so an empty one means "keep what
  // is there". The preview is what tells the admin a photograph already exists.
  $('#ee-photo').value = '';
  $('#ee-photo-clear').checked = false;
  $('#ee-photo-preview').innerHTML = machine.photo
    ? `<img src="/api/equipment/${machine.id}/photo?t=${Date.now()}" alt="${esc(machine.name)}" />`
    : '<span>No photograph yet</span>';
  $('#equipment-edit-title').textContent = `Edit ${machine.name}`;
  openForm('equipment-edit');
}

/** Send the bytes as they are. The server sniffs the type and picks the name;
 *  the header below is a courtesy, not a claim it will believe. */
async function uploadPhoto(machineId, file) {
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('That photograph is larger than 2 MB. Resize it and try again.');
  }
  const res = await fetch(`/api/equipment/${machineId}/photo`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!res.ok) {
    const problem = await res.json().catch(() => ({}));
    throw new Error(problem.error || 'The photograph could not be saved');
  }
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
