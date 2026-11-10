// Exercise the actual combined-view logic without browser dependencies.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const els = new Map();
function el(key) {
  if (!els.has(key)) els.set(key, {
    value: '', hidden: false, innerHTML: '', attributes: {},
    setAttribute(k, v) { this.attributes[k] = v; }, focus() { focused = key; },
  });
  return els.get(key);
}
let focused, calls = [], response, resolveFirst;
const rows = [
  { id: 1, task: 'overdue', equipment_name: 'Press', interval_days: 30, next_due: '2026-01-01', days_left: -1 },
  { id: 2, task: 'week', equipment_name: 'Press', interval_days: 30, next_due: '2026-01-06', days_left: 6 },
  { id: 3, task: 'fortnight', equipment_name: 'Press', interval_days: 30, next_due: '2026-01-12', days_left: 12 },
  { id: 4, task: 'month', equipment_name: 'Press', interval_days: 30, next_due: '2026-01-30', days_left: 30 },
  { id: 5, task: 'quarter', equipment_name: 'Press', interval_days: 30, next_due: '2026-03-01', days_left: 90 },
  { id: 6, task: 'later', equipment_name: 'Press', interval_days: 30, next_due: '2026-04-01', days_left: 91 },
];
const context = vm.createContext({
  $: el, tablesReady: Promise.resolve(),
  api: async () => { if (response instanceof Error) throw response; return response; },
  kit: { rowsFor: (_, values) => values, markTable() {}, rowMenu() { return ''; }, menuItem() { return ''; } },
  esc: (x) => String(x ?? '').replaceAll('<', '&lt;'), strong: (x) => `<td>${x}</td>`,
  soft: (x) => `<td>${x || ''}</td>`, dueKind: () => '', emptyRow: (_, x) => `<tr>${x}</tr>`, today: () => '2026-01-02',
  openForm: () => { el('#pm-form').open = true; },
  loadHistoryTable: (kind) => calls.push(`history:${kind}`), loadEquipment: () => calls.push('equipment'),
  showPage: (page) => calls.push(page),
});
const extract = (a, b) => source.slice(source.indexOf(a), source.indexOf(b, source.indexOf(a)));
vm.runInContext("let machineTab = 'list'; let currentPage = 'equipment';\n" + extract('function selectMachineTab(', '// Time zone is installation-wide.'), context);
vm.runInContext(extract('let pmCache = [];', "tablesReady.then((t) => t.register('pm-rows'"), context);
vm.runInContext(extract('let pmMachineLoad = 0;', 'async function addPm()'), context);
el('#pm-days').value = '7'; el('#pm-filter').value = 'all'; response = rows;
await context.loadPm();
assert.match(el('#pm-rows').innerHTML, /later/);
el('#pm-filter').value = 'due';
for (const [days, included, excluded] of [[7, 'week', 'fortnight'], [14, 'fortnight', 'month'], [30, 'month', 'quarter'], [90, 'quarter', 'later']]) {
  el('#pm-days').value = String(days); context.drawPm();
  assert.match(el('#pm-rows').innerHTML, new RegExp(included));
  assert.doesNotMatch(el('#pm-rows').innerHTML, new RegExp(excluded));
  assert.match(el('#pm-rows').innerHTML, /overdue/);
  assert.equal(el('#pm-window-label').hidden, false);
}
el('#pm-filter').value = 'overdue'; context.drawPm();
assert.match(el('#pm-rows').innerHTML, /overdue/); assert.doesNotMatch(el('#pm-rows').innerHTML, /week/);
response = new Error('<offline>'); await context.loadPm();
assert.match(el('#pm-rows').innerHTML, /Could not load maintenance.*&lt;offline>/);
el('#pm-filter').value = 'all'; context.drawPm(); assert.match(el('#pm-rows').innerHTML, /Could not load/);
response = rows; await context.loadPm(); assert.match(el('#pm-rows').innerHTML, /later/);
// An older response must not replace a newer successful one.
response = new Promise((resolve) => { resolveFirst = resolve; }); const first = context.loadPm();
response = rows; await context.loadPm(); resolveFirst([]); await first;
assert.match(el('#pm-rows').innerHTML, /later/);
response = new Error('Offline'); await context.openNewPm();
assert.equal(el('#pm-create').disabled, true); assert.equal(el('#pm-machine-retry').hidden, false);
assert.match(el('#pm-machine-status').textContent, /Offline/);
response = []; await context.retryPmMachines(); assert.match(el('#pm-machine-status').textContent, /No machines/);
response = [{ id: 3, name: '<Press>' }]; await context.retryPmMachines();
assert.equal(el('#pm-create').disabled, false); assert.match(el('#pm-equipment').innerHTML, /&lt;Press>/);
response = new Promise((resolve) => { resolveFirst = resolve; }); const oldPicker = context.retryPmMachines();
response = [{ id: 4, name: 'New machine' }]; await context.retryPmMachines(); resolveFirst([{ id: 5, name: 'Stale' }]); await oldPicker;
assert.match(el('#pm-equipment').innerHTML, /New machine/); assert.doesNotMatch(el('#pm-equipment').innerHTML, /Stale/);
context.selectMachineTab('history');
assert.equal(el('#machine-history-panel').hidden, false); assert.equal(el('#machine-list-panel').hidden, true);
assert.equal(el('#machine-tab-history').attributes['aria-selected'], 'true'); assert.equal(el('#machine-tab-list').tabIndex, -1);
assert.equal(calls.at(-1), 'history:machine');
let prevented = false; context.machineTabKey({ key: 'ArrowLeft', preventDefault() { prevented = true; } });
assert.ok(prevented); assert.equal(focused, '#machine-tab-list'); assert.equal(calls.at(-1), 'equipment');
context.openDueMaintenance(); assert.equal(el('#pm-filter').value, 'due'); assert.equal(el('#pm-days').value, '7'); assert.equal(calls.at(-1), 'pm');
console.log('Combined navigation and maintenance interaction tests passed');
