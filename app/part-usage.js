// Consume stock and record the actual cost inside the caller's transaction.
// Each stage keeps its own price; the work-order total aggregates all uses.
import { all, get, run } from './db.js';

export function useStock(workId, updateId, lines, originalNames = new Map()) {
  if (!Array.isArray(lines) || lines.length > 50) throw new Error('Choose up to 50 spare parts per update');
  for (const line of lines) {
    const numeric = (value) => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== ''));
    const partId = Number(line?.part_id), qty = Number(line?.qty), price = Number(line?.unit_price);
    if (!numeric(line?.part_id) || !Number.isSafeInteger(partId) || partId <= 0) throw new Error('Choose a spare part');
    if (!numeric(line?.qty) || !Number.isInteger(qty) || qty <= 0 || qty > 1_000_000) throw new Error('Part quantity must be a positive whole number');
    if (!numeric(line?.unit_price) || !Number.isFinite(price) || price < 0 || price > 1_000_000_000)
      throw new Error('Enter a valid non-negative unit cost for each part');
    const part = get('SELECT * FROM parts WHERE id = ?', partId);
    if (!part) throw new Error('A selected spare part no longer exists');
    if (part.qty < qty) throw new Error(`Only ${part.qty} of ${part.name} in stock, cannot use ${qty}`);
    run(`INSERT INTO work_order_parts (work_order_id, part_id, qty, cost_total) VALUES (?,?,?,?)
      ON CONFLICT (work_order_id, part_id) DO UPDATE SET qty = qty + excluded.qty,
        cost_total = COALESCE(cost_total, 0) + excluded.cost_total`, workId, partId, qty, qty * price);
    run('UPDATE parts SET qty = qty - ? WHERE id = ?', qty, partId);
    if (updateId) run('INSERT INTO work_update_parts (update_id, part_id, part_name, qty, unit_price) VALUES (?,?,?,?,?)',
      updateId, partId, originalNames.get(partId) || part.name, qty, price);
  }
}

// Reverse exactly what this stage consumed. Called only inside a transaction,
// before replacing its parts or deleting it. Other stages and close-time uses stay.
export function returnStageStock(workId, updateId) {
  const lines = all('SELECT * FROM work_update_parts WHERE update_id = ? ORDER BY id', updateId);
  for (const line of lines) {
    const total = get('SELECT qty, cost_total FROM work_order_parts WHERE work_order_id = ? AND part_id = ?', workId, line.part_id);
    if (!total || total.qty < line.qty || total.cost_total + 0.000001 < line.qty * line.unit_price)
      throw new Error('Part usage is inconsistent; no stock was changed');
    run('UPDATE parts SET qty = qty + ? WHERE id = ?', line.qty, line.part_id);
    if (total.qty === line.qty) run('DELETE FROM work_order_parts WHERE work_order_id = ? AND part_id = ?', workId, line.part_id);
    else run('UPDATE work_order_parts SET qty = qty - ?, cost_total = MAX(0, cost_total - ?) WHERE work_order_id = ? AND part_id = ?',
      line.qty, line.qty * line.unit_price, workId, line.part_id);
  }
  run('DELETE FROM work_update_parts WHERE update_id = ?', updateId);
  return new Map(lines.map((line) => [line.part_id, line.part_name]));
}
