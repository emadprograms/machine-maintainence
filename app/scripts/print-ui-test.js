// Run the real print page module without a browser dependency. Chromium also
// exercises the actual print-to-PDF layout in the milestone verification.
import assert from 'node:assert/strict';
let root, button, prints, requests, images;
function setup(search, data, status = 200) {
  images = []; prints = 0; requests = [];
  root = { innerHTML: '', querySelectorAll: () => images };
  button = { disabled: true, addEventListener(event, handler) { this[event] = handler; } };
  globalThis.document = { title: '', querySelector: (s) => s === '#print-job' ? root : button,
    createElement: () => ({ className: '', textContent: '' }) };
  globalThis.location = { search };
  globalThis.window = { print: () => { prints++; } };
  globalThis.fetch = async (url) => { requests.push(url); return { ok: status === 200, status, json: async () => data }; };
}
const job = { id: 42, code: 'WO-42', equipment_name: 'Pump <unsafe>', status: 'done', title: 'Broken <seal>',
  priority: 'high', reported_by: 'Alice', assignee_name: 'Tech', created_at: '2026-01-01',
  last_reported_running: 0, notes: '<script>alert(1)</script>', photo: 'picture.png', barcode: '101220054',
  equipment_category: 'Pump', equipment_location: 'Bay', equipment_manufacturer: 'ACME',
  effective_hours: 3, parts_cost_display: 1.01, total_cost: 61.01, resolution: 'Replaced seal', verified_by: 'Inspector' };
const data = { job, rate: 20, parts: [{ name: 'Seal', reference: 'A1', qty: 1, display_cost: 1.01 }],
  updates: [{ id: 10, stage: 1, message: 'Repaired <seal>', hours: 2, author: 'Tech', created_at: '2026-01-02',
    edited_by: 'Admin', edited_at: '2026-01-03', machine_running: 1, photos: [11],
    parts: [{ part_name: 'Seal', qty: 1, unit_price: 1.005 }] }] };
setup('?id=42', data); await import('../public/print-job.js?success');
assert.deepEqual(requests, ['/api/work-orders/42/print']);
for (const text of ['WO-42', 'Pump &lt;unsafe&gt;', 'Broken &lt;seal&gt;', '&lt;script&gt;alert(1)&lt;/script&gt;',
  '101220054', 'Stage 1', 'Repaired &lt;seal&gt;', '1.005', '1.01', '61.01', 'Inspector', 'Replaced seal',
  '/api/work-orders/42/photo?v=picture.png', '/api/work-orders/42/updates/10/photos/11', 'Out of service']) assert.ok(root.innerHTML.includes(text), text);
assert.equal(button.disabled, false); assert.equal(prints, 1); button.click(); assert.equal(prints, 2);
assert.match(document.title, /WO-42/);
setup('?id=42', { job: { ...job, last_reported_running: null, photo: null }, rate: 0, parts: [], updates: [] });
await import('../public/print-job.js?empty');
assert.match(root.innerHTML, /No stages recorded/); assert.match(root.innerHTML, /No parts recorded/);
assert.match(root.innerHTML, /Not reported/); assert.doesNotMatch(root.innerHTML, /Fault photo/);
setup('?id=42', null, 401); await import('../public/print-job.js?unauthorized');
assert.match(root.innerHTML, /Please sign in/); assert.equal(button.disabled, true); assert.equal(prints, 0);
setup('?id=42', null, 404); await import('../public/print-job.js?missing');
assert.match(root.innerHTML, /Could not load/); assert.equal(prints, 0);
setup('?id=not-an-id', data); await import('../public/print-job.js?invalid');
assert.match(root.innerHTML, /Invalid work order/); assert.equal(requests.length, 0);
setup('?id=42', data);
let replacement; images.push({ complete: true, naturalWidth: 0, alt: 'Fault photo', replaceWith: (el) => { replacement = el; } });
await import('../public/print-job.js?missing-photo');
assert.equal(replacement.textContent, 'Fault photo unavailable'); assert.equal(prints, 1);
setup('?id=42', data);
images.push({ complete: false, addEventListener() {} });
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (f) => { queueMicrotask(f); return 0; };
try { await import('../public/print-job.js?timeout'); } finally { globalThis.setTimeout = realSetTimeout; }
assert.match(root.innerHTML, /taking too long/); assert.equal(button.disabled, true); assert.equal(prints, 0);
console.log('Print page interactions passed');
