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

/** Editing, retiring and deleting are an administrator's business. A technician
 *  still gets the way into a machine's history, because that is reading. */
function actions(machine) {
  const admin = window.me?.role === 'admin';
  const edit = admin
    ? `<button class="ghost small" onclick="editEquipment(${machine.id})">Edit</button>` : '';
  const retire = admin
    ? `<button class="ghost small" onclick="toggleStatus(${machine.id}, '${machine.service_status}')">
        ${machine.service_status === 'retired' ? 'Restore' : 'Retire'}
      </button>` : '';
  const remove = admin
    ? `<button class="ghost small danger" onclick="removeEquipment(${machine.id})">Delete</button>` : '';
  return `<td>${edit}<button class="ghost small" onclick="openMachineHistory(${machine.id}, this)">History</button>${retire}${remove}</td>`;
}

// The list as last loaded. Edit needs the whole record to fill its form, and
// looking it up here beats inventing a GET /api/equipment/:id that nothing else
// would use.
let equipmentRows = [];

export async function loadEquipment() {
  const q = searchTerm('#eq-search');
  const retired = $('#eq-show-retired').checked;
  // Two lists, deliberately. The table is what this screen is filtered to; the
  // dropdowns are "every machine in service", because a new job or a new
  // maintenance schedule must not be startable on a machine that has left. They
  // used to share one array, so typing in the search box narrowed the dropdowns
  // too — searching "pump" left only pumps to report a fault against.
  // The second list is always in service, whatever the toggle says: the toggle is
  // about what this screen *shows*, never about what new work may be started on.
  const [rows, inService] = await Promise.all([
    api(`/equipment?service=${retired ? 'all' : 'active'}${q ? `&q=${encodeURIComponent(q)}` : ''}`),
    api('/equipment?service=active'),
  ]);
  equipmentRows = rows;
  $('#equipment-rows').innerHTML = rows.map((e) => `
    <tr>
      <td class="cell-thumb">${thumbnail(e)}</td>
      ${strong(e.name, [e.category, e.location].filter(Boolean).join(' · ') || null)}
      ${soft(e.asset_tag)}${soft(e.manufacturer)}
      ${statusCell(e)}
      ${actions(e)}
    </tr>`).join('')
    // With retired machines hidden, "no match" has two possible causes and only one
    // of them is the search box. Saying so where the list is empty is cheaper than a
    // support call asking why a machine vanished.
    || emptyRow(6, retired
      ? (q ? `No machine matches "${q}". Clear the search to see them all.`
        : 'No machines yet. Add the first one and it will appear here.')
      : `${q ? `Nothing in service matches "${q}".` : 'Nothing in service.'}`
        + ' Machines that have left are hidden — tick Show retired.');

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

export async function removeEquipment(id) {
  const row = (await api('/equipment')).find((e) => e.id === id);
  const name = row ? row.name : 'this machine';
  if (!confirm(`Delete "${name}"?\n\nIts work orders and maintenance history go with it. This cannot be undone.`)) return;
  try { await api(`/equipment/${id}`, { method: 'DELETE' }); loadEquipment(); }
  catch (e) { alert(e.message); }
}
