// Exercise the actual work-order UI module with a small DOM and API double.
// This checks interactions, not browser layout; no network or dependencies needed.
import assert from 'node:assert/strict';
const elements = new Map();
const el = (selector) => {
  if (!elements.has(selector)) {
    const element = { value: '', textContent: '', disabled: false, hidden: true, files: [], _html: '' };
    Object.defineProperty(element, 'innerHTML', {
      get() { return this._html; },
      set(html) {
        this._html = html;
        if (['#w-equipment', '#w-owner', '#wa-owner'].includes(selector)) {
          this.value = html.match(/<option value="([^"]*)"/)?.[1] ?? '';
        }
      },
    });
    elements.set(selector, element);
  }
  return elements.get(selector);
};
globalThis.window = { addEventListener() {} };
globalThis.document = { addEventListener() {}, getElementById() { return null; } };
globalThis.$ = el;
globalThis.esc = (v) => String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;');
globalThis.strong = globalThis.soft = globalThis.badge = () => '';
globalThis.emptyRow = () => '';
globalThis.searchTerm = () => '';
globalThis.debounce = (f) => f;
const opened = [], closed = [], errors = [], requests = [];
globalThis.openForm = (id) => opened.push(id);
globalThis.formDone = (id) => closed.push(id);
globalThis.formError = (id, message) => errors.push([id, message]);
globalThis.alert = (message) => { throw new Error(`Unexpected alert: ${message}`); };
const people = [{ id: 1, name: 'Admin' }, { id: 2, name: '<Technician>' }];
let jobs = [{ id: 42, code: 'WO-42', equipment_name: 'Press', title: 'Leak', status: 'open', priority: 'medium', assigned_to: null }];
let updates = [];
let failPeople = false, failMachines = false, noMachines = false, failUpdates = false, noPeople = false;
let waitPeople = null, waitMachines = null, waitUpdates = null;
globalThis.api = async (path, options = {}) => {
  requests.push({ path, options });
  if (path === '/equipment?service=active') {
    if (waitMachines) return waitMachines;
    if (failMachines) throw new Error('Machines unavailable');
    return noMachines ? [] : [{ id: 1, name: 'Press' }, { id: 2, name: 'Conveyor' }];
  }
  if (path === '/users/assignable') {
    if (waitPeople) return waitPeople;
    if (failPeople) throw new Error('Network unavailable');
    return noPeople ? [] : people;
  }
  if (path.startsWith('/work-orders?') || (path === '/work-orders' && !options.method)) return jobs;
  if (path === '/work-orders' && options.method === 'POST') return { id: 99 };
  if (path === '/work-orders/42/updates' && !options.method) {
    if (waitUpdates) return waitUpdates;
    if (failUpdates) throw new Error('History unavailable');
    return updates;
  }
  if (path === '/work-orders/42/updates' && options.method === 'POST') {
    const body = JSON.parse(options.body);
    updates.push({ id: updates.length + 1, stage: updates.length + 1, message: body.message,
      hours: Number(body.hours), author: 'Admin', created_at: '2026-01-01 12:00:00', photos: [] });
    Object.assign(jobs[0], { status: 'in_progress', assigned_to: body.assigned_to || jobs[0].assigned_to });
    return { id: updates.length };
  }
  if (path === '/work-orders/42' && options.method === 'PATCH') {
    Object.assign(jobs[0], JSON.parse(options.body));
    return jobs[0];
  }
  throw new Error(`Unexpected request: ${path}`);
};
const work = await import('../public/work.js');
await work.loadWork();
await work.openNewWork();
assert.equal(opened.at(-1), 'work-form');
assert.match(el('#w-owner').innerHTML, /&lt;Technician>/); // names must be escaped
assert.equal(el('#w-owner').disabled, false);
assert.match(el('#w-equipment').innerHTML, /Press/);
assert.match(el('#w-equipment').innerHTML, /Conveyor/);
assert.equal(el('#w-equipment').value, '1');
assert.equal(el('#w-create').disabled, false);
el('#w-equipment').value = '2';
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
await work.advance(42, 'in_progress');
assert.equal(opened.at(-1), 'work-assign');
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
await work.startAssigned();
const stage1 = JSON.parse(requests.findLast((r) => r.path.endsWith('/updates') && r.options.method === 'POST').options.body);
assert.deepEqual(stage1, { message: 'Started inspection', hours: '0.5', photos: [], assigned_to: 2 });
assert.equal(closed.at(-1), 'work-assign');
await work.openWorkUpdates(42);
assert.equal(el('#wa-stage-title').textContent, 'Stage 2');
assert.match(el('#wa-history').innerHTML, /Started inspection/);
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
assert.equal(el('#wa-retry').hidden, false);
el('#wa-owner').value = '2';
failUpdates = false;
await work.retryWorkUpdateLoading();
assert.equal(el('#wa-go').disabled, false);
assert.equal(el('#wa-owner').value, '2');
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
console.log('Work-order UI interaction tests passed');
