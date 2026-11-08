// Exercise the actual work-order UI module with a small DOM and API double.
// This checks interactions, not browser layout; no network or dependencies needed.
import assert from 'node:assert/strict';
const elements = new Map();
const el = (selector) => {
  if (!elements.has(selector)) {
    const element = { value: '', checked: false, disabled: false, hidden: true, files: [], _html: '', _text: '' };
    Object.defineProperty(element, 'textContent', {
      get() { return this._text; },
      set(value) { this._text = String(value); this._html = String(value); },
    });
    Object.defineProperty(element, 'innerHTML', {
      get() { return this._html; },
      set(html) {
        this._html = html;
        this._text = html.replace(/<[^>]*>/g, '');
        if (['#w-equipment', '#w-owner', '#wa-owner', '#wa-part'].includes(selector)) {
          this.value = html.match(/<option value="([^"]*)"/)?.[1] ?? '';
        }
      },
    });
    elements.set(selector, element);
  }
  return elements.get(selector);
};
globalThis.window = { addEventListener() {}, me: { role: 'admin' }, confirm() { return true; } };
let keptPhotos = [];
globalThis.document = { addEventListener() {}, getElementById() { return null; }, querySelectorAll() { return keptPhotos.map((value) => ({ value })); } };
globalThis.$ = el;
globalThis.esc = (v) => String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;');
globalThis.strong = globalThis.soft = globalThis.badge = () => '';
globalThis.emptyRow = () => '';
globalThis.searchTerm = () => '';
globalThis.debounce = (f) => f;
const opened = [], closed = [], errors = [], requests = [], alerts = [];
let stageWarning = false, failHistoryJobs = false, waitHistoryJob = null;
globalThis.openForm = (id) => opened.push(id);
globalThis.formDone = (id) => closed.push(id);
globalThis.closeForm = (id) => closed.push(id);
globalThis.formError = (id, message) => errors.push([id, message]);
globalThis.alert = (message) => { if (!stageWarning) throw new Error(`Unexpected alert: ${message}`); alerts.push(message); };
const people = [{ id: 1, name: 'Admin' }, { id: 2, name: '<Technician>' }];
const spareParts = [{ id: 5, name: '<Motor>', qty: 3, unit_price: 100 }, { id: 6, name: 'Belt', qty: 8, unit_price: 12 }];
let jobs = [{ id: 42, code: 'WO-42', equipment_name: 'Press', equipment_id: 1, title: 'Leak', status: 'open', priority: 'medium', assigned_to: null, current_stage: null, cost_basis: 'parts', cost: 12.5 }];
let updates = [];
let failPeople = false, failMachines = false, noMachines = false, failUpdates = false, noPeople = false, invalidUpdates = false, failParts = false, failState = false;
let machineState = 'active', waitState = null;
let waitPeople = null, waitMachines = null, waitUpdates = null, updateError = null, waitClose = null;
globalThis.api = async (path, options = {}) => {
  requests.push({ path, options });
  if (path === '/equipment?service=active') {
    if (waitMachines) return waitMachines;
    if (failMachines) throw new Error('Machines unavailable');
    return noMachines ? [] : [{ id: 1, name: 'Press', status: 'down' }, { id: 2, name: 'Conveyor', status: 'active' }];
  }
  if (path === '/equipment') {
    if (waitState) return waitState;
    if (failState) throw new Error('State unavailable');
    return [{ id: 1, name: 'Press', status: machineState }];
  }
  if (path === '/parts') {
    if (failParts) throw new Error('Parts unavailable');
    return spareParts;
  }
  if (path === '/users/assignable') {
    if (waitPeople) return waitPeople;
    if (failPeople) throw new Error('Network unavailable');
    return noPeople ? [] : people;
  }
  if (path === '/history?equipment_id=1') return { rows: jobs.map((j) => ({ ...j, owner: 'Admin' })) };
  if (path === '/work-orders?equipment_id=1' && failHistoryJobs) throw new Error('Cannot load jobs');
  if (path === '/work-orders?equipment_id=1' && waitHistoryJob) await waitHistoryJob;
  if (path.startsWith('/work-orders?') || (path === '/work-orders' && !options.method)) return jobs;
  if (path === '/work-orders' && options.method === 'POST') return { id: 99 };
  if (path === '/work-orders/42/updates' && !options.method) {
    if (waitUpdates) return waitUpdates;
    if (failUpdates) throw updateError || new Error('History unavailable');
    if (invalidUpdates) return {};
    return updates;
  }
  if (path === '/work-orders/42/updates' && options.method === 'POST') {
    const body = JSON.parse(options.body);
    updates.push({ id: updates.length + 1, stage: updates.length + 1, message: body.message,
      hours: Number(body.hours), author: 'Admin', created_at: '2026-01-01 12:00:00', photos: [],
      machine_running: body.machine_running == null ? null : Number(body.machine_running),
      parts: (body.parts || []).map((p) => ({ ...p, part_name: spareParts.find((v) => v.id === p.part_id).name })) });
    Object.assign(jobs[0], { status: 'in_progress', current_stage: updates.length, assigned_to: body.assigned_to || jobs[0].assigned_to });
    return { id: updates.length };
  }
  if (/^\/work-orders\/42\/updates\/\d+$/.test(path) && options.method === 'PUT') {
    const stage = updates.find((u) => u.id === Number(path.split('/').at(-1)));
    Object.assign(stage, JSON.parse(options.body));
    return { ok: true, warning: stageWarning ? 'Photo cleanup failed' : null };
  }
  if (/^\/work-orders\/42\/updates\/\d+$/.test(path) && options.method === 'DELETE') {
    const index = updates.findIndex((u) => u.id === Number(path.split('/').at(-1)));
    updates.splice(index, 1); return { ok: true, warning: stageWarning ? 'Photo cleanup failed' : null };
  }
  if (path === '/work-orders/42' && options.method === 'PATCH') {
    if (waitClose && JSON.parse(options.body).status === 'done') await waitClose;
    Object.assign(jobs[0], JSON.parse(options.body));
    return jobs[0];
  }
  throw new Error(`Unexpected request: ${path}`);
};
const work = await import('../public/work.js');
const stageParts = await import('../public/stage-parts.js');
const updateUI = await import('../public/work-updates.js');
// The parts editor consolidates only an identical part and actual price, whether
// the second selection is added explicitly or left pending when Save is pressed.
const originalParts = [{ part_id: 5, qty: 1, unit_price: 1.001, part_name: 'Motor' }, { part_id: 5, qty: 2, unit_price: 1.001, part_name: 'Motor' }];
assert.equal(stageParts.groupStageParts(originalParts)[0].qty, 3);
assert.equal(originalParts[0].qty, 1); // rendering does not rewrite server history
assert.equal(stageParts.formatStagePrice(1.001), '1.001');
assert.equal(stageParts.formatStagePrice(1), '1.00');
stageParts.resetStageParts(); await stageParts.loadStageParts();
stageParts.addStagePart();
assert.match(errors.at(-1)[1], /choose a spare part/i);
el('#wa-part').value = '5'; stageParts.selectStagePart(); el('#wa-part-qty').value = '2'; stageParts.addStagePart();
el('#wa-part').value = '5'; stageParts.selectStagePart(); el('#wa-part-price').value = '100.00'; el('#wa-part-qty').value = '3';
stageParts.updateStagePartsSummary();
assert.equal(el('#wa-parts-summary').textContent, '1 part selected');
assert.deepEqual(stageParts.stagePartsForSave(), [{ part_id: 5, qty: 5, unit_price: 100 }]);
stageParts.addStagePart();
assert.equal((el('#wa-part-list').innerHTML.match(/<tr>/g) || []).length, 1);
assert.match(el('#wa-part-list').innerHTML, /<td>5<\/td>/);
assert.match(el('#wa-part-list').innerHTML, /aria-label="Remove &lt;Motor>"/);
assert.match(el('#wa-part-list').innerHTML, /<circle/);
el('#wa-part').value = '5'; stageParts.selectStagePart(); el('#wa-part-price').value = '100.005';
stageParts.updateStagePartsSummary();
assert.equal(el('#wa-parts-summary').textContent, '2 parts selected');
stageParts.addStagePart();
assert.equal((el('#wa-part-list').innerHTML.match(/<tr>/g) || []).length, 2);
assert.match(el('#wa-part-list').innerHTML, /100\.005/);
assert.deepEqual(stageParts.stagePartsForSave(), [{ part_id: 5, qty: 5, unit_price: 100 }, { part_id: 5, qty: 1, unit_price: 100.005 }]);
stageParts.removeStagePart(1);
assert.deepEqual(stageParts.stagePartsForSave(), [{ part_id: 5, qty: 5, unit_price: 100 }]);
// Existing oversized grouped totals are split into valid API lines on save.
stageParts.setStageParts([{ part_id: 5, qty: 1_000_000, unit_price: 75, part_name: 'Motor' },
  { part_id: 5, qty: 3, unit_price: 75, part_name: 'Motor' }]);
assert.equal((el('#wa-part-list').innerHTML.match(/<tr>/g) || []).length, 1);
assert.deepEqual(stageParts.stagePartsForSave(), [{ part_id: 5, qty: 1_000_000, unit_price: 75 }, { part_id: 5, qty: 3, unit_price: 75 }]);
stageParts.setStageParts(Array.from({ length: 50 }, (_, i) => ({ part_id: 5, qty: 1, unit_price: i, part_name: 'Motor' })));
el('#wa-part').value = '5'; el('#wa-part-price').value = '500';
assert.throws(() => stageParts.stagePartsForSave(), /up to 50/i);
stageParts.addStagePart();
assert.match(errors.at(-1)[1], /up to 50/i);
assert.equal((el('#wa-part-list').innerHTML.match(/<tr>/g) || []).length, 50);
el('#wa-part').value = ''; el('#wa-part-price').value = '';
assert.equal(stageParts.stagePartsForSave().length, 50); // failed add preserved the draft
el('#wa-part').value = '5'; el('#wa-part-price').value = '49'; el('#wa-part-qty').value = '1';
stageParts.addStagePart(); // merging an existing row is still allowed at the limit
assert.equal(stageParts.stagePartsForSave().length, 50);
assert.equal(stageParts.stagePartsForSave().at(-1).qty, 2);
stageParts.resetStageParts();
await work.loadWork();
assert.match(el('#work-rows').innerHTML, /12\.50/);
assert.equal(el('#work-cost-status').hidden, true);
delete jobs[0].cost_basis; await work.loadWork();
assert.doesNotMatch(el('#work-rows').innerHTML, /12\.50/);
assert.match(el('#work-cost-status').textContent, /Restart the server/);
jobs[0].cost_basis = 'parts'; await work.loadWork();
await work.openNewWork();
assert.equal(opened.at(-1), 'work-form');
assert.match(el('#w-owner').innerHTML, /&lt;Technician>/); // names must be escaped
assert.equal(el('#w-owner').disabled, false);
assert.match(el('#w-equipment').innerHTML, /Press/);
assert.match(el('#w-equipment').innerHTML, /Conveyor/);
assert.equal(el('#w-equipment').value, '1');
assert.equal(el('#w-stops').value, '1'); // preselect this machine's reported state
assert.equal(el('#w-create').disabled, false);
el('#w-equipment').value = '2';
work.syncWorkMachineState();
assert.equal(el('#w-stops').value, '0');
el('#w-title').value = '   ';
const beforeBlank = requests.length;
await work.addWorkOrder();
assert.equal(requests.length, beforeBlank);
assert.match(errors.at(-1)[1], /wrong/i);
el('#w-title').value = ' Oil leak ';
el('#w-owner').value = '2';
await work.addWorkOrder();
const created = JSON.parse(requests.findLast((r) => r.path === '/work-orders' && r.options.method === 'POST').options.body);
assert.equal(created.title, 'Oil leak');
assert.equal(created.equipment_id, '2');
assert.equal(created.assigned_to, '2');
assert.equal(closed.at(-1), 'work-form');
await work.openNewWork();
el('#w-title').value = 'Unassigned fault';
el('#w-owner').value = '';
await work.addWorkOrder();
assert.equal(JSON.parse(requests.findLast((r) => r.path === '/work-orders' && r.options.method === 'POST').options.body).assigned_to, null);
// For a freshly open ticket, show the known empty state even while the
// history request is pending; still verify the server before allowing a save.
let releaseEmpty;
waitUpdates = new Promise((resolve) => { releaseEmpty = resolve; });
const emptyLoad = work.advance(42, 'in_progress');
await new Promise((resolve) => setImmediate(resolve));
assert.match(el('#wa-history').textContent, /No updates yet/);
assert.equal(el('#wa-go').disabled, true);
releaseEmpty([]);
await emptyLoad;
waitUpdates = null;
assert.match(el('#wa-history').textContent, /No updates yet/);
assert.equal(el('#wa-load-status').textContent, '');
assert.equal(el('#wa-retry').hidden, true);
assert.equal(el('#wa-go').disabled, false);
assert.equal(opened.at(-1), 'work-assign');
assert.equal(el('#wa-stage-title').textContent, 'Stage 1');
assert.equal(el('#wa-running').checked, true);
assert.equal(el('#wa-running-label').textContent, 'Running');
// A concurrent stage can make the list snapshot stale; the verified response
// replaces the provisional empty state before Save is enabled.
let releaseConcurrent;
waitUpdates = new Promise((resolve) => { releaseConcurrent = resolve; });
const concurrentLoad = work.advance(42, 'in_progress');
await new Promise((resolve) => setImmediate(resolve));
assert.match(el('#wa-history').textContent, /No updates yet/);
assert.equal(el('#wa-go').disabled, true);
releaseConcurrent([{ id: 99, stage: 1, message: 'Added elsewhere', hours: 1, author: 'Admin', created_at: '2026-01-01', photos: [] }]);
await concurrentLoad;
waitUpdates = null;
assert.match(el('#wa-history').textContent, /Added elsewhere/);
assert.equal(el('#wa-stage-title').textContent, 'Stage 2');
await work.advance(42, 'in_progress');
assert.equal(el('#wa-stage-title').textContent, 'Stage 1');
assert.equal(el('#wa-owner-field').hidden, false);
assert.equal(el('#wa-owner').disabled, false);
assert.match(el('#wa-owner').innerHTML, /Admin/);
assert.match(el('#wa-owner').innerHTML, /&lt;Technician>/);
assert.equal(requests.filter((r) => r.options.method === 'POST' && r.path.endsWith('/updates')).length, 0);
el('#wa-message').value = 'Started inspection';
el('#wa-hours').value = '0.5';
el('#wa-owner').value = '';
await work.startAssigned();
assert.match(errors.at(-1)[1], /choose/i);
el('#wa-owner').value = '2';
assert.match(el('#wa-part').innerHTML, /&lt;Motor>/);
el('#wa-part').value = '5';
stageParts.selectStagePart();
assert.equal(el('#wa-part-price').value, '100');
el('#wa-part-price').value = '75';
stageParts.addStagePart();
assert.match(el('#wa-part-list').innerHTML, /&lt;Motor>/);
el('#wa-part').value = '6';
stageParts.selectStagePart();
el('#wa-part-qty').value = '2';
el('#wa-running').checked = false;
updateUI.stageToggleChanged();
await work.startAssigned();
const stage1 = JSON.parse(requests.findLast((r) => r.path.endsWith('/updates') && r.options.method === 'POST').options.body);
assert.deepEqual(stage1, { message: 'Started inspection', hours: '0.5', photos: [], assigned_to: 2, machine_running: false,
  parts: [{ part_id: 5, qty: 1, unit_price: 75 }, { part_id: 6, qty: 2, unit_price: 12 }] });
assert.equal(closed.at(-1), 'work-assign');
await work.openWorkUpdates(42);
assert.equal(el('#wa-stage-title').textContent, 'Stage 2');
assert.match(el('#wa-history').innerHTML, /Started inspection/);
assert.match(el('#wa-history').innerHTML, /&lt;Motor>/);
assert.match(el('#wa-history').innerHTML, /out of service/);
el('#wa-message').value = 'Replaced bearing';
el('#wa-hours').value = '1.25';
await work.startAssigned();
assert.equal(updates.length, 2);
assert.equal(jobs[0].status, 'in_progress');
await work.openWorkUpdates(42, true);
assert.equal(el('#wa-entry').hidden, true);
assert.match(el('#wa-history').innerHTML, /Replaced bearing/);
// A preassigned open job still shows its assignee and can be reassigned on start.
jobs[0].status = 'open';
jobs[0].assigned_to = 1;
await work.loadWork();
await work.advance(42, 'in_progress');
assert.equal(el('#wa-owner-field').hidden, false);
assert.equal(el('#wa-owner').value, '1');
assert.match(el('#wa-owner').innerHTML, /&lt;Technician>/);
el('#wa-owner').value = '2';
el('#wa-message').value = 'Reassigned and restarted';
el('#wa-hours').value = '0.25';
await work.startAssigned();
assert.equal(jobs[0].assigned_to, 2);
assert.equal(JSON.parse(requests.findLast((r) => r.path.endsWith('/updates') && r.options.method === 'POST').options.body).assigned_to, 2);

// An unavailable list must not pretend the user lacks permission or start a job.
jobs[0].assigned_to = null;
jobs[0].status = 'open';
await work.loadWork();
failPeople = true;
await work.advance(42, 'in_progress');
assert.equal(el('#wa-go').disabled, true);
assert.match(el('#wa-load-status').textContent, /could not load people.*network unavailable/i);
assert.equal(el('#wa-owner').disabled, true);
assert.equal(el('#wa-retry').hidden, false);
el('#wa-message').value = 'Keep my draft';
failPeople = false;
await work.retryWorkUpdateLoading();
assert.equal(el('#wa-owner').disabled, false);
assert.equal(el('#wa-go').disabled, false);
assert.equal(el('#wa-message').value, 'Keep my draft');
assert.equal(el('#wa-retry').hidden, true);
// History failures and slow history must not leave the people picker blank.
failUpdates = true;
await work.advance(42, 'in_progress');
assert.equal(el('#wa-owner').disabled, false);
assert.match(el('#wa-owner').innerHTML, /Admin/);
assert.equal(el('#wa-go').disabled, true);
assert.match(el('#wa-load-status').textContent, /could not load updates.*history unavailable/i);
assert.doesNotMatch(el('#wa-history').textContent, /No updates yet/); // a failure is not an empty result
assert.equal(el('#wa-retry').hidden, false);
el('#wa-owner').value = '2';
failUpdates = false;
await work.retryWorkUpdateLoading();
assert.equal(el('#wa-go').disabled, false);
assert.equal(el('#wa-owner').value, '2');
// A stale server can serve new HTML but not yet know the updates route. A plain
// 404 means restart, unlike the API's JSON 404 for a genuinely deleted ticket.
updateError = Object.assign(new Error('Request failed'), { status: 404, nonJson: true });
failUpdates = true;
await work.advance(42, 'in_progress');
assert.match(el('#wa-load-status').textContent, /restart the app after updating/i);
assert.equal(el('#wa-go').disabled, true);
assert.doesNotMatch(el('#wa-history').textContent, /No updates yet/);
updateError = Object.assign(new Error('Work order not found'), { status: 404, nonJson: false });
await work.retryWorkUpdateLoading();
assert.match(el('#wa-load-status').textContent, /work order not found/i);
assert.doesNotMatch(el('#wa-load-status').textContent, /restart/i);
failUpdates = false;
updateError = null;
invalidUpdates = true;
await work.retryWorkUpdateLoading();
assert.match(el('#wa-load-status').textContent, /invalid updates list/i);
assert.equal(el('#wa-go').disabled, true);
invalidUpdates = false;
await work.retryWorkUpdateLoading();
assert.equal(el('#wa-go').disabled, false);
noPeople = true;
await work.advance(42, 'in_progress');
assert.equal(el('#wa-owner').disabled, true);
assert.equal(el('#wa-go').disabled, true);
assert.match(el('#wa-load-status').textContent, /no accounts/i);
noPeople = false;
await work.retryWorkUpdateLoading();
assert.equal(el('#wa-owner').disabled, false);
let releaseUpdates;
waitUpdates = new Promise((resolve) => { releaseUpdates = resolve; });
const pendingUpdate = work.advance(42, 'in_progress');
await new Promise((resolve) => setImmediate(resolve));
assert.equal(el('#wa-owner').disabled, false);
assert.match(el('#wa-owner').innerHTML, /Admin/);
assert.equal(el('#wa-go').disabled, true);
el('#wa-message').value = 'Cannot save while loading';
el('#wa-hours').value = '1';
el('#wa-owner').value = '2';
const beforePendingSave = requests.filter((r) => r.path.endsWith('/updates') && r.options.method === 'POST').length;
await work.startAssigned();
assert.equal(requests.filter((r) => r.path.endsWith('/updates') && r.options.method === 'POST').length, beforePendingSave);
releaseUpdates(updates);
await pendingUpdate;
waitUpdates = null;
assert.equal(el('#wa-go').disabled, false);
// A late failure from an earlier retry cannot replace a successful newer load.
let rejectOldUpdates;
waitUpdates = new Promise((resolve, reject) => { rejectOldUpdates = reject; });
const oldUpdate = work.retryWorkUpdateLoading();
waitUpdates = null;
await work.retryWorkUpdateLoading();
rejectOldUpdates(new Error('Stale failure'));
await oldUpdate;
assert.equal(el('#wa-go').disabled, false);
assert.doesNotMatch(el('#wa-load-status').textContent, /stale failure/i);
let releaseOldPeople;
waitPeople = new Promise((resolve) => { releaseOldPeople = resolve; });
const oldPeople = work.retryWorkUpdateLoading();
waitPeople = null;
await work.retryWorkUpdateLoading();
releaseOldPeople([{ id: 99, name: 'Stale person' }]);
await oldPeople;
assert.match(el('#wa-owner').innerHTML, /Admin/);
assert.doesNotMatch(el('#wa-owner').innerHTML, /Stale person/);
// A failed optional parts lookup doesn't block an update or lose the draft.
failParts = true;
await work.advance(42, 'in_progress');
await new Promise((resolve) => setImmediate(resolve));
assert.match(el('#wa-part-status').textContent, /parts unavailable/i);
assert.equal(el('#wa-part-retry').hidden, false);
assert.equal(el('#wa-go').disabled, false);
el('#wa-message').value = 'Can save without spare parts';
el('#wa-hours').value = '1';
el('#wa-owner').value = '1';
await work.startAssigned();
assert.equal(JSON.parse(requests.findLast((r) => r.path.endsWith('/updates') && r.options.method === 'POST').options.body).parts, undefined);
await work.openWorkUpdates(42);
await new Promise((resolve) => setImmediate(resolve));
el('#wa-message').value = 'Keep my parts draft';
failParts = false;
await stageParts.loadStageParts();
assert.equal(el('#wa-message').value, 'Keep my parts draft');
assert.equal(el('#wa-part-retry').hidden, true);
el('#wa-part').value = '5';
stageParts.selectStagePart();
el('#wa-part-price').value = '';
const beforeNoPrice = requests.filter((r) => r.path.endsWith('/updates') && r.options.method === 'POST').length;
el('#wa-hours').value = '1';
el('#wa-owner').value = '1';
await work.startAssigned();
assert.match(errors.at(-1)[1], /unit cost/i);
assert.equal(requests.filter((r) => r.path.endsWith('/updates') && r.options.method === 'POST').length, beforeNoPrice);
failPeople = true;
await work.openNewWork();
assert.equal(el('#w-create').disabled, false);
assert.equal(el('#w-owner').disabled, true);
assert.match(errors.at(-1)[1], /create it unassigned/i);
failPeople = false;
failMachines = true;
await work.openNewWork();
assert.equal(el('#w-create').disabled, true);
assert.match(el('#w-machine-status').textContent, /machines unavailable/i);
assert.equal(el('#w-machine-retry').hidden, false);
// Retry in the same dialog, without navigating to Machines first.
failMachines = false;
await work.retryWorkMachines();
assert.equal(el('#w-equipment').disabled, false);
assert.equal(el('#w-machine-retry').hidden, true);
assert.match(el('#w-equipment').innerHTML, /Conveyor/);
noMachines = true;
await work.openNewWork();
assert.equal(el('#w-create').disabled, true);
assert.match(el('#w-machine-status').textContent, /no machines in service/i);
assert.equal(el('#w-machine-retry').hidden, false);
noMachines = false;
await work.retryWorkMachines();
assert.equal(el('#w-create').disabled, false);
// A slow people endpoint must not block the machine selector or creation.
let releasePeople;
waitPeople = new Promise((resolve) => { releasePeople = resolve; });
const pending = work.openNewWork();
await new Promise((resolve) => setImmediate(resolve));
assert.equal(el('#w-equipment').disabled, false);
assert.equal(el('#w-create').disabled, false);
assert.equal(el('#w-owner').disabled, true);
assert.equal(el('#w-equipment').value, '1');
releasePeople(people);
await pending;
waitPeople = null;
// A late machine response from an old dialog must not overwrite the new one.
let releaseOldMachines;
waitMachines = new Promise((resolve) => { releaseOldMachines = resolve; });
const oldForm = work.openNewWork();
waitMachines = null;
await work.openNewWork();
el('#w-equipment').value = '2';
releaseOldMachines([{ id: 9, name: 'Stale' }]);
await oldForm;
assert.equal(el('#w-equipment').value, '2');
assert.doesNotMatch(el('#w-equipment').innerHTML, /Stale/);
// Saving unrelated work-order edits must not silently create a new state report.
jobs[0].stops_machine = 1;
await work.loadWork();
assert.doesNotMatch(el('#work-rows').innerHTML, /editWork\(42\)/);
assert.match(el('#work-rows').innerHTML, /printWork\(42\)/);
const openedBeforeLockedEdit = opened.length;
work.editWork(42);
assert.equal(opened.length, openedBeforeLockedEdit);
const previousStage = jobs[0].current_stage;
jobs[0].current_stage = null;
await work.loadWork();
assert.match(el('#work-rows').innerHTML, /editWork\(42\)/);
work.editWork(42);
await work.saveWork();
let workPatch = JSON.parse(requests.findLast((r) => r.path === '/work-orders/42' && r.options.method === 'PATCH').options.body);
assert.equal('stops_machine' in workPatch, false);
work.editWork(42);
el('#we-stops').value = '0';
await work.saveWork();
workPatch = JSON.parse(requests.findLast((r) => r.path === '/work-orders/42' && r.options.method === 'PATCH').options.body);
assert.equal(workPatch.stops_machine, false);
jobs[0].current_stage = previousStage;
await work.loadWork();

// Machine state loads independently, defaults to the latest report, and a
// failed lookup never enables a save with a guessed state.
machineState = 'down';
let releaseState;
waitState = new Promise((resolve) => { releaseState = resolve; });
const loadingState = work.openWorkUpdates(42);
await new Promise((resolve) => setImmediate(resolve));
assert.equal(el('#wa-go').disabled, true);
assert.equal(el('#wa-running').disabled, true);
assert.equal(el('#wa-running-label').textContent, 'Loading…');
releaseState([{ id: 1, name: 'Press', status: 'down' }]);
await loadingState;
waitState = null;
assert.equal(el('#wa-running').checked, false);
await work.openWorkUpdates(42);
assert.equal(el('#wa-running').checked, false);
assert.equal(el('#wa-running-label').textContent, 'Out of service');
el('#wa-running').checked = true;
updateUI.stageToggleChanged();
await work.retryWorkUpdateLoading();
assert.equal(el('#wa-running').checked, true); // retry keeps the user's choice
failState = true;
await work.openWorkUpdates(42);
assert.equal(el('#wa-go').disabled, true);
assert.match(el('#wa-load-status').textContent, /state unavailable/i);
assert.equal(el('#wa-running-label').textContent, 'Unavailable');
failState = false;
await work.retryWorkUpdateLoading();
assert.equal(el('#wa-go').disabled, false);
assert.equal(el('#wa-running').checked, false);
// Only admins see the latest-stage edit action; drafts keep original parts.
updates = [{ id: 51, stage: 1, message: 'First', hours: 1, author: 'Admin', created_at: '2026-01-01', photos: [], parts: [] },
  { id: 52, stage: 2, message: 'Latest', hours: 2, author: 'Admin', created_at: '2026-01-01', photos: [3], machine_running: 0,
    parts: [{ part_id: 5, part_name: '<Motor>', qty: 2, unit_price: 75 }] }];
// History is compact during entry but opens for the read-only timeline. A
// selected spare part is still a draft worth protecting before editing history.
await work.openWorkUpdates(42);
assert.equal(el('#wa-history-panel').open, false);
assert.equal(el('#wa-parts-panel').open, false);
assert.equal(el('#wa-photos-panel').open, false);
assert.equal(el('#wa-history-count').textContent, '2 updates');
el('#wa-part').value = '5'; stageParts.selectStagePart();
assert.equal(el('#wa-parts-summary').textContent, '1 part selected');
let draftConfirmations = 0;
window.confirm = () => { draftConfirmations++; return false; };
updateUI.editLatestStage(52);
assert.equal(el('#wa-delete').hidden, true);
assert.equal(el('#wa-part').value, '5');
el('#wa-part').value = ''; el('#wa-part-price').value = '';
el('#wa-photos').files = [{ name: 'draft.png', size: 1 }];
updateUI.editLatestStage(52);
assert.equal(draftConfirmations, 2); // a photo alone is also an unsaved draft
el('#wa-photos').files = [];
el('#wa-owner-field').hidden = false; el('#wa-owner').value = '987';
updateUI.editLatestStage(52);
assert.equal(draftConfirmations, 3); // an assignee change is a draft
el('#wa-owner-field').hidden = true;
el('#wa-running').checked = true; updateUI.stageToggleChanged();
updateUI.editLatestStage(52);
assert.equal(draftConfirmations, 4); // a changed machine state is protected too
window.confirm = () => true;
await work.openWorkUpdates(42);
el('#wa-part').value = '6'; stageParts.selectStagePart();
updateUI.editLatestStage(52); // discarded new-stage part must never enter the correction
assert.equal(el('#wa-part').value, '');
assert.equal(el('#wa-part-price').value, '');
assert.match(el('#wa-part-list').innerHTML, /&lt;Motor>/);
await work.openWorkUpdates(42);
el('#wa-message').value = 'Draft'; el('#wa-hours').value = '1'; el('#wa-owner').value = '1';
el('#wa-part').value = '5'; el('#wa-part-price').value = '';
el('#wa-parts-panel').open = false;
await updateUI.startAssigned();
assert.equal(el('#wa-parts-panel').open, true);
assert.match(errors.at(-1)[1], /unit cost/i);
jobs[0].notes = 'Observed <damage>'; jobs[0].reported_by = 'Alice'; jobs[0].photo = 'fault.png'; jobs[0].created_at = '2026-01-01';
await work.loadWork();
await work.openWorkUpdates(42, true);
assert.equal(el('#wa-cancel').textContent, 'Close');
assert.equal(el('#wa-history-panel').open, true);
assert.match(el('#wa-history').innerHTML, /editLatestStage\(52\)/);
assert.match(el('#wa-history').innerHTML, /aria-label="Edit latest stage"/);
assert.match(el('#wa-history').innerHTML, /previewStagePhoto\(52, 3, 1\)/);
assert.match(el('#wa-history').innerHTML, /Observed &lt;damage>/);
assert.match(el('#wa-history').innerHTML, /Reported by Alice/);
assert.match(el('#wa-history').innerHTML, /previewFaultPhoto\(\)/);
assert.match(el('#wa-history').innerHTML, /<img[^>]*src="\/api\/work-orders\/42\/updates\/52\/photos\/3"/);
assert.match(el('#wa-history').innerHTML, /stage-edit-action[\s\S]*<svg/);
assert.ok(el('#wa-history').innerHTML.indexOf('Problem reported') < el('#wa-history').innerHTML.indexOf('Stage 1'));
assert.ok(el('#wa-history').innerHTML.indexOf('Stage 1') < el('#wa-history').innerHTML.indexOf('Stage 2'));
assert.doesNotMatch(el('#wa-history').innerHTML, /editLatestStage\(51\)/);
updateUI.editLatestStage(51);
assert.equal(el('#wa-entry').hidden, true);
updateUI.editLatestStage(52);
assert.equal(el('#wa-entry').hidden, false);
assert.equal(el('#wa-message').value, 'Latest');
assert.equal(el('#wa-hours').value, '2');
assert.match(el('#wa-part-list').innerHTML, /&lt;Motor>/);
assert.match(el('#wa-existing-photos').innerHTML, /photo 1/i);
assert.equal(el('#wa-running').checked, false);
assert.equal(el('#wa-delete').hidden, false);
assert.equal(el('#wa-history-panel').open, false);
assert.equal(el('#wa-parts-panel').open, true);
assert.equal(el('#wa-photos-panel').open, true);
keptPhotos = ['3'];
updateUI.stagePhotoSelectionChanged();
assert.equal(el('#wa-photos-summary').textContent, '1 photo selected');
el('#wa-photos').files = Array.from({ length: 5 }, (_, i) => ({ name: `photo${i}.png`, size: 1 }));
el('#wa-photos-panel').open = false;
await updateUI.startAssigned();
assert.equal(el('#wa-photos-panel').open, true);
assert.match(errors.at(-1)[1], /five photos/i);
el('#wa-photos').files = [];
el('#wa-hours').value = '3';
stageWarning = true;
await updateUI.startAssigned();
assert.equal(alerts.at(-1), 'Photo cleanup failed');
const edited = JSON.parse(requests.findLast((r) => r.options.method === 'PUT' && r.path.endsWith('/updates/52')).options.body);
assert.equal(edited.hours, '3');
assert.deepEqual(edited.keep_photos, [3]);
assert.deepEqual(edited.parts, [{ part_id: 5, qty: 2, unit_price: 75 }]);
assert.equal(edited.machine_running, false);
await work.openWorkUpdates(42, true);
updateUI.editLatestStage(52);
await updateUI.deleteLatestStage();
assert.equal(alerts.filter((a) => a === 'Photo cleanup failed').length, 2);
stageWarning = false;
assert.equal(requests.findLast((r) => r.options.method === 'DELETE').path, '/work-orders/42/updates/52');
assert.equal(updates.length, 1);
window.me.role = 'tech';
await work.openWorkUpdates(42, true);
assert.doesNotMatch(el('#wa-history').innerHTML, /editLatestStage/);
updateUI.editLatestStage(51);
assert.equal(el('#wa-entry').hidden, true);
window.me.role = 'admin';
keptPhotos = [];

// The in-progress action menu is ordered and every action carries an icon.
jobs[0].status = 'in_progress'; jobs[0].current_stage = 1;
await work.loadWork();
const menuMarkup = el('#work-rows').innerHTML;
const actionNames = ['View updates', 'Add update', 'Print job', 'Close job'];
assert.deepEqual(actionNames.map((name) => menuMarkup.indexOf(name)).sort((a, b) => a - b), actionNames.map((name) => menuMarkup.indexOf(name)));
assert.ok(actionNames.every((name) => menuMarkup.includes(name)));
assert.equal((menuMarkup.match(/class="menu-icon"/g) || []).length, 4);
// Closure initializes from the current state, not the possibly stale row.
await work.loadWork();
machineState = 'active'; await work.openWorkClose(42);
assert.equal(el('#wc-running').checked, true);
assert.equal(el('#wc-running-label').textContent, 'Running');
assert.equal(el('#wc-go').disabled, false); assert.equal(el('#wc-disabled-tip').hidden, true);
failState = true; await work.openWorkClose(42);
assert.equal(el('#wc-go').disabled, true); assert.equal(el('#wc-retry').hidden, false);
assert.match(el('#wc-current').textContent, /state unavailable/i);
failState = false; machineState = 'retired'; await work.retryCloseState();
assert.equal(el('#wc-go').disabled, true); assert.match(el('#wc-current').textContent, /retired/i);
// Closure never collects stage hours or parts, and requires a running answer.
await work.loadWork();
machineState = 'down';
await work.openWorkClose(42);
assert.equal(el('#wc-running').checked, false);
assert.equal(el('#wc-running-label').textContent, 'Out of service');
assert.equal(el('#wc-go').disabled, true); assert.equal(el('#wc-disabled-tip').hidden, false);
assert.equal(el('#wc-action').tabIndex, 0);
const count = requests.length;
await work.confirmCloseWork();
assert.equal(requests.length, count);
el('#wc-running').checked = true; work.closeToggleChanged();
assert.equal(el('#wc-running-label').textContent, 'Running');
assert.equal(el('#wc-go').disabled, false); assert.equal(el('#wc-disabled-tip').hidden, true);
assert.equal(el('#wc-action').tabIndex, -1);
el('#wc-running').checked = false; work.closeToggleChanged();
assert.equal(el('#wc-go').disabled, true);
el('#wc-running').checked = true; work.closeToggleChanged();
el('#wc-resolution').value = '';
let releaseClose; waitClose = new Promise((resolve) => { releaseClose = resolve; });
const savingClose = work.confirmCloseWork();
assert.equal(el('#wc-go').disabled, true); assert.equal(el('#wc-running').disabled, true);
work.closeToggleChanged(); assert.equal(el('#wc-go').disabled, true);
releaseClose(); await savingClose; waitClose = null;
const closeRequest = requests.findLast((r) => r.options.method === 'PATCH');
assert.deepEqual(JSON.parse(closeRequest.options.body), { status: 'done', machine_running: true, resolution: null });
jobs[0].closed_at = '2026-01-02'; await work.loadWork(); await work.openWorkUpdates(42, true);
assert.ok(el('#wa-history').innerHTML.indexOf('Job closed') > el('#wa-history').innerHTML.indexOf('Stage 1'));
// Machine history works independently of the Work orders filter and opens the timeline.
const history = await import('../public/history.js');
const clicked = { closest: () => ({ querySelector: () => ({ textContent: 'Press' }) }) };
await history.openMachineHistory(1, clicked);
assert.match(el('#machine-history-rows').innerHTML, /WO-42/);
assert.match(el('#machine-history-rows').innerHTML, /openMachineHistoryJob\(42\)/);
assert.match(el('#machine-history-rows').innerHTML, /aria-label="View timeline for WO-42"/);
failHistoryJobs = true; await history.openMachineHistoryJob(42);
assert.match(el('#machine-history-error').textContent, /Could not open this timeline/);
assert.equal(el('#machine-history-error').hidden, false);
failHistoryJobs = false; await history.openMachineHistoryJob(42);
assert.equal(opened.at(-1), 'work-assign');
assert.match(el('#wa-history').innerHTML, /Problem reported/);
assert.ok(requests.some((r) => r.path === '/work-orders?equipment_id=1'));
let releaseHistory; waitHistoryJob = new Promise((resolve) => { releaseHistory = resolve; });
const pendingTimeline = history.openMachineHistoryJob(42); const countOpened = opened.length;
history.closeMachineHistory(); releaseHistory(); await pendingTimeline; waitHistoryJob = null;
assert.equal(opened.length, countOpened); // a closed history cannot open a late timeline

console.log('Work-order UI interaction tests passed');
