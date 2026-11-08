// Optional spare parts attached to one stage. Drafts don't touch stock until
// the whole update is saved successfully on the server.
let choices = [], draft = [], generation = 0;

export function resetStageParts() {
  ++generation;
  choices = []; draft = [];
  $('#wa-part').innerHTML = '<option value="">Loading spare parts…</option>';
  $('#wa-part').disabled = true;
  $('#wa-part-qty').value = '1';
  $('#wa-part-price').value = '';
  $('#wa-part-list').innerHTML = '';
  $('#wa-part-status').textContent = '';
  $('#wa-part-retry').hidden = true;
}

export async function loadStageParts() {
  const run = ++generation;
  $('#wa-part-status').textContent = 'Loading spare parts…';
  $('#wa-part-retry').hidden = true;
  try {
    const parts = await api('/parts');
    if (run !== generation) return;
    choices = parts;
    $('#wa-part').innerHTML = '<option value="">— no part selected —</option>' + parts.map((p) =>
      `<option value="${p.id}">${esc(p.name)} — ${Number(p.qty)} in stock</option>`).join('');
    $('#wa-part').disabled = parts.length === 0;
    $('#wa-part-status').textContent = parts.length ? '' : 'No spare parts in the catalog. You can save without one.';
  } catch (e) {
    if (run !== generation) return;
    $('#wa-part').innerHTML = '<option value="">Could not load spare parts</option>';
    $('#wa-part').disabled = true;
    $('#wa-part-status').textContent = `Could not load spare parts: ${e.message}. You can save without one.`;
    $('#wa-part-retry').hidden = false;
  }
}

export function selectStagePart() {
  const part = choices.find((p) => String(p.id) === $('#wa-part').value);
  $('#wa-part-price').value = part?.unit_price == null ? '' : String(part.unit_price);
}

function selectedLine() {
  const partId = $('#wa-part').value, qty = Number($('#wa-part-qty').value), price = $('#wa-part-price').value;
  if (!partId) {
    if (price !== '') throw new Error('Choose a spare part for the entered cost.');
    return null;
  }
  const part = choices.find((p) => String(p.id) === partId);
  if (!part) throw new Error('Choose a spare part from the list.');
  if (!Number.isInteger(qty) || qty <= 0 || qty > 1_000_000) throw new Error('Part quantity must be a positive whole number.');
  if (price === '' || !Number.isFinite(Number(price)) || Number(price) < 0 || Number(price) > 1_000_000_000)
    throw new Error('Enter the actual unit cost for the spare part.');
  return { part_id: Number(partId), qty, unit_price: Number(price), name: part.name };
}

function drawDraft() {
  $('#wa-part-list').innerHTML = draft.map((p, i) => `<li>${esc(p.name)} × ${p.qty} · ${Number(p.unit_price).toFixed(2)} each
    <button type="button" class="ghost small" onclick="removeStagePart(${i})">Remove</button></li>`).join('');
}

export function addStagePart() {
  try {
    const part = selectedLine();
    if (!part) throw new Error('Choose a spare part first.');
    if (draft.length >= 50) throw new Error('Choose up to 50 spare parts per update.');
    draft.push(part);
    $('#wa-part').value = '';
    $('#wa-part-qty').value = '1';
    $('#wa-part-price').value = '';
    formError('work-assign', '');
    drawDraft();
  } catch (e) { formError('work-assign', e.message); }
}

// Existing stage lines are copied as a draft: nothing moves in stock until save.
export function setStageParts(lines) {
  draft = (lines || []).map((p) => ({ part_id: Number(p.part_id), qty: Number(p.qty),
    unit_price: Number(p.unit_price), name: p.part_name }));
  drawDraft();
}

export function removeStagePart(index) { draft.splice(index, 1); drawDraft(); }

export function stagePartsForSave() {
  const part = selectedLine();
  const lines = part ? [...draft, part] : draft;
  if (lines.length > 50) throw new Error('Choose up to 50 spare parts per update.');
  return lines.map(({ part_id, qty, unit_price }) => ({ part_id, qty, unit_price }));
}

Object.assign(window, { loadStageParts, selectStagePart, addStagePart, removeStagePart });
