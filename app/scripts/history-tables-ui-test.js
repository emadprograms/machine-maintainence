// History UI query, stale-load and print-snapshot interactions, without a browser.
import assert from 'node:assert/strict';
const elements = new Map(), calls = [];
let pending, rejectLookup = false, lastPrint = '', printed = false;
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function element(id) {
  if (!elements.has(id)) {
    const e={ value:'', disabled:false, hidden:false, textContent:'', options:[], _html:'',
      get selectedOptions() { return this.options.filter(o=>o.selected); },
      get innerHTML() { return this._html; },
      set innerHTML(html) {
        this._html=html;
        if (id.endsWith('-machines')) this.options=[...html.matchAll(/<option value="([^"]*)"( selected)?>(.*?)<\/option>/g)].map(m=>({value:m[1],selected:!!m[2],textContent:m[3]}));
      },
    }; elements.set(id,e);
  }
  return elements.get(id);
}
globalThis.$ = element; globalThis.esc = esc; globalThis.emptyRow = (_, text) => `<tr>${esc(text)}</tr>`;
globalThis.document = { getElementById() { return null; }, addEventListener() {} };
globalThis.window = { addEventListener(){}, location:'', open() { return { document:{open(){},write(html){lastPrint=html},close(){}},focus(){},print(){printed=true} }; } };
globalThis.alert = (message) => { throw Error(message); };
const rows=[{kind:'work',id:7,equipment_id:1,equipment_name:'Pump',category:'Pumps',title:'<unsafe> job',status:'open',start_day:'2020-01-01',end_day:null,code:'WO-1',hours:1,cost:2}];
globalThis.api = async (path) => {
  calls.push(path);
  if (rejectLookup) throw Error('Offline');
  if (path==='/equipment') return [{id:1,name:'Pump',category:'Pumps'}, {id:2,name:'Press',category:'Machining'}];
  if (pending) return pending;
  return {rows,total:rows.length,time_zone:'UTC'};
};
const ui=await import('../public/history-tables-ui.js');
await ui.loadHistoryTable('work');
assert.match(element('#ht-work-rows').innerHTML,/&lt;unsafe&gt; job/);
assert.equal(element('#ht-work-print').disabled,false);
assert.equal(element('#ht-work-machines').options.length,2);
element('#ht-work-machines').options[0].selected=true;
element('#ht-work-category').value='Pumps';
await ui.loadHistoryTable('work');
assert.match(calls.at(-2),/category=Pumps/); assert.match(calls.at(-2),/machines=1/);
ui.printHistoryTable('work'); assert.match(lastPrint,/&lt;unsafe&gt; job/); assert.doesNotMatch(lastPrint,/<unsafe>/);
await new Promise(r=>setTimeout(r,120)); assert.equal(printed,true);
let resolveOld; pending=new Promise(r=>{resolveOld=r}); const slow=ui.loadHistoryTable('work');
pending=null; await ui.loadHistoryTable('work'); resolveOld({rows:[],total:0,time_zone:'UTC'}); await slow;
assert.match(element('#ht-work-rows').innerHTML,/unsafe/);
rejectLookup=true; await ui.loadHistoryTable('work'); assert.equal(element('#ht-work-print').disabled,true);
assert.match(element('#ht-work-summary').textContent,/Could not load history/);
rejectLookup=false; await ui.loadHistoryTable('work'); assert.equal(element('#ht-work-print').disabled,false);
element('#ht-work-search').value='changed'; lastPrint=''; ui.printHistoryTable('work'); assert.equal(lastPrint,'');
await ui.clearHistoryTable('work'); assert.equal(element('#ht-work-machines').selectedOptions.length,0);
console.log('History table UI filters, stale loads, errors and safe print passed');
