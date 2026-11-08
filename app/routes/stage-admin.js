// Only the newest stage may be corrected or permanently deleted, and only by
// admins. The server enforces both rules even if someone bypasses the browser.
import { send, readBytes, route, id } from '../http.js';
import { all, get, run, transaction } from '../db.js';
import { hoursValue } from '../values.js';
import { useStock, returnStageStock } from '../part-usage.js';
import { effectiveHours } from '../hours.js';
import { MAX_STAGE_BODY, MAX_STAGE_PHOTOS, saveStagePhotos } from '../stage-photos.js';
import { removePhoto } from '../photos.js';

function latest(workId, updateId) {
  const job = get('SELECT * FROM work_orders WHERE id = ?', workId);
  const stage = get('SELECT * FROM work_order_updates WHERE id = ? AND work_order_id = ?', updateId, workId);
  if (!job || !stage) throw new Error('Stage or work order not found');
  const last = get('SELECT id FROM work_order_updates WHERE work_order_id = ? ORDER BY stage DESC LIMIT 1', workId);
  if (last?.id !== stage.id) throw new Error('Only the latest stage can be edited or deleted');
  return { job, stage };
}

function refreshJobStop(job, fallback) {
  const event = get('SELECT running FROM machine_state_events WHERE work_order_id = ? AND running IS NOT NULL ORDER BY id DESC LIMIT 1', job.id);
  const stops = event ? 1 - event.running : fallback;
  if (stops !== null && stops !== undefined) run('UPDATE work_orders SET stops_machine = ? WHERE id = ?', stops, job.id);
}

// A corrected stage may have been included in a previously reviewed total.
// Rebase that total to the corrected effective hours so a clamp at zero never
// swallows hours entered by a later stage.
function rebaseHours(job, previousTotal, oldHours, newHours) {
  if (job.labour_hours === null || oldHours === newHours) return;
  const total = Math.max(0, Math.round((previousTotal + newHours - oldHours) * 1e6) / 1e6);
  const stages = get('SELECT COALESCE(SUM(hours), 0) AS n FROM work_order_updates WHERE work_order_id = ?', job.id).n;
  run('UPDATE work_orders SET labour_hours = ?, labour_stage_baseline = ? WHERE id = ?', total, stages, job.id);
}
const currentHours = (job) => get(`SELECT ${effectiveHours()} AS total FROM work_orders w WHERE w.id = ?`, job.id).total;

function cleanupWarning(photos, action) {
  const remaining = photos.filter((p) => !removePhoto(p.filename)).map((p) => p.filename);
  return remaining.length ? `The stage was ${action}, but these files could not be removed from the server's photos folder: ${remaining.join(', ')}. Remove them manually.` : null;
}

export default {
  'PUT /api/work-orders/:id/updates/:updateId': route(async (req, res) => {
    if (req.user.role !== 'admin') return send(res, 403, { error: 'Only admins can edit stages' });
    const raw = await readBytes(req, MAX_STAGE_BODY);
    let body;
    try { body = JSON.parse(raw.toString('utf8')); } catch { return send(res, 400, { error: 'The request body is not valid JSON' }); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return send(res, 400, { error: 'Invalid stage update' });
    const workId = id(req.params.id), updateId = id(req.params.updateId);
    const { stage } = latest(workId, updateId);
    const message = body?.message === undefined ? stage.message : body.message;
    if (typeof message !== 'string' || !message.trim() || message.trim().length > 2000)
      return send(res, 400, { error: 'Write an update (up to 2000 characters)' });
    const hours = hoursValue(body.hours === undefined ? stage.hours : body.hours);
    if (hours.error || hours.value === null) return send(res, 400, { error: hours.error || 'Enter time spent on this update' });
    if (body.machine_running !== undefined && body.machine_running !== null && typeof body.machine_running !== 'boolean')
      return send(res, 400, { error: 'Choose whether the machine is running' });
    if (body.parts !== undefined && (!Array.isArray(body.parts) || body.parts.length > 50))
      return send(res, 400, { error: 'Choose up to 50 spare parts per update' });
    const oldPhotos = all('SELECT * FROM work_update_photos WHERE update_id = ? ORDER BY id', updateId);
    const keep = body.keep_photos === undefined ? oldPhotos.map((p) => p.id) : body.keep_photos;
    if (!Array.isArray(keep) || keep.some((x) => !Number.isInteger(x) || !oldPhotos.some((p) => p.id === x)) || new Set(keep).size !== keep.length)
      return send(res, 400, { error: 'Choose photos belonging to this stage' });
    const photos = body.photos === undefined ? [] : body.photos;
    if (!Array.isArray(photos) || keep.length + photos.length > MAX_STAGE_PHOTOS)
      return send(res, 400, { error: 'Choose up to five photos per update' });
    const files = [], removed = oldPhotos.filter((p) => !keep.includes(p.id));
    try {
      saveStagePhotos(photos, files);
      transaction(() => {
        const { job, stage: current } = latest(workId, updateId);
        const beforeHours = currentHours(job);
        if (body.parts !== undefined) {
          const names = returnStageStock(workId, updateId);
          useStock(workId, updateId, body.parts, names);
        }
        const running = body.machine_running === undefined ? current.machine_running
          : body.machine_running === null ? null : (body.machine_running ? 1 : 0);
        run(`UPDATE work_order_updates SET message = ?, hours = ?, machine_running = ?, edited_by = ?,
          edited_at = datetime('now') WHERE id = ?`, message.trim(), hours.value, running, req.user.name, updateId);
        rebaseHours(job, beforeHours, current.hours, hours.value);
        if (body.machine_running !== undefined && running !== current.machine_running) {
          const event = get('SELECT id FROM machine_state_events WHERE update_id = ?', updateId);
          // Keep the stage's original place; missing legacy events must not
          // invent a newer report that overrides later work on another job.
          if (event) run('UPDATE machine_state_events SET running = ? WHERE id = ?', running, event.id);
          refreshJobStop(job, current.prior_stops_machine);
        }
        for (const photo of removed) run('DELETE FROM work_update_photos WHERE id = ?', photo.id);
        for (const name of files) run('INSERT INTO work_update_photos (update_id, filename) VALUES (?,?)', updateId, name);
      });
    } catch (e) { files.forEach(removePhoto); if (e.status === 413) return send(res, 413, { error: e.message }); throw e; }
    const warning = cleanupWarning(removed, 'updated');
    send(res, 200, { ok: true, warning });
  }, { raw: true }),

  'DELETE /api/work-orders/:id/updates/:updateId': route(async (req, res) => {
    if (req.user.role !== 'admin') return send(res, 403, { error: 'Only admins can delete stages' });
    const workId = id(req.params.id), updateId = id(req.params.updateId);
    const photos = all('SELECT filename FROM work_update_photos WHERE update_id = ?', updateId);
    transaction(() => {
      const { job, stage } = latest(workId, updateId);
      const beforeHours = currentHours(job);
      returnStageStock(workId, updateId);
      run('DELETE FROM work_order_updates WHERE id = ?', updateId); // cascades state event and photos
      rebaseHours(job, beforeHours, stage.hours, 0);
      refreshJobStop(job, stage.prior_stops_machine);
      const remaining = get('SELECT COUNT(*) AS n FROM work_order_updates WHERE work_order_id = ?', workId).n;
      if (!remaining && job.status === 'in_progress') run("UPDATE work_orders SET status = 'open' WHERE id = ?", workId);
    });
    const warning = cleanupWarning(photos, 'deleted');
    send(res, 200, { ok: true, warning });
  }),
};
