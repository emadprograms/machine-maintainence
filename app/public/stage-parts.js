// Optional spare parts attached to one stage. Drafts don't touch stock until
// the whole update is saved successfully on the server.
let choices = [], draft = [], generation = 0;

// Group only the same part at the exact same actual price; different prices
// remain distinct. Copy the rows so rendering or saving never mutates a draft.
export function groupStageParts(lines) {
  const result = [];
  for (const line of lines || []) {
    const partId = Number(line.part_id), price = Number(line.unit_price), qty = Number(line.qty);
    const existing = result.find((p) => p.part_id === partId && p.unit_price === price);
    if (existing) existing.qty += qty;
    else result.push({ ...line, part_id: partId, unit_price: price, qty });
  }
  return result;
}

export function formatStagePrice(value) {
  const price = Number(value);
  return Math.round(price * 100) / 100 === price ? price.toFixed(2) : String(price);
}

export function updateStagePartsSummary() {
  let count = draft.length;
  if ($('#wa-part').value) {
    const price = $('#wa-part-price').value;
    if (price === '' || !draft.some((p) => p.part_id === Number($('#wa-part').value) && p.unit_price === Number(price))) count++;
  }
  $('#wa-parts-summary').textContent = count ? `${count} ${count === 1 ? 'part' : 'parts'} selected` : 'Optional · Add parts used in this stage';
}

export function resetStageParts() {
  ++generation;
  choices = []; draft = [];
  $('#wa-part').innerHTML = '<option value="">Loading spare parts…</option>';
  $('#wa-part').disabled = true;
  $('#wa-part-qty').value = '1';
  $('#wa-part-price').value = '';
  $('#wa-part-list').innerHTML = '';
  $('#wa-part-status').textContent = '';
  $('#wa-part-retry').hidden = true; updateStagePartsSummary();
}

export async function loadStageParts() {
  const run = ++generation;
  $('#wa-part-status').textContent = 'Loading spare parts…';
  $('#wa-part-retry').hidden = true;
  try {
    const parts = await api('/parts');
    if (run !== generation) return;
    choices = parts;
    $('#wa-part').innerHTML = '<option value="">Choose a spare part</option>' + parts.map((p) =>
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
  $('#wa-part-price').value = part?.unit_price == null ? '' : String(part.unit_price); updateStagePartsSummary();
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

// Serialize big totals as bounded input lines, while showing one combined row.
function payloadLines(lines) {
  const result = [];
  for (const part of lines) {
    let remaining = part.qty;
    while (remaining > 0) {
      if (result.length >= 50) throw new Error('Choose up to 50 spare part quantities per update.');
      const qty = Math.min(remaining, 1_000_000);
      result.push({ part_id: part.part_id, qty, unit_price: part.unit_price });
      remaining -= qty;
    }
  }
  return result;
}

function drawDraft() {
  updateStagePartsSummary();
  $('#wa-part-list').innerHTML = draft.map((p, i) => `<tr><td>${esc(p.name)}</td><td>${p.qty}</td><td>${formatStagePrice(p.unit_price)}</td>
    <td><button type="button" class="stage-row-action stage-remove-part" onclick="removeStagePart(${i})" aria-label="Remove ${esc(p.name)}" title="Remove part"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg></button></td></tr>`).join('');
}

export function addStagePart() {
  try {
    const part = selectedLine();
    if (!part) throw new Error('Choose a spare part first.');
    const next = groupStageParts([...draft, part]);
    payloadLines(next); // validate before touching the draft
    draft = next;
    $('#wa-part').value = '';
    $('#wa-part-qty').value = '1';
    $('#wa-part-price').value = '';
    formError('work-assign', '');
    drawDraft();
  } catch (e) { formError('work-assign', e.message); }
}

// Existing stage lines are copied as a draft: nothing moves in stock until save.
export function setStageParts(lines) {
  draft = groupStageParts((lines || []).map((p) => ({ part_id: Number(p.part_id), qty: Number(p.qty),
    unit_price: Number(p.unit_price), name: p.part_name })));
  drawDraft();
}

export function removeStagePart(index) { draft.splice(index, 1); drawDraft(); }

export function hasStagePartsDraft() { return draft.length > 0 || Boolean($('#wa-part').value); }

export function stagePartsForSave() {
  const part = selectedLine();
  return payloadLines(groupStageParts(part ? [...draft, part] : draft));
}

Object.assign(window, { loadStageParts, selectStagePart, updateStagePartsSummary, addStagePart, removeStagePart });
