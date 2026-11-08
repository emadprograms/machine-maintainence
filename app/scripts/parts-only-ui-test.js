// Browser-free coverage of report/dashboard cost presentation and old-server guards.
import assert from 'node:assert/strict';
globalThis.window = { addEventListener() {} };
globalThis.document = { addEventListener() {}, getElementById() { return null; } };
const fields = new Map();
globalThis.$ = (selector) => {
  if (!fields.has(selector)) fields.set(selector, { value: '', textContent: '', innerHTML: '' });
  return fields.get(selector);
};
globalThis.strong = (v) => `<td>${v}</td>`;
globalThis.emptyRow = () => '';
globalThis.esc = (v) => String(v);
let payload = { month: '2026-11', cost_basis: 'parts', jobs: 1, hours: 10,
  parts_cost: 12.5, total: 12.5, machines: [{ name: 'Pump', jobs: 1, hours: 10, total: 12.5 }] };
globalThis.api = async () => payload;
let warning = '';
globalThis.alert = (s) => { warning = s; };
$('#report-month').value = '2026-11';
const report = await import('../public/report.js');
await report.loadReport();
assert.match($('#report-summary').textContent, /12\.50/);
assert.match($('#report-rows').innerHTML, /12\.50/);
assert.doesNotMatch($('#report-summary').textContent + $('#report-rows').innerHTML, /labour|hourly/i);
report.downloadReport(); assert.match(window.location, /2026-11/);
payload = { ...payload, cost_basis: undefined, total: 999, labour_cost: 986.5 };
await report.loadReport();
assert.match($('#report-rows').innerHTML, /Restart the server/);
window.location = ''; report.downloadReport();
assert.equal(window.location, ''); assert.match(warning, /unavailable/i);
const { renderDashboard } = await import('../public/dashboard.js');
const root = { innerHTML: '', querySelectorAll() { return []; } };
const chart = { charts: { trend: [{ label: 'Nov', closed: 1, parts_cost: 12.5, total: 12.5, cost_basis: 'parts' }] } };
renderDashboard(root, chart);
assert.match(root.innerHTML, /parts only/); assert.doesNotMatch(root.innerHTML, /labour|hourly/i);
chart.charts.trend[0] = { label: 'Nov', closed: 1, parts_cost: 12.5, labour_cost: 999, total: 1011.5 };
renderDashboard(root, chart);
assert.match(root.innerHTML, /Parts-only costs are unavailable/); assert.doesNotMatch(root.innerHTML, /1011\.5|999/);
console.log('Parts-only report and dashboard UI tests passed');
