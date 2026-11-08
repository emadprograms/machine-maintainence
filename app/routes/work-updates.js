// Append-only stages. Starting and recording Stage 1 happen in one transaction.
import { send, readBytes, route, id } from '../http.js';
import { all, get, run, transaction } from '../db.js';
import { assigneeValue, hoursValue } from '../values.js';
import { MAX_PHOTO_BYTES, savePhoto, readPhoto, removePhoto, photoType } from '../photos.js';

const MAX_PHOTOS = 5;
// Five 2MB photos as base64 plus update text. readBytes drains oversized requests.
const MAX_BODY = MAX_PHOTOS * Math.ceil(MAX_PHOTO_BYTES / 3) * 4 + 16000;

export default {
  'GET /api/work-orders/:id/updates': route(async (req, res) => {
    const workId = id(req.params.id);
    if (!get('SELECT id FROM work_orders WHERE id = ?', workId)) return send(res, 404, { error: 'Work order not found' });
    const updates = all('SELECT * FROM work_order_updates WHERE work_order_id = ? ORDER BY stage', workId);
    const photos = all(`SELECT p.id, p.update_id FROM work_update_photos p
      JOIN work_order_updates u ON u.id = p.update_id WHERE u.work_order_id = ? ORDER BY p.id`, workId);
    send(res, 200, updates.map((u) => ({ ...u, photos: photos.filter((p) => p.update_id === u.id).map((p) => p.id) })));
  }),

  'POST /api/work-orders/:id/updates': route(async (req, res) => {
    const raw = await readBytes(req, MAX_BODY);
    let body;
    try { body = JSON.parse(raw.toString('utf8')); } catch { return send(res, 400, { error: 'The request body is not valid JSON' }); }
    const job = get('SELECT * FROM work_orders WHERE id = ?', id(req.params.id));
    if (!job) return send(res, 404, { error: 'Work order not found' });
    if (job.status === 'done') return send(res, 400, { error: 'Reopen the job before adding an update' });
    if (typeof body?.message !== 'string' || !body.message.trim() || body.message.trim().length > 2000)
      return send(res, 400, { error: 'Write an update (up to 2000 characters)' });
    const hours = hoursValue(body.hours);
    if (hours.error) return send(res, 400, { error: hours.error });
    if (hours.missing || hours.value === null) return send(res, 400, { error: 'Enter time spent on this update' });
    const owner = body.assigned_to === undefined ? { value: job.assigned_to } : assigneeValue(body.assigned_to);
    if (owner.error) return send(res, 400, { error: owner.error });
    if (!owner.value) return send(res, 400, { error: 'Assign the job to someone before starting it' });
    if (body.photos !== undefined && !Array.isArray(body.photos)) return send(res, 400, { error: 'Invalid photos' });
    const photos = body.photos || [];
    if (photos.length > MAX_PHOTOS) return send(res, 400, { error: 'Choose up to five photos per update' });
    const files = [];
    try {
      for (const photo of photos) {
        if (typeof photo !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(photo)) {
          files.forEach(removePhoto); return send(res, 400, { error: 'Choose JPEG, PNG or WebP photos' });
        }
        const bytes = Buffer.from(photo.slice(photo.indexOf(',') + 1), 'base64');
        if (bytes.length > MAX_PHOTO_BYTES) { files.forEach(removePhoto); return send(res, 413, { error: 'Each photo must be under 2 MB' }); }
        const saved = savePhoto(bytes);
        if (saved.error) { files.forEach(removePhoto); return send(res, 400, { error: saved.error }); }
        files.push(saved.name);
      }
      const result = transaction(() => {
        const stage = Number(get('SELECT COALESCE(MAX(stage), 0) + 1 AS n FROM work_order_updates WHERE work_order_id = ?', job.id).n);
        const result = run('INSERT INTO work_order_updates (work_order_id, stage, message, hours, author) VALUES (?,?,?,?,?)',
          job.id, stage, body.message.trim(), hours.value, req.user.name);
        for (const name of files) run('INSERT INTO work_update_photos (update_id, filename) VALUES (?,?)', result.lastInsertRowid, name);
        run("UPDATE work_orders SET status = 'in_progress', assigned_to = ? WHERE id = ?", owner.value, job.id);
        return { id: Number(result.lastInsertRowid), stage };
      });
      send(res, 201, { ...result, status: 'in_progress', assigned_to: owner.value });
    } catch (e) { files.forEach(removePhoto); throw e; }
  }, { raw: true }),

  'GET /api/work-orders/:id/updates/:updateId/photos/:photoId': route(async (req, res) => {
    const photo = get(`SELECT p.filename FROM work_update_photos p JOIN work_order_updates u ON u.id = p.update_id
      WHERE p.id = ? AND u.id = ? AND u.work_order_id = ?`, id(req.params.photoId), id(req.params.updateId), id(req.params.id));
    const bytes = photo && readPhoto(photo.filename);
    if (!bytes) return send(res, 404, { error: 'Photo not found' });
    res.writeHead(200, { 'content-type': photoType(photo.filename), 'content-length': bytes.length, 'cache-control': 'private, max-age=86400' });
    res.end(bytes);
  }),
};
