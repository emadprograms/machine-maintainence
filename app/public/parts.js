// The spare parts screen: the shelf, what it costs, and what needs ordering.
//
// Its own file since app.js crossed the 600-line split signal for the third time —
// and because this screen is now the same shape as the others: a filter, a sortable
// table, a row menu and an editing dialog. It uses the helpers app.js already defines
// (esc, strong, soft, badge, emptyRow, api, $, searchTerm, debounce, openForm,
// formError, formDone) rather than repeating them.

import { register, rowsFor, markTable, rowMenu, menuItem } from './tables.js';

// The list as last loaded. Editing reads the whole record from here rather than
// asking for it again — the row that drew the button already has it.
let partsCache = [];

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

export const searchParts = debounce(() => loadParts());

/** The parts filter and its search box, as a query string. The screen and the CSV
 *  download both call this, so the file cannot disagree with the table. */
function partQuery() {
  const params = new URLSearchParams();
  const filter = $('#part-filter')?.value || 'all';
  if (filter === 'low' || filter === 'out') params.set(filter, '1');
  const q = searchTerm('#part-search');
  if (q) params.set('q', q);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function loadParts() {
  partsCache = await api(`/parts${partQuery()}`);
  drawParts();
}

/** The table, drawn from `partsCache`, in whatever order a heading has asked for. */
function drawParts() {
  const filter = $('#part-filter')?.value || 'all';
  const searched = searchTerm('#part-search');
  const rows = rowsFor('parts-rows', partsCache);
  $('#parts-rows').innerHTML = rows.map((p) => `<tr>
        ${strong(p.name)}${soft(p.reference)}
        ${stockCell(p)}
        <td class="cell-num cell-muted">${p.unit_price == null ? 'Not set' : esc(money(p.unit_price))}</td>
        <td class="cell-num cell-muted">${esc(p.reorder_level)}</td>
        ${rowMenu(p.name, [
          menuItem('Edit part', `editPart(${p.id})`),
          menuItem('Delete part', `removePart(${p.id})`, { danger: true }),
        ])}
      </tr>`).join('')
    || emptyRow(6, searched
      ? `Nothing matches "${searched}". Clear the search to see the rest.`
      : filter === 'out'
        ? 'Nothing is out of stock.'
        : filter === 'low'
          ? 'Every part is above its reorder level. Nothing to order.'
          : 'No spare parts yet. Add the ones you keep on the shelf.');
  markTable('parts-rows');
}

register('parts-rows', {
  name: (p) => p.name,
  reference: (p) => p.reference,
  qty: (p) => p.qty,
  unit_price: (p) => p.unit_price,
  reorder_level: (p) => p.reorder_level,
}, drawParts);

/** Open the editor filled with what the row already says. Nothing is fetched: the
 *  part is in the list that drew the button, the same way a machine is. */
export function editPart(idToEdit) {
  const part = partsCache.find((p) => p.id === idToEdit);
  if (!part) return;
  $('#pe-id').value = String(part.id);
  $('#pe-name').value = part.name || '';
  $('#pe-ref').value = part.reference || '';
  $('#pe-supplier').value = part.supplier || '';
  $('#pe-qty').value = String(part.qty ?? 0);
  $('#pe-price').value = part.unit_price == null ? '' : String(part.unit_price);
  $('#pe-reorder').value = String(part.reorder_level ?? 0);
  // What the row was showing, said in words: a quantity and a price on their own
  // do not tell anyone whether this part is the one flagged as low.
  const low = Number(part.qty) <= Number(part.reorder_level);
  $('#part-edit-title').textContent = `Edit ${part.name}`;
  $('#part-edit-what').textContent = `${part.qty} in stock`
    + `${part.supplier ? ` from ${part.supplier}` : ''}`
    + `${low ? ' — at or below the reorder level, so it is flagged on the list.' : '.'}`;
  openForm('part-edit');
}

/** Save the whole record. Every field is sent, so clearing the supplier or the
 *  price really clears it — the route keeps whatever it is not told. */
export async function savePart() {
  const partId = Number($('#pe-id').value);
  const name = $('#pe-name').value.trim();
  if (!name) return formError('part-edit', 'A part needs a name.');
  try {
    await api(`/parts/${partId}`, { method: 'PUT', body: JSON.stringify({
      name,
      reference: $('#pe-ref').value.trim() || null,
      supplier: $('#pe-supplier').value.trim() || null,
      qty: $('#pe-qty').value,
      unit_price: $('#pe-price').value,
      reorder_level: $('#pe-reorder').value,
    })});
    formDone('part-edit');
    loadParts();
  } catch (e) { formError('part-edit', e.message); }
}

export async function removePart(idToRemove) {
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

export function downloadParts() {
  window.location = `/api/export/parts.csv${partQuery()}`;
}

export async function addPart() {
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
