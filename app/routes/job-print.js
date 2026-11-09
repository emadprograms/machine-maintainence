// A fresh, authenticated snapshot for one printable job; never trust a stale
// table row or silently omit updates when a second request fails.
import { send, route, id } from '../http.js';
import { all, get } from '../db.js';
import { effectiveHours } from '../hours.js';
import { timeZone } from '../settings.js';
import { workOrderCost } from '../costs.js';
import { isVideo } from '../media.js';

export default {
  'GET /api/work-orders/:id/print': route(async (req, res) => {
    const workId = id(req.params.id);
    const job = get(`SELECT w.*, e.name AS equipment_name, e.asset_tag AS barcode,
      e.category AS equipment_category, e.location AS equipment_location,
      e.manufacturer AS equipment_manufacturer, e.model AS equipment_model, e.serial_number AS equipment_serial_number, u.name AS assignee_name,
      ${effectiveHours()} AS effective_hours,
      (SELECT running FROM machine_state_events WHERE work_order_id = w.id AND running IS NOT NULL ORDER BY id DESC LIMIT 1) AS last_reported_running,
      (SELECT COALESCE(SUM(cost_total), 0) FROM work_order_parts WHERE work_order_id = w.id) AS parts_cost,
      ROUND((SELECT COALESCE(SUM(cost_total), 0) FROM work_order_parts WHERE work_order_id = w.id), 2) AS parts_cost_display,
      ${workOrderCost()} AS total_cost
      FROM work_orders w JOIN equipment e ON e.id = w.equipment_id
      LEFT JOIN users u ON u.id = w.assigned_to WHERE w.id = ?`, workId);
    if (!job) return send(res, 404, { error: 'Work order not found' });
    const updates = all('SELECT * FROM work_order_updates WHERE work_order_id = ? ORDER BY stage', workId);
    const photos = all(`SELECT p.id, p.update_id, p.filename FROM work_update_photos p
      JOIN work_order_updates u ON u.id = p.update_id WHERE u.work_order_id = ? ORDER BY p.id`, workId);
    const reports = all(`SELECT r.id, r.update_id, r.original_name FROM work_update_reports r JOIN work_order_updates u ON u.id = r.update_id WHERE u.work_order_id = ?`, workId);
    const stageParts = all(`SELECT p.* FROM work_update_parts p JOIN work_order_updates u ON u.id = p.update_id
      WHERE u.work_order_id = ? ORDER BY p.id`, workId);
    const parts = all(`SELECT p.name, p.reference, wp.qty, wp.cost_total, ROUND(wp.cost_total, 2) AS display_cost FROM work_order_parts wp
      JOIN parts p ON p.id = wp.part_id WHERE wp.work_order_id = ? ORDER BY p.name`, workId);
    send(res, 200, { job, parts, cost_basis: 'parts', time_zone: timeZone(), updates: updates.map((u) => ({ ...u,
      photos: photos.filter((p) => p.update_id === u.id).map((p) => p.id),
      photo_videos: photos.filter((p) => p.update_id === u.id && isVideo(p.filename)).map((p) => p.id),
      report: reports.find((r) => r.update_id === u.id) || null,
      parts: stageParts.filter((p) => p.update_id === u.id) })) });
  }),
};
