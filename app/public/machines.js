// The Machines screen: the list every other screen points at, and the form that
// corrects a record.
//
// Its own file for the same reason as shell.js, dashboard.js and history.js. It
// uses the helpers app.js already defines (esc, strong, soft, badge, emptyRow,
// api, $, searchTerm, openForm, closeForm, formError, formDone) rather than
// repeating them: this is one page, not a bundle of independent widgets.

// The list as last loaded. Edit needs the whole record to fill its form, and
// looking it up here beats inventing a GET /api/equipment/:id that nothing else
// would use.
let equipmentRows = [];

export async function loadEquipment() {
  const q = searchTerm('#eq-search');
  const rows = await api(`/equipment${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  equipmentRows = rows;
  $('#equipment-rows').innerHTML = rows.map((e) => `
    <tr>
      ${strong(e.name)}${soft(e.asset_tag)}${soft(e.category)}${soft(e.location)}
      <td>${badge(e.status, e.status === 'active' ? 'green' : e.status === 'down' ? 'red' : 'grey')}</td>
      <td>
        <button class="ghost small" onclick="editEquipment(${e.id})">Edit</button>
        <button class="ghost small" onclick="toggleStatus(${e.id}, '${e.status}')">
          ${e.status === 'retired' ? 'Restore' : 'Retire'}
        </button>
        <button class="ghost small" onclick="openMachineHistory(${e.id}, this)">History</button>
        <button class="ghost small danger" onclick="removeEquipment(${e.id})">Delete</button>
      </td>
    </tr>`).join('')
    || emptyRow(6, searchTerm('#eq-search')
      ? `No machine matches "${searchTerm('#eq-search')}". Clear the search to see them all.`
      : 'No machines yet. Add the first one and it will appear here.');

  const options = rows.map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join('');
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
  $('#ee-status').value = machine.status || 'active';
  $('#ee-notes').value = machine.notes || '';
  $('#equipment-edit-title').textContent = `Edit ${machine.name}`;
  openForm('equipment-edit');
}

/** Save the whole record. An omitted field would mean "leave it alone" on the
 *  server, and an empty box means "there is nothing here", so empty text is sent
 *  as null rather than as ''. */
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
    status: $('#ee-status').value,
    notes: $('#ee-notes').value.trim() || null,
  };
  try {
    await api(`/equipment/${machineId}`, { method: 'PUT', body: JSON.stringify(body) });
    formDone('equipment-edit');
    loadEquipment();
  } catch (e) { formError('equipment-edit', e.message); }
}

export async function toggleStatus(id, status) {
  await api(`/equipment/${id}`, { method: 'PUT', body: JSON.stringify({
    status: status === 'retired' ? 'active' : 'retired',
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
