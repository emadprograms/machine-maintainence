// Front-end: fetch calls + a little rendering. No framework, no build step.
const $ = (s) => document.querySelector(s);
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
  showPage('due');
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
  { key: 'due', label: 'Due soon' },
  { key: 'equipment', label: 'Machines' },
  { key: 'work', label: 'Work orders' },
  { key: 'pm', label: 'Maintenance' },
  { key: 'parts', label: 'Spare parts' },
  { key: 'backup', label: 'Backup', adminOnly: true },
];
let currentPage = 'due';

function buildTabs(user) {
  $('#tabs').innerHTML = PAGES
    .filter((p) => !p.adminOnly || user.role === 'admin')
    .map((p) => `<button data-tab="${p.key}" onclick="showPage('${p.key}')">${p.label}</button>`)
    .join('');
}

function showPage(key) {
  currentPage = key;
  $$('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === key));
  $$('section[data-page]').forEach((s) => s.classList.toggle('hidden', s.dataset.page !== key));
  const loaders = { due: loadDue, equipment: loadEquipment, work: loadWork, pm: loadPm, parts: loadParts };
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

async function loadWork() {
  const rows = await api('/work-orders');
  $('#work-rows').innerHTML = rows.map((w) => `
    <tr>
      <td>${esc(w.equipment_name)}</td><td>${esc(w.title)}</td>
      <td>${badge(w.priority, w.priority === 'high' ? 'red' : w.priority === 'low' ? 'grey' : 'amber')}</td>
      <td>${badge(w.status.replace('_', ' '), STATUS_KIND[w.status])}</td>
      <td><button class="small" onclick="advance(${w.id}, '${NEXT_STATUS[w.status]}')">
        ${w.status === 'done' ? 'Reopen' : 'Move to ' + NEXT_STATUS[w.status].replace('_', ' ')}
      </button></td>
    </tr>`).join('') || '<tr><td colspan="5" class="muted">No work orders yet.</td></tr>';
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
async function loadParts() {
  const rows = await api('/parts');
  $('#parts-rows').innerHTML = rows.map((p) => `
    <tr>
      <td>${esc(p.name)}</td><td>${esc(p.reference || '—')}</td>
      <td>${p.qty <= 0 ? badge('out', 'red') : p.qty < 5 ? badge(p.qty, 'amber') : esc(p.qty)}</td>
      <td>${p.unit_price == null ? '—' : esc(p.unit_price)}</td>
    </tr>`).join('') || '<tr><td colspan="4" class="muted">No parts yet.</td></tr>';
}

async function addPart() {
  const name = $('#p-name').value.trim();
  if (!name) return alert('Name is required');
  await api('/parts', { method: 'POST', body: JSON.stringify({
    name, reference: $('#p-ref').value, qty: $('#p-qty').value, unit_price: $('#p-price').value,
  })});
  ['#p-name', '#p-ref', '#p-price'].forEach((s) => { $(s).value = ''; });
  $('#p-qty').value = '0';
  loadParts();
}

// ----------------------------------------------------- preventive maint.
function dueKind(days) {
  if (days < 0) return badge(`${-days} days overdue`, 'red');
  if (days === 0) return badge('today', 'amber');
  return badge(`in ${days} days`, days <= 7 ? 'amber' : 'grey');
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
      <td><button class="small" onclick="pmDone(${p.id})">Mark done</button></td>
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
  try { await api(`/pm/${id}/done`, { method: 'POST', body: '{}' }); loadPm(); }
  catch (e) { alert(e.message); }
}

// ----------------------------------------------------------------- backup
async function doBackup() {
  try {
    const r = await api('/backup', { method: 'POST' });
    $('#backup-result').textContent = 'Saved: ' + r.file;
  } catch (e) { $('#backup-result').textContent = e.message; }
}

// ------------------------------------------------------------------ boot
(async () => {
  try { showApp(await api('/me')); }
  catch { showLogin(); }
})();
