// Fresh authenticated report data; no data are sent outside the workshop.
import { zoneDateTime } from './time-zone.js';
const root = document.querySelector('#print-report'), button = document.querySelector('#print-button');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = v => Number(v || 0).toFixed(2);
const cell = v => `<td>${esc(v ?? '—')}</td>`;
const heading = (title, subtitle) => `<div class="print-head"><div><p class="eyebrow">WORKSHOP REPORT</p><h1>${esc(title)}</h1><p class="print-machine">${esc(subtitle)}</p></div></div>`;
const details = entries => `<dl class="details">${entries.map(([k,v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v ?? 'Not recorded')}</dd></div>`).join('')}</dl>`;
const table = (columns, rows) => `<table><thead><tr>${columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${columns.length}">No records</td></tr>`}</tbody></table>`;
function render(type, r) {
  if (type === 'machine') {
    if (r.cost_basis !== 'parts') throw new Error('Parts-only costs are unavailable. Restart the server after updating.');
    const m = r.machine, stamp = v => v ? `${zoneDateTime(v, r.time_zone) || v} ${r.time_zone}` : '—';
    root.innerHTML = heading('Machine service history', m.name + (r.query ? ` · Filter: ${r.query}` : '')) + `<section><h2>Machine details</h2>${details([['Barcode',m.asset_tag],['Manufacturer',m.manufacturer],['Model',m.model],['Serial number',m.serial_number],['Category',m.category],['Location',m.location],['Current state',m.status]])}</section>` +
      `<section><h2>All-time summary</h2><p>Each work order is one service event; service cost includes recorded parts only.</p>${details([['Work orders',r.total_jobs],['Open',r.counts.open],['In progress',r.counts.in_progress],['Completed',r.counts.done],['Service hours',r.total_hours],['Parts-only service cost',money(r.total_cost)]])}</section>` +
      `<section><h2>Work orders</h2>${table(['Number','Problem','Status','Reported','Hours','Parts cost'], r.jobs.map(j => `<tr>${cell(j.code || `Job ${j.id}`)}${cell(j.title)}${cell(j.status.replace('_',' '))}${cell(stamp(j.created_at))}${cell(j.hours)}${cell(money(j.cost))}</tr>`))}</section>`;
  } else if (type === 'parts') {
    root.innerHTML = heading('Spare-parts inventory', 'Current stock' + (r.query ? ` · Filter: ${r.query}` : '')) + `<section><h2>Inventory summary</h2>${details([['Parts',r.total_parts],['Units',r.total_units],['At or below reorder',r.low_stock],['Known stock value',money(r.known_stock_value)],['Parts without unit price',r.missing_prices]])}<p>Known stock value excludes items with no unit price.</p></section>` +
      `<section><h2>Spare parts</h2>${table(['Part','Reference','Supplier','Stock','Reorder at','Unit price'],r.parts.map(p => `<tr>${cell(p.name)}${cell(p.reference)}${cell(p.supplier)}${cell(p.qty)}${cell(p.reorder_level)}${cell(p.unit_price == null ? 'Not set' : money(p.unit_price))}</tr>`))}</section>`;
  } else {
    if (r.cost_basis !== 'parts') throw new Error('Parts-only costs are unavailable. Restart the server after updating.');
    root.innerHTML = heading('Monthly completed work', r.month) + `<section><h2>Summary</h2><p>Completed work orders closed in the selected month. Service cost includes recorded parts only.</p>${details([['Jobs closed',r.jobs],['Service hours',r.hours],['Parts-only service cost',money(r.total)]])}</section>` +
      `<section><h2>By machine</h2>${table(['Machine','Jobs closed','Hours','Parts cost'],r.machines.map(m => `<tr>${cell(m.name)}${cell(m.jobs)}${cell(m.hours)}${cell(money(m.total))}</tr>`))}</section>`;
  }
}
button.addEventListener('click', () => window.print());
try {
  const q = new URLSearchParams(location.search), type = q.get('type'); let path;
  if (type === 'machine' && /^\d+$/.test(q.get('id') || '') && Number(q.get('id')) > 0) path = `/api/reports/machine/${Number(q.get('id'))}?q=${encodeURIComponent(q.get('q') || '')}`;
  else if (type === 'parts') path = `/api/reports/parts?q=${encodeURIComponent(q.get('q') || '')}`;
  else if (type === 'monthly' && /^\d{4}-\d{2}$/.test(q.get('month') || '')) path = `/api/report?month=${encodeURIComponent(q.get('month'))}`;
  else throw new Error('Choose a valid report in Reports.');
  const response = await fetch(path, { credentials:'same-origin' });
  if (!response.ok) throw new Error(response.status === 401 ? 'Please sign in in the main app, then reload this page.' : 'Could not load this report.');
  render(type, await response.json()); button.disabled = false; window.print();
} catch (e) { root.innerHTML = `<p class="image-error" role="alert">${esc(e.message)}</p>`; }
