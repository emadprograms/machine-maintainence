// Append-only stages. Starting and recording Stage 1 happen in one transaction.
import { send, readBytes, route, id } from '../http.js';
import { all, get, run, transaction } from '../db.js';
import { assigneeValue, hoursValue } from '../values.js';
import { useStock } from '../part-usage.js';
import { recordMachineState } from '../status.js';
import { removePhoto } from '../photos.js';
import { sendFile, isVideo } from '../media.js';
import { ownedUploads, consumeUploads } from '../uploads.js';
import { MAX_STAGE_BODY, saveStagePhotos } from '../stage-photos.js';

export default {
  'GET /api/work-orders/:id/updates': route(async (req, res) => {
    const workId = id(req.params.id);
    if (!get('SELECT id FROM work_orders WHERE id = ?', workId)) return send(res, 404, { error: 'Work order not found' });
    const updates = all('SELECT * FROM work_order_updates WHERE work_order_id = ? ORDER BY stage', workId);
    const photos = all(`SELECT p.id, p.update_id, p.filename FROM work_update_photos p
      JOIN work_order_updates u ON u.id = p.update_id WHERE u.work_order_id = ? ORDER BY p.id`, workId);
    const reports = all(`SELECT r.id, r.update_id, r.original_name FROM work_update_reports r JOIN work_order_updates u ON u.id = r.update_id WHERE u.work_order_id = ?`, workId);
    const parts = all(`SELECT p.* FROM work_update_parts p JOIN work_order_updates u ON u.id = p.update_id
      WHERE u.work_order_id = ? ORDER BY p.id`, workId);
    send(res, 200, updates.map((u) => ({ ...u, photos: photos.filter((p) => p.update_id === u.id).map((p) => p.id),
      photo_videos: photos.filter((p) => p.update_id === u.id && isVideo(p.filename)).map((p) => p.id),
      report: reports.find((r) => r.update_id === u.id) || null,
      parts: parts.filter((p) => p.update_id === u.id) })));
  }),

  'POST /api/work-orders/:id/updates': route(async (req, res) => {
    const raw = await readBytes(req, MAX_STAGE_BODY);
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
    const parts = body.parts === undefined ? [] : body.parts;
    if (!Array.isArray(parts) || parts.length > 50) return send(res, 400, { error: 'Choose up to 50 spare parts per update' });
    if (body.machine_running !== undefined && body.machine_running !== null && typeof body.machine_running !== 'boolean')
      return send(res, 400, { error: 'Choose whether the machine is running, or leave it unchanged' });
    const running = body.machine_running == null ? null : (body.machine_running ? 1 : 0);
    const uploads = ownedUploads(body.upload_ids || [], Number(req.user.sub), 'media');
    const reports = ownedUploads(body.report_upload_id ? [body.report_upload_id] : [], Number(req.user.sub), 'report');
    if (photos.length + uploads.length > 5) return send(res, 400, { error: 'Choose up to five media files per update' });
    const files = [];
    let result;
    try {
      saveStagePhotos(photos, files);
      result = transaction(() => {
        const fresh = get('SELECT * FROM work_orders WHERE id = ?', job.id);
        if (!fresh || fresh.status === 'done') throw new Error('Work order is no longer open');
        const stage = Number(get('SELECT COALESCE(MAX(stage), 0) + 1 AS n FROM work_order_updates WHERE work_order_id = ?', job.id).n);
        const result = run('INSERT INTO work_order_updates (work_order_id, stage, message, hours, author, machine_running, prior_stops_machine) VALUES (?,?,?,?,?,?,?)',
          job.id, stage, body.message.trim(), hours.value, req.user.name, running, job.stops_machine);
        useStock(job.id, result.lastInsertRowid, parts);
        recordMachineState(job.equipment_id, job.id, result.lastInsertRowid, running, 'stage');
        for (const name of [...files, ...uploads.map((u) => u.filename)]) run('INSERT INTO work_update_photos (update_id, filename) VALUES (?,?)', result.lastInsertRowid, name);
        if (reports.length) run('INSERT INTO work_update_reports (update_id, filename, original_name) VALUES (?,?,?)', result.lastInsertRowid, reports[0].filename, reports[0].original_name);
        consumeUploads([...uploads, ...reports]);
        run("UPDATE work_orders SET status = 'in_progress', assigned_to = ?, stops_machine = COALESCE(?, stops_machine) WHERE id = ?",
          owner.value, running === null ? null : 1 - running, job.id);
        return { id: Number(result.lastInsertRowid), stage };
      });
    } catch (e) { files.forEach(removePhoto); if (e.status === 413) return send(res, 413, { error: e.message }); throw e; }
    send(res, 201, { ...result, status: 'in_progress', assigned_to: owner.value });
  }, { raw: true }),

  'GET /api/work-orders/:id/updates/:updateId/photos/:photoId': route(async (req, res) => {
    const photo = get(`SELECT p.filename FROM work_update_photos p JOIN work_order_updates u ON u.id = p.update_id
      WHERE p.id = ? AND u.id = ? AND u.work_order_id = ?`, id(req.params.photoId), id(req.params.updateId), id(req.params.id));
    if (!photo || !sendFile(req, res, photo.filename)) return send(res, 404, { error: 'Media not found' });
  }),
  'GET /api/work-orders/:id/updates/:updateId/report': route(async (req, res) => {
    const report = get(`SELECT r.filename, r.original_name FROM work_update_reports r JOIN work_order_updates u ON u.id = r.update_id
      WHERE u.id = ? AND u.work_order_id = ?`, id(req.params.updateId), id(req.params.id));
    if (!report || !sendFile(req, res, report.filename, { downloadName: report.original_name })) return send(res, 404, { error: 'Report not found' });
  }),
};
