// Standalone DOM double for the new history tabs: filters, race handling and print.
import assert from 'node:assert/strict';
const elements = new Map(), calls = [];
let pending, failure = false, html = '', printed = false;
function element(id) {
  if (!elements.has(id)) {
    const e = { value: '', hidden: false, disabled: false, options: [], handlers: {}, textContent: '', _html: '',
      get selectedOptions() { return this.options.filter(o => o.selected); },
      get innerHTML() { return this._html; },
      set innerHTML(value) {
        this._html = value;
        if (id.endsWith('-machines') || id === 'extra-parts-parts') this.options = [...value.matchAll(/<option value="([^"]*)"( selected)?>(.*?)<\/option>/g)].map(m => ({ value:m[1], selected:!!m[2], textContent:m[3] }));
      },
      addEventListener(name, fn) { this.handlers[name] = fn; }, setAttribute() {}, focus() {}, closest() { return null; },
    };
    elements.set(id, e);
  }
  return elements.get(id);
}
globalThis.document = { getElementById: element, addEventListener() {}, querySelector() { return { classList: { contains: () => false } }; } };
globalThis.esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
globalThis.emptyRow = (_, text) => `<tr><td>${esc(text)}</td></tr>`;
globalThis.alert = message => { throw Error(message); };
globalThis.window = { addEventListener() {}, loadParts() {}, loadPm() {}, open() { return {document:{open(){},write(value){html=value},close(){}},focus(){},print(){printed=true}}; } };
const rows = [
  {part_id:1,part_name:'<Seal>',work_id:1,equipment_id:1,equipment_name:'Pump',source:'stage',qty:2,cost:4},
  {part_id:2,part_name:'Bearing',work_id:1,equipment_id:1,equipment_name:'Pump',source:'undated',qty:1},
];
globalThis.api = async path => {
  calls.push(path);
  if (failure) throw Error('Offline');
  if (path === '/equipment') return [{id:1,name:'Pump',category:'Pumps'}];
  if (path === '/parts') return [{id:1,name:'Seal'}, {id:2,name:'Bearing'}];
  if (pending) return pending;
  return {rows,total:rows.length,time_zone:'UTC'};
};
await import('../public/extra-history-ui.js');
const ui = window.extraHistoryTabs;
await ui.select('parts','history');
assert.equal(element('extra-parts-list').hidden,true);
assert.equal(element('extra-parts-history').hidden,false);
assert.match(element('extra-parts-rows').innerHTML,/&lt;Seal&gt;/);
assert.equal(element('extra-parts-print').disabled,false);
element('extra-parts-machines').options[0].selected = true;
element('extra-parts-parts').options[0].selected = true;
element('extra-parts-category').value = 'Pumps';
await ui.load('parts');
assert.ok(calls.some(path => path.includes('machines=1') && path.includes('parts=1') && path.includes('category=Pumps')));
const tables = await import('../public/tables.js');
tables.sortBy('extra-parts-rows','part_name');
const click = action => element('extra-parts-history').handlers.click({target:{closest:()=>({dataset:{action}})}});
click('print'); assert.match(html,/&lt;Seal&gt;/); assert.doesNotMatch(html,/<Seal>/);
const screenOrder = [...element('extra-parts-rows').innerHTML.matchAll(/<td>(?:&lt;Seal&gt;|Bearing)<\/td>/g)].map(m=>m[0]);
const printOrder = [...html.matchAll(/<td>(?:&lt;Seal&gt;|Bearing)<\/td>/g)].map(m=>m[0]);
assert.equal(screenOrder.length,2); assert.deepEqual(printOrder,screenOrder);
await new Promise(r=>setTimeout(r,120)); assert.equal(printed,true);
let resolveOld; pending = new Promise(resolve => { resolveOld=resolve; }); const old = ui.load('parts');
pending = null; await ui.load('parts'); resolveOld({rows:[],total:0,time_zone:'UTC'}); await old;
assert.match(element('extra-parts-rows').innerHTML,/Seal/);
failure = true; await ui.load('parts'); assert.equal(element('extra-parts-print').disabled,true); assert.match(element('extra-parts-summary').textContent,/Offline/);
failure = false; await ui.load('parts'); assert.equal(element('extra-parts-print').disabled,false);
element('extra-parts-search').value='changed'; html=''; click('print'); assert.equal(html,'');
await ui.select('pm','history'); assert.equal(ui.isHistory('pm'),true); assert.equal(element('extra-pm-list').hidden,true);
console.log('Maintenance and parts history UI filters, sorting, stale loads, errors and printing passed');
