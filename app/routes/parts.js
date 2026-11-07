// Spare parts, and the stock movements that follow a job.
//
// Stock is the one place where two writes must succeed together: consuming a
// part on a job is transactional, and cancelling the job puts the stock back.

import { send, readBody, route, id, sendCsv } from '../http.js';
import { stockValue, priceValue } from '../values.js';
import { all, get, run, transaction } from '../db.js';
import { partsFilter } from '../filters.js';

export default {
  // ---- spare parts
  'GET /api/parts': route(async (req, res) => {
    const f = partsFilter(req.query);
    send(res, 200, all(`SELECT p.* FROM parts p ${f.sql} ORDER BY p.name`, ...f.params));
  }),

  'POST /api/parts': route(async (req, res) => {
    const b = await readBody(req);
    if (!b?.name?.trim()) return send(res, 400, { error: 'Name is required' });
    const stock = stockValue(b.qty, 0);
    if (stock.error) return send(res, 400, { error: stock.error });
    const level = stockValue(b.reorder_level, 5);
    if (level.error) return send(res, 400, { error: level.error.replace('Quantity', 'Reorder level') });
    const price = priceValue(b.unit_price);
    if (price.error) return send(res, 400, { error: price.error });
    const r = run(`INSERT INTO parts (name, reference, qty, unit_price, supplier, reorder_level)
                   VALUES (?,?,?,?,?,?)`,
      b.name.trim(), b.reference || null, stock.value, price.value, b.supplier || null, level.value);
    send(res, 201, get('SELECT * FROM parts WHERE id = ?', r.lastInsertRowid));
  }),

  // Restock or correct a part. Every field is optional: the row is read first and
  // an absent key keeps its current value, so correcting a typo in the name cannot
  // quietly zero the stock (bug class the reviewed repo hit).
  'PUT /api/parts/:id': route(async (req, res) => {
    // readBody rejects on malformed JSON, so `b` is always an object here.
    const b = await readBody(req);
    const before = get('SELECT * FROM parts WHERE id = ?', id(req.params.id));
    if (!before) return send(res, 404, { error: 'Part not found' });

    if (b.name !== undefined && !String(b.name).trim()) {
      return send(res, 400, { error: 'Name cannot be empty' });
    }
    const stock = b.qty === undefined ? { value: before.qty } : stockValue(b.qty, before.qty);
    if (stock.error) return send(res, 400, { error: stock.error });
    const level = b.reorder_level === undefined
      ? { value: before.reorder_level }
      : stockValue(b.reorder_level, before.reorder_level);
    if (level.error) return send(res, 400, { error: level.error.replace('Quantity', 'Reorder level') });
    const price = b.unit_price === undefined ? { value: before.unit_price } : priceValue(b.unit_price);
    if (price.error) return send(res, 400, { error: price.error });

    run(`UPDATE parts SET name = ?, reference = ?, qty = ?, unit_price = ?, supplier = ?,
                          reorder_level = ?
         WHERE id = ?`,
      b.name === undefined ? before.name : String(b.name).trim(),
      b.reference === undefined ? before.reference : (b.reference || null),
      stock.value, price.value,
      b.supplier === undefined ? before.supplier : (b.supplier || null),
      level.value, before.id);
    send(res, 200, get('SELECT * FROM parts WHERE id = ?', before.id));
  }),

  // Deleting is allowed only for a part no job has consumed. The pre-check exists
  // to build a message naming the jobs — relying on ON DELETE RESTRICT alone would
  // surface "FOREIGN KEY constraint failed", which tells a workshop nothing.
  'DELETE /api/parts/:id': route(async (req, res) => {
    const part = get('SELECT * FROM parts WHERE id = ?', id(req.params.id));
    if (!part) return send(res, 404, { error: 'Part not found' });

    const usedOn = all(`SELECT w.id, w.title FROM work_order_parts wop
                        JOIN work_orders w ON w.id = wop.work_order_id
                        WHERE wop.part_id = ? ORDER BY w.created_at DESC`, part.id);
    if (usedOn.length) {
      const titles = usedOn.map((w) => w.title).join(', ');
      return send(res, 400, {
        error: `This part was used on: ${titles}. Remove it from those jobs first.`,
        work_orders: usedOn,
      });
    }
    run('DELETE FROM parts WHERE id = ?', part.id);
    send(res, 200, { ok: true });
  }),

  // Which parts were used on this job.
  'GET /api/work-orders/:id/parts': route(async (req, res) => send(res, 200, all(`
    SELECT p.id, p.name, p.reference, wop.qty
    FROM work_order_parts wop JOIN parts p ON p.id = wop.part_id
    WHERE wop.work_order_id = ? ORDER BY p.name`, id(req.params.id)))),

  // Use a part on a job: checks stock, links the part and decrements it —
  // all inside one transaction, so a failure leaves nothing half-written.
  'POST /api/work-orders/:id/parts': route(async (req, res) => {
    const b = await readBody(req);
    const qty = Number(b?.qty) || 1;
    if (!(qty > 0)) return send(res, 400, { error: 'Quantity must be more than zero' });

    const part = get('SELECT * FROM parts WHERE id = ?', id(b.part_id));
    if (!part) return send(res, 404, { error: 'Part not found' });
    if (part.qty < qty) {
      return send(res, 400, { error: `Only ${part.qty} in stock, cannot use ${qty}` });
    }
    if (!get('SELECT id FROM work_orders WHERE id = ?', id(req.params.id))) {
      return send(res, 404, { error: 'Work order not found' });
    }

    transaction(() => {
      // Same part twice on one job: add to the existing line instead of failing.
      run(`INSERT INTO work_order_parts (work_order_id, part_id, qty) VALUES (?,?,?)
           ON CONFLICT (work_order_id, part_id) DO UPDATE SET qty = qty + excluded.qty`,
        id(req.params.id), id(b.part_id), qty);
      run('UPDATE parts SET qty = qty - ? WHERE id = ?', qty, id(b.part_id));
    });
    send(res, 200, all('SELECT p.name, wop.qty FROM work_order_parts wop '
      + 'JOIN parts p ON p.id = wop.part_id WHERE wop.work_order_id = ?', id(req.params.id)));
  }),

  // ---- the parts list as a file, from the same filter as the screen
  'GET /api/export/parts.csv': route(async (req, res) => {
    const f = partsFilter(req.query);
    const rows = all(`
      SELECT p.id, p.name, p.reference, p.qty, p.reorder_level, p.unit_price, p.supplier
      FROM parts p ${f.sql} ORDER BY p.name`, ...f.params);
    sendCsv(res, 'spare-parts.csv', rows, [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name' },
      { key: 'reference', label: 'Reference' },
      { key: 'qty', label: 'In stock' },
      { key: 'reorder_level', label: 'Reorder at' },
      { key: 'unit_price', label: 'Unit price' },
      { key: 'supplier', label: 'Supplier' },
    ]);
  }),
};
