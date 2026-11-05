// Front-end: fetch calls + a little rendering. No framework, no build step.
const $ = (s) => document.querySelector(s);

// The shell lives in its own module (see public/shell.js for why). app.js stays a
// classic script because the markup uses inline onclick handlers, which need
// globals; the module is loaded once here and reached through window.shell.
const shellReady = import('/shell.js').then((m) => { window.shell = m; return m; });
const dashReady = import('/dashboard.js').then((m) => { window.dash = m; return m; });
const $$ = (s) => document.querySelectorAll(s);

// ---------------------------------------------------------------- helpers
async function api(path, options = {}) {
  const res = await fetch('/api' + path, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  if (res.status === 401) { showLogin(); throw new Error('Please sign in'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function badge(text, kind) { return `<span class="badge b-${kind}">${esc(text)}</span>`; }

// ------------------------------------------------------------------ auth
function showLogin() {
  $('#login').classList.remove('hidden');
  $('#app').classList.add('hidden');
}
function showApp(user) {
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#who').textContent = `${user.name} (${user.role})`;
  buildTabs(user);
  showPage('dashboard');
}
async function login() {
  $('#login-error').textContent = '';
  try {
    const user = await api('/login', {
      method: 'POST',
      body: JSON.stringify({ email: $('#email').value, password: $('#password').value }),
    });
    showApp(user);
  } catch (e) { $('#login-error').textContent = e.message; }
}
async function logout() {
  await api('/logout', { method: 'POST' });
  showLogin();
}

// ------------------------------------------------------------------ tabs
const PAGES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'due', label: 'Due soon' },
  { key: 'equipment', label: 'Machines' },
  { key: 'work', label: 'Work orders' },
  { key: 'pm', label: 'Maintenance' },
  { key: 'parts', label: 'Spare parts' },
  { key: 'users', label: 'Users', adminOnly: true },
  { key: 'backup', label: 'Backup', adminOnly: true },
];
let currentPage = 'due';

function buildTabs(user) {
  // Same PAGES array and the same adminOnly filter as before — the sidebar is a
  // different rendering of the one list of screens, never a second list.
  const visible = PAGES.filter((p) => !p.adminOnly || user.role === 'admin');
  shellReady.then((shell) => shell.renderShell({
    pages: visible,
    current: currentPage,
    onNavigate: showPage,
  }));
}

function showPage(key) {
  currentPage = key;
  if (window.shell) window.shell.markCurrent(key);
  $$('section[data-page]').forEach((s) => s.classList.toggle('hidden', s.dataset.page !== key));
  const loaders = {
    dashboard: loadDashboard,
    due: loadDue, equipment: loadEquipment, work: loadWork,
    pm: loadPm, parts: loadParts, users: loadUsers,
  };
  loaders[key]?.();
}

// -------------------------------------------------------------- equipment
async function loadEquipment() {
  const rows = await api('/equipment');
  $('#equipment-rows').innerHTML = rows.map((e) => `
    <tr>
      <td>${esc(e.name)}</td><td>${esc(e.asset_tag || '—')}</td>
      <td>${esc(e.category || '—')}</td><td>${esc(e.location || '—')}</td>
      <td>${badge(e.status, e.status === 'active' ? 'green' : e.status === 'down' ? 'red' : 'grey')}</td>
      <td class="actions">
        <button class="small" onclick="toggleStatus(${e.id}, '${e.status}')">
          ${e.status === 'retired' ? 'Restore' : 'Retire'}
        </button>
        <button class="small danger" onclick="removeEquipment(${e.id})">Delete</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="6" class="muted">No machines yet.</td></tr>';

  const options = rows.map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join('');
  $('#w-equipment').innerHTML = options;
  $('#pm-equipment').innerHTML = options;
}

async function addEquipment() {
  const name = $('#e-name').value.trim();
  if (!name) return alert('Name is required');
  await api('/equipment', { method: 'POST', body: JSON.stringify({
    name, asset_tag: $('#e-tag').value, category: $('#e-cat').value, location: $('#e-loc').value,
  })});
  ['#e-name', '#e-tag', '#e-cat', '#e-loc'].forEach((s) => { $(s).value = ''; });
  loadEquipment();
}

async function toggleStatus(id, status) {
  await api(`/equipment/${id}`, { method: 'PUT', body: JSON.stringify({
    status: status === 'retired' ? 'active' : 'retired',
  })});
  loadEquipment();
}

async function removeEquipment(id) {
  if (!confirm('Delete this machine and its work orders?')) return;
  try { await api(`/equipment/${id}`, { method: 'DELETE' }); loadEquipment(); }
  catch (e) { alert(e.message); }
}

// ------------------------------------------------------------ work orders
const STATUS_KIND = { open: 'amber', in_progress: 'grey', done: 'green' };
const NEXT_STATUS = { open: 'in_progress', in_progress: 'done', done: 'open' };

let workCache = [];
let editingWork = null;
let assignable = [];          // { id, name } — fetched once per session

async function loadWork() {
  const status = $('#wo-status-filter')?.value;
  workCache = await api(`/work-orders${status ? `?status=${encodeURIComponent(status)}` : ''}`);
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
        <td class="actions">
          <button class="small" onclick="saveWork(${w.id})">Save</button>
          <button class="small" onclick="cancelWork()">Cancel</button>
        </td>
      </tr>`
    : `<tr>
        <td>${esc(w.equipment_name)}</td><td>${esc(w.title)}</td>
        <td>${w.assignee_name ? esc(w.assignee_name) : '<span class="muted">unassigned</span>'}</td>
        <td>${badge(w.priority, w.priority === 'high' ? 'red' : w.priority === 'low' ? 'grey' : 'amber')}</td>
        <td>${badge(w.status.replace('_', ' '), STATUS_KIND[w.status])}</td>
        <td class="actions">
          <button class="small" onclick="advance(${w.id}, '${NEXT_STATUS[w.status]}')">
            ${w.status === 'done' ? 'Reopen' : 'Move to ' + NEXT_STATUS[w.status].replace('_', ' ')}
          </button>
          <button class="small" onclick="editWork(${w.id})">Edit</button>
        </td>
      </tr>`)).join('') || '<tr><td colspan="6" class="muted">No work orders yet.</td></tr>';
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

function editWork(idToEdit) {
  editingWork = idToEdit;
  loadWork();
}

function cancelWork() {
  editingWork = null;
  loadWork();
}

async function saveWork(idToSave) {
  try {
    await api(`/work-orders/${idToSave}`, { method: 'PATCH', body: JSON.stringify({
      title: $(`#we-title-${idToSave}`).value,
      assigned_to: $(`#we-owner-${idToSave}`).value || null,
      priority: $(`#we-priority-${idToSave}`).value,
    })});
    editingWork = null;
    loadWork();
  } catch (e) { alert(e.message); }
}

async function addWorkOrder() {
  const title = $('#w-title').value.trim();
  try {
    await api('/work-orders', { method: 'POST', body: JSON.stringify({
      equipment_id: $('#w-equipment').value, title, priority: $('#w-priority').value,
    })});
    $('#w-title').value = '';
    loadWork();
  } catch (e) { alert(e.message); }
}

async function advance(id, status) {
  try { await api(`/work-orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); loadWork(); }
  catch (e) { alert(e.message); }
}

// ------------------------------------------------------------------ parts
let partsCache = [];
let editingPart = null;              // id of the row currently in edit mode

// The badge rule lives in one place so the UI and the tests cannot disagree:
// out of stock, at-or-below the part's own reorder level, or healthy.
function stockCell(p) {
  if (p.qty <= 0) return badge('out', 'red');
  if (p.qty <= p.reorder_level) return badge(p.qty, 'amber');
  return esc(p.qty);
}

async function loadParts() {
  const low = $('#low-stock-filter')?.checked;
  partsCache = await api(`/parts${low ? '?low=1' : ''}`);
  $('#parts-rows').innerHTML = partsCache.map((p) => (p.id === editingPart
    ? `<tr>
        <td><input id="edit-name-${p.id}" value="${esc(p.name)}" /></td>
        <td><input id="edit-ref-${p.id}" value="${esc(p.reference || '')}" /></td>
        <td><input id="edit-qty-${p.id}" type="number" min="0" value="${p.qty}" /></td>
        <td><input id="edit-price-${p.id}" type="number" step="0.01" value="${p.unit_price ?? ''}" /></td>
        <td><input id="edit-reorder-${p.id}" type="number" min="0" value="${p.reorder_level}" /></td>
        <td class="actions">
          <button class="small" onclick="savePart(${p.id})">Save</button>
          <button class="small" onclick="cancelPart()">Cancel</button>
        </td>
      </tr>`
    : `<tr>
        <td>${esc(p.name)}</td><td>${esc(p.reference || '—')}</td>
        <td>${stockCell(p)}</td>
        <td>${p.unit_price == null ? '—' : esc(p.unit_price)}</td>
        <td>${esc(p.reorder_level)}</td>
        <td class="actions">
          <button class="small" onclick="editPart(${p.id})">Edit</button>
          <button class="small danger" onclick="removePart(${p.id})">Delete</button>
        </td>
      </tr>`)).join('') || '<tr><td colspan="6" class="muted">No parts yet.</td></tr>';
}

function editPart(idToEdit) {
  editingPart = idToEdit;
  loadParts();
}

function cancelPart() {
  editingPart = null;
  loadParts();
}

async function savePart(idToSave) {
  try {
    await api(`/parts/${idToSave}`, { method: 'PUT', body: JSON.stringify({
      name: $(`#edit-name-${idToSave}`).value,
      reference: $(`#edit-ref-${idToSave}`).value,
      qty: $(`#edit-qty-${idToSave}`).value,
      unit_price: $(`#edit-price-${idToSave}`).value,
      reorder_level: $(`#edit-reorder-${idToSave}`).value,
    })});
    editingPart = null;
    loadParts();
  } catch (e) { alert(e.message); }
}

async function removePart(idToRemove) {
  // Look the name up by id rather than interpolating it into the onclick — a part
  // called O'Brien or one containing a quote must not break the button.
  const part = partsCache.find((p) => p.id === idToRemove);
  if (!confirm(`Delete the part "${part ? part.name : ''}"?`)) return;
  try {
    await api(`/parts/${idToRemove}`, { method: 'DELETE' });
    loadParts();
  } catch (e) { alert(e.message); }
}

async function addPart() {
  const name = $('#p-name').value.trim();
  if (!name) return alert('Name is required');
  try {
    await api('/parts', { method: 'POST', body: JSON.stringify({
      name, reference: $('#p-ref').value, qty: $('#p-qty').value,
      unit_price: $('#p-price').value, reorder_level: $('#p-reorder').value,
      supplier: $('#p-supplier').value,
    })});
    ['#p-name', '#p-ref', '#p-price', '#p-supplier'].forEach((s) => { $(s).value = ''; });
    $('#p-qty').value = '0';
    $('#p-reorder').value = '5';
    loadParts();
  } catch (e) { alert(e.message); }
}

// ----------------------------------------------------- preventive maint.
function dueKind(days) {
  if (days < 0) return badge(`${-days} days overdue`, 'red');
  if (days === 0) return badge('today', 'amber');
  return badge(`in ${days} days`, days <= 7 ? 'amber' : 'grey');
}

async function loadDashboard() {
  const host = $('#dashboard-body');
  if (!host) return;
  try {
    const data = await api('/dashboard');
    const dash = await dashReady;
    dash.renderDashboard(host, data);
  } catch (e) {
    // A failed load must not render as four zeroes — that reads as "all clear",
    // which is the one thing a dashboard must never say wrongly.
    const dash = await dashReady;
    dash.renderDashboardError(host, e.message);
  }
}

async function loadDue() {
  const days = $('#due-days').value || 7;
  const rows = await api(`/pm/due?days=${days}`);
  $('#due-rows').innerHTML = rows.map((p) => `
    <tr>
      <td>${esc(p.equipment_name)}</td><td>${esc(p.task)}</td>
      <td>${p.interval_days} d</td><td>${esc(p.next_due)} ${dueKind(p.days_left)}</td>
      <td><button class="small" onclick="pmDone(${p.id})">Mark done</button></td>
    </tr>`).join('') || '<tr><td colspan="5" class="muted">Nothing due in this window.</td></tr>';
}

async function loadPm() {
  const rows = await api('/pm');
  $('#pm-rows').innerHTML = rows.map((p) => `
    <tr>
      <td>${esc(p.equipment_name)}</td><td>${esc(p.task)}</td><td>${p.interval_days} d</td>
      <td>${esc(p.last_done || '—')}</td><td>${esc(p.next_due)} ${dueKind(p.days_left)}</td>
      <td><input type="date" id="pm-on-${p.id}" value="${esc(today())}" title="The day it was done" />
        <button class="small" onclick="pmDone(${p.id})">Mark done</button></td>
    </tr>`).join('') || '<tr><td colspan="6" class="muted">No schedules yet.</td></tr>';
}

async function addPm() {
  try {
    await api('/pm', { method: 'POST', body: JSON.stringify({
      equipment_id: $('#pm-equipment').value,
      task: $('#pm-task').value,
      interval_days: $('#pm-interval').value,
      next_due: $('#pm-first').value || undefined,
    })});
    $('#pm-task').value = '';
    $('#pm-first').value = '';
    loadPm();
  } catch (e) { alert(e.message); }
}

async function pmDone(id) {
  // Send the date the technician actually chose. Sending {} was how the field
  // silently meant "today" no matter what it said.
  const on = $(`#pm-on-${id}`).value;
  try {
    await api(`/pm/${id}/done`, { method: 'POST', body: JSON.stringify({ on }) });
    loadPm();
  } catch (e) { alert(e.message); }
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ------------------------------------------------------------------ export
// window.location rather than fetch: the server already sets
// content-disposition, and letting the browser handle it avoids holding the
// whole file in memory and gives the user their normal download UI.
// Each export takes its own page's filter and nothing else. Reading every
// filter on the page would append one page's setting to the other page's file
// and rely on the server ignoring it — a habit that hides real bugs.
function downloadWorkOrders() {
  const status = $('#wo-status-filter')?.value;
  window.location = `/api/export/work-orders.csv${status ? `?status=${encodeURIComponent(status)}` : ''}`;
}

function downloadParts() {
  const low = $('#low-stock-filter')?.checked;
  window.location = `/api/export/parts.csv${low ? '?low=1' : ''}`;
}

// ----------------------------------------------------------------- backup
async function doBackup() {
  try {
    const r = await api('/backup', { method: 'POST' });
    $('#backup-result').textContent = 'Saved: ' + r.file;
  } catch (e) { $('#backup-result').textContent = e.message; }
}


// ------------------------------------------------------------------ users
async function loadUsers() {
  const rows = await api('/users');
  $('#users-rows').innerHTML = rows.map((u) => `
    <tr>
      <td>${esc(u.name)}</td><td>${esc(u.email)}</td>
      <td>${badge(u.role, u.role === 'admin' ? 'amber' : 'grey')}</td>
      <td>${u.active ? badge('active', 'green') : badge('disabled', 'red')}</td>
      <td><button class="small" onclick="toggleUser(${u.id}, ${u.active ? 0 : 1})">
        ${u.active ? 'Disable' : 'Enable'}
      </button></td>
    </tr>`).join('') || '<tr><td colspan="5" class="muted">No users yet.</td></tr>';
}

async function addUser() {
  try {
    await api('/users', { method: 'POST', body: JSON.stringify({
      name: $('#u-name').value,
      email: $('#u-email').value,
      password: $('#u-pass').value,
      role: $('#u-role').value,
    })});
    ['#u-name', '#u-email', '#u-pass'].forEach((s) => { $(s).value = ''; });
    loadUsers();
  } catch (e) { alert(e.message); }
}

async function toggleUser(id, active) {
  try { await api(`/users/${id}`, { method: 'PUT', body: JSON.stringify({ active: !!active }) }); loadUsers(); }
  catch (e) { alert(e.message); }
}

// ------------------------------------------------------------------ boot
(async () => {
  try { showApp(await api('/me')); }
  catch { showLogin(); }
})();
