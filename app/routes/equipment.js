// Machines: the list behind every other screen, and the history dialog's target.

import { send, readBody, route, id } from '../http.js';
import { all, get, run } from '../db.js';
import { equipmentFilter } from '../filters.js';

export default {
  // ---- equipment
  'GET /api/equipment': route(async (req, res) => {
    const f = equipmentFilter(req.query);
    send(res, 200, all(`SELECT e.* FROM equipment e ${f.sql} ORDER BY e.name`, ...f.params));
  }),

  'POST /api/equipment': route(async (req, res) => {
    const b = await readBody(req);
    if (!b?.name?.trim()) return send(res, 400, { error: 'Name is required' });
    const r = run(`INSERT INTO equipment (name, asset_tag, category, location, status, notes, manufacturer)
                   VALUES (?,?,?,?,?,?,?)`,
      b.name.trim(), b.asset_tag || null, b.category || null, b.location || null,
      b.status || 'active', b.notes || null, b.manufacturer || null);
    send(res, 201, get('SELECT * FROM equipment WHERE id = ?', r.lastInsertRowid));
  }),

  'PUT /api/equipment/:id': route(async (req, res) => {
    const b = await readBody(req);
    const before = get('SELECT * FROM equipment WHERE id = ?', id(req.params.id));
    if (!before) return send(res, 404, { error: 'Machine not found' });
    run(`UPDATE equipment SET name=?, asset_tag=?, category=?, location=?, status=?, notes=? WHERE id=?`,
      b.name ?? before.name, b.asset_tag ?? before.asset_tag, b.category ?? before.category,
      b.location ?? before.location, b.status ?? before.status, b.notes ?? before.notes,
      id(req.params.id));
    send(res, 200, get('SELECT * FROM equipment WHERE id = ?', id(req.params.id)));
  }),

  'DELETE /api/equipment/:id': route(async (req, res) => {
    if (req.user.role !== 'admin') return send(res, 403, { error: 'Admins only' });
    run('DELETE FROM equipment WHERE id = ?', id(req.params.id));
    send(res, 200, { ok: true });
  }),
};
