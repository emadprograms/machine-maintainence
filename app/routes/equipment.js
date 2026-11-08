// Machines: the list behind every other screen, and the photograph that helps
// somebody find the right one.
//
// Two rules changed in 261106-eqs and they are worth stating at the top:
//
//   * The machine's operating state is the latest explicit report or stage answer;
//     the stored equipment column records only administrative retirement.
//   * Changing what is recorded is an administrator's job. Reporting a fault is
//     not — a fitter must be able to create a machine and open a job on it — but
//     correcting the record, retiring it and attaching a photograph are admin-only.

import { send, readBody, route, id, readBytes } from '../http.js';
import { all, get, run } from '../db.js';
import { equipmentFilter } from '../filters.js';
import { effectiveHours } from '../hours.js';
import { withStatus, SERVICE_STATES } from '../status.js';
import { MAX_PHOTO_BYTES, savePhoto, readPhoto, removePhoto, photoType } from '../photos.js';

const photoOf = (idToFind) => get('SELECT photo FROM equipment WHERE id = ?', idToFind);

export default {
  // ---- equipment
  // `?service=active` leaves retired machines out; no parameter returns everything.
  // Two lists in the app ask for the first: the everyday Machines screen and the
  // dropdowns that start new work.
  'GET /api/equipment': route(async (req, res) => {
    const f = equipmentFilter(req.query);
    const rows = withStatus(
      all(`SELECT e.*, (SELECT ROUND(COALESCE(SUM(${effectiveHours()}), 0), 6)
        FROM work_orders w WHERE w.equipment_id = e.id) AS total_hours
        FROM equipment e ${f.sql} ORDER BY e.name`, ...f.params));
    // `status` is the latest reported state (down/active/retired); `service_status`
    // is what is stored. Filtering on the reported one happens after it is worked out —
    // which is why this is a JavaScript filter and not another WHERE clause. Before
    // 261106-eqv this parameter filtered the raw column, where 'down' no longer lives.
    const wanted = String(req.query.status || '');
    send(res, 200, wanted ? rows.filter((m) => m.status === wanted) : rows);
  }),

  'POST /api/equipment': route(async (req, res) => {
    const b = await readBody(req);
    if (!b?.name?.trim()) return send(res, 400, { error: 'Name is required' });
    const r = run(`INSERT INTO equipment (name, asset_tag, category, location, status, notes, manufacturer)
                   VALUES (?,?,?,?,?,?,?)`,
      b.name.trim(), b.asset_tag || null, b.category || null, b.location || null,
      'active', b.notes || null, b.manufacturer || null);
    const row = get('SELECT * FROM equipment WHERE id = ?', r.lastInsertRowid);
    send(res, 201, withStatus([row])[0]);
  }),

  'PUT /api/equipment/:id': route(async (req, res) => {
    if (req.user.role !== 'admin') return send(res, 403, { error: 'Admins only' });
    const b = await readBody(req);
    const before = get('SELECT * FROM equipment WHERE id = ?', id(req.params.id));
    if (!before) return send(res, 404, { error: 'Machine not found' });
    // POST has always refused a nameless machine; PUT did not, and a machine whose
    // name is '' is unidentifiable in every list it appears in.
    if (b.name !== undefined && !String(b.name).trim()) {
      return send(res, 400, { error: 'Name is required' });
    }
    // 'down' is a consequence of the work orders, not something to type. Refusing
    // it here means the old form cannot resurrect a stale badge either.
    if (b.status !== undefined && !SERVICE_STATES.includes(b.status)) {
      return send(res, 400, {
        error: 'Record the machine state in a work order report or update instead.',
      });
    }
    run(`UPDATE equipment SET name=?, asset_tag=?, category=?, location=?, status=?,
           notes=?, manufacturer=? WHERE id=?`,
      b.name?.trim() ?? before.name, b.asset_tag ?? before.asset_tag, b.category ?? before.category,
      b.location ?? before.location, b.status ?? before.status, b.notes ?? before.notes,
      b.manufacturer ?? before.manufacturer, id(req.params.id));
    const row = get('SELECT * FROM equipment WHERE id = ?', id(req.params.id));
    send(res, 200, withStatus([row])[0]);
  }),

  'DELETE /api/equipment/:id': route(async (req, res) => {
    if (req.user.role !== 'admin') return send(res, 403, { error: 'Admins only' });
    const row = photoOf(id(req.params.id));
    // The jobs go with the machine (ON DELETE CASCADE), and each of them may have
    // photographed the fault. Collect the names first: after the delete there is
    // nothing left to ask, and a file nobody points at is litter.
    const jobPhotos = all('SELECT photo FROM work_orders WHERE equipment_id = ? AND photo IS NOT NULL',
      id(req.params.id)).map((w) => w.photo);
    const updatePhotos = all(`SELECT p.filename FROM work_update_photos p
      JOIN work_order_updates u ON u.id = p.update_id
      JOIN work_orders w ON w.id = u.work_order_id WHERE w.equipment_id = ?`, id(req.params.id));
    run('DELETE FROM equipment WHERE id = ?', id(req.params.id));
    removePhoto(row?.photo);
    jobPhotos.forEach(removePhoto);
    updatePhotos.forEach((p) => removePhoto(p.filename));
    send(res, 200, { ok: true });
  }),

  // ---- the photograph. Raw bytes in, bytes out.
  'POST /api/equipment/:id/photo': route(async (req, res) => {
    if (req.user.role !== 'admin') return send(res, 403, { error: 'Admins only' });
    const before = photoOf(id(req.params.id));
    if (!before) return send(res, 404, { error: 'Machine not found' });
    const bytes = await readBytes(req, MAX_PHOTO_BYTES);
    if (!bytes.length) return send(res, 400, { error: 'No image was sent' });
    const saved = savePhoto(bytes);
    if (saved.error) return send(res, 400, { error: saved.error });
    run('UPDATE equipment SET photo = ? WHERE id = ?', saved.name, id(req.params.id));
    removePhoto(before.photo);        // replacing a photograph replaces the file
    send(res, 200, { photo: saved.name, type: saved.type });
  }, { raw: true }),

  'GET /api/equipment/:id/photo': route(async (req, res) => {
    const row = photoOf(id(req.params.id));
    const bytes = row ? readPhoto(row.photo) : null;
    if (!bytes) return send(res, 404, { error: 'No photograph for this machine' });
    res.writeHead(200, {
      'content-type': photoType(row.photo),
      'content-length': bytes.length,
      // Private: the bytes are behind a sign-in, so no shared cache may keep them.
      'cache-control': 'private, max-age=60',
    });
    res.end(bytes);
  }),

  'DELETE /api/equipment/:id/photo': route(async (req, res) => {
    if (req.user.role !== 'admin') return send(res, 403, { error: 'Admins only' });
    const row = photoOf(id(req.params.id));
    if (!row?.photo) return send(res, 200, { photo: null });
    run('UPDATE equipment SET photo = NULL WHERE id = ?', id(req.params.id));
    removePhoto(row.photo);
    send(res, 200, { photo: null });
  }),
};
