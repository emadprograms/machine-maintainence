// Recurring preventive maintenance. The reviewed application faked this with a
// generated calendar; here a schedule is a row, and due-ness is arithmetic.

import { send, readBody, route, id, day } from '../http.js';
import { all, get, run } from '../db.js';
import { parseDay } from '../dates.js';
import { IN_SERVICE_SQL } from '../status.js';

export default {
  // ---- preventive maintenance  (the feature the reviewed repo lacks)
  // `?service=active` leaves out schedules belonging to retired machines, so a
  // workshop that has scrapped a press stops being told to grease it. No parameter
  // still returns everything: the schedule is not deleted, only not offered.
  'GET /api/pm': route(async (req, res) => {
    const only = req.query.service === 'active' ? `WHERE ${IN_SERVICE_SQL}` : '';
    send(res, 200, all(`
      SELECT p.*, e.name AS equipment_name,
             CAST(julianday(p.next_due) - julianday('now') AS INTEGER) AS days_left
      FROM pm_schedule p JOIN equipment e ON e.id = p.equipment_id
      ${only}
      ORDER BY p.next_due`));
  }),

  // "Due soon": due within N days, or already overdue.

  'GET /api/pm/due': route(async (req, res) => {
    const days = Number(req.query.days) || 7;
    const inService = req.query.service === 'active' ? `AND ${IN_SERVICE_SQL}` : '';
    send(res, 200, all(`
      SELECT p.*, e.name AS equipment_name,
             CAST(julianday(p.next_due) - julianday('now') AS INTEGER) AS days_left
      FROM pm_schedule p JOIN equipment e ON e.id = p.equipment_id
      WHERE julianday(p.next_due) <= julianday('now', '+' || ? || ' days') ${inService}
      ORDER BY p.next_due`, days));
  }),

  'POST /api/pm': route(async (req, res) => {
    const b = await readBody(req);
    const interval = Number(b?.interval_days);
    if (!b?.equipment_id || !b?.task?.trim() || !(interval > 0)) {
      return send(res, 400, { error: 'Machine, task and a positive interval are required' });
    }
    const due = b.next_due || new Date(Date.now() + interval * 86400_000).toISOString().slice(0, 10);
    const r = run('INSERT INTO pm_schedule (equipment_id, task, interval_days, last_done, next_due) '
      + 'VALUES (?,?,?,?,?)', id(b.equipment_id), b.task.trim(), interval, day(b.last_done), day(due));
    send(res, 201, get('SELECT * FROM pm_schedule WHERE id = ?', r.lastInsertRowid));
  }),

  'POST /api/pm/:id/done': route(async (req, res) => {
    const row = get('SELECT * FROM pm_schedule WHERE id = ?', id(req.params.id));
    if (!row) return send(res, 404, { error: 'Schedule not found' });

    const today = new Date().toISOString().slice(0, 10);
    // Absent means "it was done today" — that default is fine. Present means the
    // caller said something specific, and it must be used or refused, never
    // quietly swapped for today (v1.0 did exactly that: HTTP 200, value ignored).
    let base = today;
    if (req.body?.on !== undefined && req.body.on !== null && req.body.on !== '') {
      const parsed = parseDay(req.body.on, 'on');
      if (parsed.error) return send(res, 400, { error: parsed.error });
      if (parsed.value > today) {
        return send(res, 400, { error: 'A maintenance task cannot be completed in the future' });
      }
      if (row.last_done && parsed.value < row.last_done) {
        return send(res, 400, {
          error: `This was last done on ${row.last_done}; a completion date cannot be earlier than that`,
        });
      }
      base = parsed.value;
    }

    run(`UPDATE pm_schedule
         SET last_done = ?, next_due = date(?, '+' || interval_days || ' days')
         WHERE id = ?`, base, base, id(req.params.id));
    send(res, 200, get('SELECT * FROM pm_schedule WHERE id = ?', id(req.params.id)));
  }),
};
