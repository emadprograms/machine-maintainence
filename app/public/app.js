// Front-end: fetch calls + a little rendering. No framework, no build step.
const $ = (s) => document.querySelector(s);

// The shell lives in its own module (see public/shell.js for why). app.js stays a
// classic script because the markup uses inline onclick handlers, which need
// globals; the module is loaded once here and reached through window.shell.
const shellReady = import('/shell.js').then((m) => { window.shell = m; return m; });
const dashReady = import('/dashboard.js').then((m) => { window.dash = m; return m; });
const historyReady = import('/history.js').then((m) => { return m; });
const reportReady = import('/report.js').then((m) => { return m; });
const machinesReady = import('/machines.js').then((m) => { return m; });
const $$ = (s) => document.querySelectorAll(s);

// ------------------------------------------------------- dialogs and empty states

/** Open a create form. One function for all seven, so they cannot drift apart. */
function openForm(id) {
  const d = document.getElementById(id);
  if (!d) return;
  d.querySelector('.form-error')?.replaceChildren();   // clear last time's message
  if (typeof d.showModal === 'function') d.showModal();
  else d.setAttribute('open', '');                     // older browsers: still usable
  d.querySelector('input, select')?.focus();
}

function closeForm(id) {
  const d = document.getElementById(id);
  if (d?.open) d.close();
  else d?.removeAttribute('open');
}

/** Close a dialog once its work succeeded. Failure leaves it open so the message
 *  stays next to the field that caused it. */
function formDone(id) { closeForm(id); }

/** Write a validation message into a dialog rather than raising an alert():
 *  an alert blocks the whole page and loses the user's place. */
function formError(id, message) {
  const p = document.getElementById(id)?.querySelector('.form-error');
  if (p) p.textContent = message;
  else alert(message);
}

/** A whole-table sentence for an empty list.
 *  Only ever called after a fetch succeeded — the catch paths are untouched, so
 *  "nothing here" can never be shown in place of "could not load". */
function emptyRow(colspan, sentence) {
  return `<tr><td colspan="${colspan}" class="cell-say">${esc(sentence)}</td></tr>`;
}

/** A row's first cell: the thing the row is about. */
// The heavier first cell. `sub` carries a second, smaller line, for a table that
// needs one (none does now that Machines has real Category and Location columns —
// the argument stays because it is two lines and cheaper than a second helper).
const strong = (v, sub) => `<td class="cell-strong">${esc(v)}${sub
  ? `<span class="row-sub">${esc(sub)}</span>` : ''}</td>`;
/** A secondary value, or an honest absence rather than a dash. */
const soft = (v, fallback = 'Not set') =>
  `<td class="cell-muted">${v ? esc(v) : fallback}</td>`;

/** What is in a search box, trimmed. Missing box, empty string. */
function searchTerm(selector) {
  return ($(selector)?.value || '').trim();
}

/** Wait for typing to stop before asking the server. One request per pause, not
 *  one per keystroke, and the list still feels immediate on a LAN. */
function debounce(fn, ms = 150) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

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
/**
 * Upload a photograph. Bytes are not JSON, so this cannot go through api(); and
 * the 2 MB refusal happens here as well as on the server, because a phone photo
 * that fails at the end of an upload is worse than a sentence before it starts.
 */
async function postPhoto(path, file) {
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('That photograph is larger than 2 MB. Resize it and try again.');
  }
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (res.status === 401) { showLogin(); throw new Error('Please sign in'); }
  if (!res.ok) {
    const problem = await res.json().catch(() => ({}));
    throw new Error(problem.error || 'The photograph could not be saved');
  }
  return res.json().catch(() => ({}));
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
  // Screens that live in their own module need to know who is looking: the
  // Machines screen draws Edit/Retire/Delete only for an admin. The server
  // enforces it regardless — this is so a technician is not offered a door that
  // will not open.
  window.me = user;
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
  { key: 'history', label: 'History' },
  { key: 'report', label: 'Report' },
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
    history: loadHistory, report: loadReport,
    pm: loadPm, parts: loadParts, users: loadUsers,
  };
  loaders[key]?.();
}

// -------------------------------------------------------------- equipment
const searchEquipment = debounce(() => loadEquipment());

// The Machines screen lives in its own module (see machines.js). These are the
// names the markup and the screen loader already use, so nothing above changes.
async function loadEquipment() { return (await machinesReady).loadEquipment(); }
async function addEquipment() { return (await machinesReady).addEquipment(); }
function editEquipment(idToEdit) { (machinesReady).then((m) => m.editEquipment(idToEdit)); }
function saveEquipment() { (machinesReady).then((m) => m.saveEquipment()); }
async function toggleStatus(id, status) { return (await machinesReady).toggleStatus(id, status); }
async function removeEquipment(id) { return (await machinesReady).removeEquipment(id); }
function openEquipmentDelete(id) { (machinesReady).then((m) => m.openEquipmentDelete(id)); }
function checkDeletePhrase() { (machinesReady).then((m) => m.checkDeletePhrase()); }
function confirmEquipmentDelete() { (machinesReady).then((m) => m.confirmEquipmentDelete()); }

// ------------------------------------------------------------ work orders
// The Work orders screen lives in its own module (see work.js). These are the
// names the markup and the rendered rows already use, so nothing above changes.
const workReady = import('/work.js').then((m) => { return m; });

async function loadWork() { return (await workReady).loadWork(); }
async function addWorkOrder() { return (await workReady).addWorkOrder(); }
function advance(id, status) { (workReady).then((m) => m.advance(id, status)); }
function editWork(idToEdit) { (workReady).then((m) => m.editWork(idToEdit)); }
function cancelWork() { (workReady).then((m) => m.cancelWork()); }
function saveWork(idToSave) { (workReady).then((m) => m.saveWork(idToSave)); }
function searchWork() { (workReady).then((m) => m.searchWork()); }
function usePart() { (workReady).then((m) => m.usePart()); }
function confirmCloseWork() { (workReady).then((m) => m.confirmCloseWork()); }

// ------------------------------------------------------------------ parts
let partsCache = [];
let editingPart = null;              // id of the row currently in edit mode

/** A price, always with two decimals so a column lines up. */
function money(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : String(v);
}

// The badge rule lives in one place so the UI and the tests cannot disagree:
// out of stock, at-or-below the part's own reorder level, or healthy.
function stockCell(p) {
  const cell = (inner) => `<td class="cell-num">${inner}</td>`;
  if (p.qty <= 0) return cell(badge('out', 'red'));
  if (p.qty <= p.reorder_level) return cell(badge(p.qty, 'amber'));
  return cell(esc(p.qty));
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
        <td>
          <button class="ghost small" onclick="savePart(${p.id})">Save</button>
          <button class="ghost small" onclick="cancelPart()">Cancel</button>
        </td>
      </tr>`
    : `<tr>
        ${strong(p.name)}${soft(p.reference)}
        ${stockCell(p)}
        <td class="cell-num cell-muted">${p.unit_price == null ? 'Not set' : esc(money(p.unit_price))}</td>
        <td class="cell-num cell-muted">${esc(p.reorder_level)}</td>
        <td>
          <button class="ghost small" onclick="editPart(${p.id})">Edit</button>
          <button class="ghost small danger" onclick="removePart(${p.id})">Delete</button>
        </td>
      </tr>`)).join('')
    || emptyRow(6, low
      ? 'Every part is above its reorder level. Nothing to order.'
      : 'No spare parts yet. Add the ones you keep on the shelf.');
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
  const label = part ? part.name : 'this part';
  if (!confirm(`Delete "${label}" from the spare parts list?\n\nIts stock count and price go with it. This cannot be undone.`)) return;
  try {
    await api(`/parts/${idToRemove}`, { method: 'DELETE' });
    loadParts();
  } catch (e) { alert(e.message); }
}

async function addPart() {
  const name = $('#p-name').value.trim();
  if (!name) return formError('parts-form', 'A part needs a name.');
  try {
    await api('/parts', { method: 'POST', body: JSON.stringify({
      name, reference: $('#p-ref').value, qty: $('#p-qty').value,
      unit_price: $('#p-price').value, reorder_level: $('#p-reorder').value,
      supplier: $('#p-supplier').value,
    })});
    ['#p-name', '#p-ref', '#p-price', '#p-supplier'].forEach((s) => { $(s).value = ''; });
    $('#p-qty').value = '0';
    $('#p-reorder').value = '5';
    formDone('parts-form');
    loadParts();
  } catch (e) { formError('parts-form', e.message); }
}

// ----------------------------------------------------- preventive maint.
function dueKind(days) {
  if (days < 0) return badge(`${-days} days overdue`, 'red');
  if (days === 0) return badge('today', 'amber');
  return badge(`in ${days} days`, days <= 7 ? 'amber' : 'grey');
}

// The History screen lives in its own module. This waits for it and hands over,
// so showPage stays the one place that knows which screens exist.
async function loadHistory() {
  return (await historyReady).loadHistory();
}

async function loadReport() {
  return (await reportReady).loadReport();
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
  // `service=active`: a machine that has left the workshop has no maintenance to
  // do. The schedule is not deleted — park the machine and it waits; restore it
  // and the reminders come back.
  const rows = await api(`/pm/due?days=${days}&service=active`);
  $('#due-rows').innerHTML = rows.map((p) => `
    <tr>
      ${strong(p.equipment_name)}<td>${esc(p.task)}</td>
      <td class="cell-num cell-muted">every ${p.interval_days} d</td>
      <td class="cell-num">${esc(p.next_due)} ${dueKind(p.days_left)}</td>
      <td><button class="ghost small" onclick="pmDone(${p.id})">Mark done</button></td>
    </tr>`).join('')
    || emptyRow(5, 'Nothing is due in this window. Widen the range above to look further ahead.');
}

async function loadPm() {
  // Same rule as Due soon, asked for the same way, so the two lists cannot disagree
  // about which machines still have maintenance.
  const rows = await api('/pm?service=active');
  $('#pm-rows').innerHTML = rows.map((p) => `
    <tr>
      ${strong(p.equipment_name)}<td>${esc(p.task)}</td>
      <td class="cell-num cell-muted">every ${p.interval_days} d</td>
      ${soft(p.last_done, 'Never')}
      <td class="cell-num">${esc(p.next_due)} ${dueKind(p.days_left)}</td>
      <td><input type="date" id="pm-on-${p.id}" value="${esc(today())}" title="The day it was done" />
        <button class="ghost small" onclick="pmDone(${p.id})">Mark done</button></td>
    </tr>`).join('')
    || emptyRow(6, 'No repeating maintenance yet. Add a schedule and it will show up here.');
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
    formDone('pm-form');
    loadPm();
  } catch (e) { formError('pm-form', e.message); }
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
async function downloadWorkOrders() {
  window.location = `/api/export/work-orders.csv${(await workReady).workQuery()}`;
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
      ${strong(u.name)}<td class="cell-muted">${esc(u.email)}</td>
      <td>${badge(u.role, u.role === 'admin' ? 'amber' : 'grey')}</td>
      <td>${u.active ? badge('active', 'green') : badge('disabled', 'red')}</td>
      <td><button class="ghost small" onclick="toggleUser(${u.id}, ${u.active ? 0 : 1})">
        ${u.active ? 'Disable' : 'Enable'}
      </button></td>
    </tr>`).join('')
    || emptyRow(5, 'Only your account exists. Create the rest with "New user".');
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
    formDone('users-form');
    loadUsers();
  } catch (e) { formError('users-form', e.message); }
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
