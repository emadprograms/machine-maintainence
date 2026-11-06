// Front-end: fetch calls + a little rendering. No framework, no build step.
const $ = (s) => document.querySelector(s);

// The shell lives in its own module (see public/shell.js for why). app.js stays a
// classic script because the markup uses inline onclick handlers, which need
// globals; the module is loaded once here and reached through window.shell.
const shellReady = import('/shell.js').then((m) => { window.shell = m; return m; });
const dashReady = import('/dashboard.js').then((m) => { window.dash = m; return m; });
const historyReady = import('/history.js').then((m) => { return m; });
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
const strong = (v) => `<td class="cell-strong">${esc(v)}</td>`;
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
  { key: 'history', label: 'History' },
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
    history: loadHistory, pm: loadPm, parts: loadParts, users: loadUsers,
  };
  loaders[key]?.();
}

// -------------------------------------------------------------- equipment
const searchEquipment = debounce(() => loadEquipment());

async function loadEquipment() {
  const q = searchTerm('#eq-search');
  const rows = await api(`/equipment${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  $('#equipment-rows').innerHTML = rows.map((e) => `
    <tr>
      ${strong(e.name)}${soft(e.asset_tag)}${soft(e.category)}${soft(e.location)}
      <td>${badge(e.status, e.status === 'active' ? 'green' : e.status === 'down' ? 'red' : 'grey')}</td>
      <td>
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

async function addEquipment() {
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

async function toggleStatus(id, status) {
  await api(`/equipment/${id}`, { method: 'PUT', body: JSON.stringify({
    status: status === 'retired' ? 'active' : 'retired',
  })});
  loadEquipment();
}

async function removeEquipment(id) {
  const row = (await api('/equipment')).find((e) => e.id === id);
  const name = row ? row.name : 'this machine';
  if (!confirm(`Delete "${name}"?\n\nIts work orders and maintenance history go with it. This cannot be undone.`)) return;
  try { await api(`/equipment/${id}`, { method: 'DELETE' }); loadEquipment(); }
  catch (e) { alert(e.message); }
}

// ------------------------------------------------------------ work orders
const STATUS_KIND = { open: 'amber', in_progress: 'grey', done: 'green' };
const NEXT_STATUS = { open: 'in_progress', in_progress: 'done', done: 'open' };

let workCache = [];
let editingWork = null;
let assignable = [];          // { id, name } — fetched once per session

/**
 * The filters on the Work orders screen, as a query string. The list and the CSV
 * download both call this, so the file cannot disagree with the screen.
 */
function workQuery() {
  const params = new URLSearchParams();
  const status = $('#wo-status-filter')?.value;
  const q = searchTerm('#wo-search');
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

const searchWork = debounce(() => loadWork());

async function loadWork() {
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
        <td class="actions">
          <button class="small" onclick="saveWork(${w.id})">Save</button>
          <button class="small" onclick="cancelWork()">Cancel</button>
        </td>
      </tr>`
    : `<tr>
        ${strong(w.equipment_name)}<td>${esc(w.title)}</td>
        <td class="cell-muted">${w.assignee_name ? esc(w.assignee_name) : 'Nobody yet'}</td>
        <td>${badge(w.priority, w.priority === 'high' ? 'red' : w.priority === 'low' ? 'grey' : 'amber')}</td>
        <td>${badge(w.status.replace('_', ' '), STATUS_KIND[w.status])}</td>
        <td>
          <button class="ghost small" onclick="advance(${w.id}, '${NEXT_STATUS[w.status]}')">
            ${w.status === 'done' ? 'Reopen' : 'Move to ' + NEXT_STATUS[w.status].replace('_', ' ')}
          </button>
          <button class="ghost small" onclick="editWork(${w.id})">Edit</button>
        </td>
      </tr>`)).join('')
    || emptyRow(6, searchTerm('#wo-search')
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
  if (!title) return formError('work-form', 'Say what is wrong — even a few words is enough.');
  try {
    await api('/work-orders', { method: 'POST', body: JSON.stringify({
      equipment_id: $('#w-equipment').value, title, priority: $('#w-priority').value,
    })});
    $('#w-title').value = '';
    formDone('work-form');
    loadWork();
  } catch (e) { formError('work-form', e.message); }
}

async function advance(id, status) {
  try { await api(`/work-orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); loadWork(); }
  catch (e) { alert(e.message); }
}

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
      ${strong(p.equipment_name)}<td>${esc(p.task)}</td>
      <td class="cell-num cell-muted">every ${p.interval_days} d</td>
      <td class="cell-num">${esc(p.next_due)} ${dueKind(p.days_left)}</td>
      <td><button class="ghost small" onclick="pmDone(${p.id})">Mark done</button></td>
    </tr>`).join('')
    || emptyRow(5, 'Nothing is due in this window. Widen the range above to look further ahead.');
}

async function loadPm() {
  const rows = await api('/pm');
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
function downloadWorkOrders() {
  window.location = `/api/export/work-orders.csv${workQuery()}`;
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
