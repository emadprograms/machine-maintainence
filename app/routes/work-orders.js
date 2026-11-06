// Work orders — reported faults, closed jobs — plus their CSV export.
//
// The export calls the same workOrderFilter() as the list, so the file cannot
// disagree with the screen; a second query is how that bug gets shipped.

import { send, readBody, route, id, sendCsv } from '../http.js';
import { hoursValue, assigneeValue } from '../values.js';
import { all, get, run } from '../db.js';
import { nowStamp } from '../dates.js';
import { workOrderFilter } from '../filters.js';
import { hourlyRate } from '../settings.js';

export default {
  // ---- work orders
  // The owner's name is resolved here, with no filter on `active`: a person who
  // has left still has to render on the jobs they owned (WO-02).
  'GET /api/work-orders': route(async (req, res) => {
    const f = workOrderFilter(req.query);
    send(res, 200, all(`
      SELECT w.*, e.name AS equipment_name, u.name AS assignee_name,
             -- parts used on this job, plus recorded hours at the configured rate
             ROUND(COALESCE(w.labour_hours, 0) * ?
                   + (SELECT COALESCE(SUM(wop.qty * COALESCE(p.unit_price, 0)), 0)
                        FROM work_order_parts wop JOIN parts p ON p.id = wop.part_id
                       WHERE wop.work_order_id = w.id), 2) AS cost
      FROM work_orders w
      JOIN equipment e ON e.id = w.equipment_id
      LEFT JOIN users u ON u.id = w.assigned_to
      ${f.sql}
      ORDER BY CASE w.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
               w.created_at DESC`, hourlyRate(), ...f.params));
  }),

  'POST /api/work-orders': route(async (req, res) => {
    const b = await readBody(req);
    if (!b?.equipment_id || !b?.title?.trim()) {
      return send(res, 400, { error: 'Machine and title are required' });
    }
    const owner = assigneeValue(b.assigned_to);
    if (owner.error) return send(res, 400, { error: owner.error });
    // FK constraint catches a bogus machine id -> 400 instead of an orphan record.
    const hours = hoursValue(b.labour_hours);
    if (hours.error) return send(res, 400, { error: hours.error });
    const r = run(`INSERT INTO work_orders (equipment_id, title, notes, priority, assigned_to, labour_hours)
                   VALUES (?,?,?,?,?,?)`,
      id(b.equipment_id), b.title.trim(), b.notes || null, b.priority || 'medium', owner.value,
      hours.missing ? null : hours.value);
    send(res, 201, get('SELECT * FROM work_orders WHERE id = ?', r.lastInsertRowid));
  }),

  'PATCH /api/work-orders/:id': route(async (req, res) => {
    const b = await readBody(req);
    const before = get('SELECT * FROM work_orders WHERE id = ?', id(req.params.id));
    if (!before) return send(res, 404, { error: 'Work order not found' });
    if (b.title !== undefined && !String(b.title).trim()) {
      return send(res, 400, { error: 'Title cannot be empty' });
    }
    const owner = b.assigned_to === undefined
      ? { value: before.assigned_to }
      : assigneeValue(b.assigned_to);
    if (owner.error) return send(res, 400, { error: owner.error });
    const hours = hoursValue(b.labour_hours);
    if (hours.error) return send(res, 400, { error: hours.error });
    run(`UPDATE work_orders SET title=?, status=?, priority=?, notes=?, closed_at=?, assigned_to=?,
         labour_hours=? WHERE id=?`,
      b.title === undefined ? before.title : String(b.title).trim(),
      b.status ?? before.status, b.priority ?? before.priority, b.notes ?? before.notes,
      (b.status ?? before.status) === 'done' ? (before.closed_at ?? nowStamp()) : null,
      owner.value, hours.missing ? before.labour_hours : hours.value, id(req.params.id));
    send(res, 200, get('SELECT * FROM work_orders WHERE id = ?', id(req.params.id)));
  }),

  // ---- CSV export. Same filter builders as the list routes above, so the file
  // matches the screen by construction rather than by two queries agreeing.
  'GET /api/export/work-orders.csv': route(async (req, res) => {
    const f = workOrderFilter(req.query);
    const rows = all(`
      SELECT w.id, w.title, w.status, w.priority, w.created_at, w.closed_at,
             e.name AS equipment, u.name AS owner
      FROM work_orders w
      JOIN equipment e ON e.id = w.equipment_id
      LEFT JOIN users u ON u.id = w.assigned_to
      ${f.sql} ORDER BY w.created_at DESC`, ...f.params);
    sendCsv(res, 'work-orders.csv', rows, [
      { key: 'id', label: 'ID' },
      { key: 'equipment', label: 'Machine' },
      { key: 'title', label: 'Problem' },
      { key: 'owner', label: 'Owner' },
      { key: 'priority', label: 'Priority' },
      { key: 'status', label: 'Status' },
      { key: 'created_at', label: 'Created' },
      { key: 'closed_at', label: 'Closed' },
    ]);
  }),
};
