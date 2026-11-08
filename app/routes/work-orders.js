// Work orders — reported faults, closed jobs — plus their CSV export.
//
// The export calls the same workOrderFilter() as the list, so the file cannot
// disagree with the screen; a second query is how that bug gets shipped.

import { send, readBody, readBytes, route, id, sendCsv } from '../http.js';
import { hoursValue, assigneeValue, reporterValue, resolutionValue, verifiedValue,
  stopsValue } from '../values.js';
import { MAX_PHOTO_BYTES, savePhoto, readPhoto, removePhoto, photoType } from '../photos.js';
import { all, get, run } from '../db.js';
import { nowStamp } from '../dates.js';
import { workOrderFilter } from '../filters.js';
import { hourlyRate } from '../settings.js';
import { nextWorkOrderCode } from '../codes.js';

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
    if (!b?.equipment_id || typeof b.title !== 'string' || !b.title.trim()) {
      return send(res, 400, { error: 'Machine and problem are required' });
    }
    const owner = assigneeValue(b.assigned_to);
    if (owner.error) return send(res, 400, { error: owner.error });
    // FK constraint catches a bogus machine id -> 400 instead of an orphan record.
    const hours = hoursValue(b.labour_hours);
    if (hours.error) return send(res, 400, { error: hours.error });
    const reporter = reporterValue(b.reported_by);
    if (reporter.error) return send(res, 400, { error: reporter.error });
    const notes = b.notes === undefined || b.notes === null ? null
      : (String(b.notes).trim() || null);
    // The number is the server's to give: a client that could choose one could
    // also choose somebody else's, and two jobs would share a number on the phone.
    const stamp = nowStamp();
    const r = run(`INSERT INTO work_orders
                     (equipment_id, title, notes, priority, assigned_to, labour_hours,
                      reported_by, stops_machine, code)
                   VALUES (?,?,?,?,?,?,?,?,?)`,
      id(b.equipment_id), b.title.trim(), notes, b.priority || 'medium', owner.value,
      hours.missing ? null : hours.value, reporter.missing ? null : reporter.value,
      stopsValue(b.stops_machine), nextWorkOrderCode(stamp));
    send(res, 201, get('SELECT * FROM work_orders WHERE id = ?', r.lastInsertRowid));
  }),

  'PATCH /api/work-orders/:id': route(async (req, res) => {
    const b = await readBody(req);
    const before = get('SELECT * FROM work_orders WHERE id = ?', id(req.params.id));
    if (!before) return send(res, 404, { error: 'Work order not found' });
    if (b.title !== undefined && (typeof b.title !== 'string' || !b.title.trim())) {
      return send(res, 400, { error: 'Problem cannot be empty' });
    }
    const owner = b.assigned_to === undefined
      ? { value: before.assigned_to }
      : assigneeValue(b.assigned_to);
    if (owner.error) return send(res, 400, { error: owner.error });
    const hours = hoursValue(b.labour_hours);
    if (hours.error) return send(res, 400, { error: hours.error });
    const reporter = reporterValue(b.reported_by);
    if (reporter.error) return send(res, 400, { error: reporter.error });
    const resolution = resolutionValue(b.resolution);
    if (resolution.error) return send(res, 400, { error: resolution.error });
    const verifier = verifiedValue(b.verified_by);
    if (verifier.error) return send(res, 400, { error: verifier.error });
    const notes = b.notes === undefined ? before.notes : (String(b.notes ?? '').trim() || null);
    const status = b.status ?? before.status;
    // A job in progress belongs to somebody. This is about the transition, like the
    // rule below it: a job already being worked on keeps its state when something
    // else about it changes, but nothing starts work without a name attached.
    if (status === 'in_progress' && !owner.value
        && (before.status !== 'in_progress' || (b.assigned_to !== undefined && before.assigned_to))) {
      return send(res, 400, { error: 'Assign the job to someone before starting it' });
    }
    // A job cannot be closed without an account of the repair. "Bearing noise —
    // done" answers nothing six months later, and the moment to write it down is
    // the moment the job is finished. The rule is about the transition, not the
    // state: a change to a job that is already closed does not ask again, but a job
    // reopened because the fix did not hold must be closed with a new account
    // rather than inheriting the story of the repair that failed.
    // A job that is already closed keeps its account when something else about it
    // changes; a job being closed now has to bring one, even if it was closed once
    // before and reopened because that repair did not hold.
    const done = resolution.missing
      ? (before.status === 'done' ? before.resolution : null)
      : resolution.value;
    if (status === 'done' && before.status !== 'done' && !done) {
      return send(res, 400, { error: 'Say what was done before closing the job' });
    }
    run(`UPDATE work_orders SET title=?, status=?, priority=?, notes=?, closed_at=?, assigned_to=?,
         labour_hours=?, reported_by=?, resolution=?, verified_by=?, stops_machine=? WHERE id=?`,
      b.title === undefined ? before.title : String(b.title).trim(),
      status, b.priority ?? before.priority, notes,
      status === 'done' ? (before.closed_at ?? nowStamp()) : null,
      owner.value, hours.missing ? before.labour_hours : hours.value,
      reporter.missing ? before.reported_by : reporter.value,
      done, verifier.missing ? before.verified_by : verifier.value,
      b.stops_machine === undefined ? before.stops_machine : stopsValue(b.stops_machine),
      id(req.params.id));
    send(res, 200, get('SELECT * FROM work_orders WHERE id = ?', id(req.params.id)));
  }),

  // ---- the photograph of the fault. Same bytes-in/bytes-out contract as a
  // machine's photograph, and one deliberate difference: **any signed-in person
  // may attach and remove one.** A technician is exactly who finds the fault and
  // photographs it, so an admin-only route would be a route nobody who needs it
  // can use; and a blurred photograph left in the record is worse than a deleted
  // one. The record itself stays admin-only to change.
  'POST /api/work-orders/:id/photo': route(async (req, res) => {
    const before = get('SELECT photo FROM work_orders WHERE id = ?', id(req.params.id));
    if (!before) return send(res, 404, { error: 'Work order not found' });
    const bytes = await readBytes(req, MAX_PHOTO_BYTES);
    const saved = savePhoto(bytes);
    if (saved.error) return send(res, 400, { error: saved.error });
    run('UPDATE work_orders SET photo = ? WHERE id = ?', saved.name, id(req.params.id));
    removePhoto(before.photo);        // replacing a photograph replaces the file
    send(res, 200, { photo: saved.name, type: saved.type });
  }, { raw: true }),       // bytes, not JSON: parsing a JPEG would answer 400 to every photograph

  'GET /api/work-orders/:id/photo': route(async (req, res) => {
    const row = get('SELECT photo FROM work_orders WHERE id = ?', id(req.params.id));
    const bytes = row ? readPhoto(row.photo) : null;
    if (!bytes) return send(res, 404, { error: 'No photograph for this work order' });
    res.writeHead(200, {
      'content-type': photoType(row.photo),
      'content-length': bytes.length,
      // The name changes when the photograph does, so the answer never is.
      'cache-control': 'private, max-age=86400',
    });
    res.end(bytes);
  }),

  'DELETE /api/work-orders/:id/photo': route(async (req, res) => {
    const row = get('SELECT photo FROM work_orders WHERE id = ?', id(req.params.id));
    if (!row) return send(res, 404, { error: 'Work order not found' });
    if (!row.photo) return send(res, 200, { photo: null });
    run('UPDATE work_orders SET photo = NULL WHERE id = ?', id(req.params.id));
    removePhoto(row.photo);
    send(res, 200, { photo: null });
  }),

  // ---- CSV export. Same filter builders as the list routes above, so the file
  // matches the screen by construction rather than by two queries agreeing.
  'GET /api/export/work-orders.csv': route(async (req, res) => {
    const f = workOrderFilter(req.query);
    const rows = all(`
      SELECT w.id, w.code, w.title, w.status, w.priority, w.stops_machine,
             w.created_at, w.closed_at, e.name AS equipment, u.name AS owner
      FROM work_orders w
      JOIN equipment e ON e.id = w.equipment_id
      LEFT JOIN users u ON u.id = w.assigned_to
      ${f.sql} ORDER BY w.created_at DESC`, ...f.params);
    sendCsv(res, 'work-orders.csv', rows, [
      { key: 'code', label: 'Number' },
      { key: 'id', label: 'ID' },
      { key: 'equipment', label: 'Machine' },
      { key: 'title', label: 'Problem' },
      { key: 'owner', label: 'Assigned to' },
      { key: 'priority', label: 'Priority' },
      { key: 'stops_machine', label: 'Stops the machine' },
      { key: 'status', label: 'Status' },
      { key: 'created_at', label: 'Created' },
      { key: 'closed_at', label: 'Closed' },
    ]);
  }),
};
