// Shared, parameterised history table query. The same filtered rows feed the
// screen, CSV and printable snapshot. Calendar days use the workshop time zone.
import { all } from './db.js';
import { parseDay } from './dates.js';
import { likeParam } from './filters.js';
import { effectiveHours } from './hours.js';
import { workOrderCost } from './costs.js';
import { timeZone } from './settings.js';

export function historyTable(query = {}) {
  const view = String(query.view || '');
  if (!['machine', 'work', 'maintenance'].includes(view)) return { error: 'Choose machine, work or maintenance history' };
  const from = query.from ? parseDay(String(query.from), 'From') : null;
  const to = query.to ? parseDay(String(query.to), 'To') : null;
  if (from?.error || to?.error) return { error: from?.error || to?.error };
  if (from?.value && to?.value && from.value > to.value) return { error: 'The start of the range is after its end' };
  const rawIds = String(query.machines || '');
  if (rawIds && (!/^\d+(,\d+)*$/.test(rawIds) || rawIds.split(',').length > 200)) return { error: 'Choose up to 200 valid machines' };
  const ids = rawIds ? [...new Set(rawIds.split(',').map(Number))] : [];
  if (ids.some((v) => !Number.isSafeInteger(v) || v < 1)) return { error: 'Invalid machine selection' };
  const category = String(query.category || '').trim();
  const search = String(query.q || '').trim();
  if (category.length > 200 || search.length > 200) return { error: 'Filter is too long' };
  const status = String(query.status || '');
  if (status && !['open', 'in_progress', 'done'].includes(status)) return { error: 'Invalid work order status' };
  const zone = timeZone();
  const clauses = [], params = [];
  if (ids.length) { clauses.push(`e.id IN (${ids.map(() => '?').join(',')})`); params.push(...ids); }
  if (category) { clauses.push('e.category = ?'); params.push(category); }
  const workWhere = [...clauses], workParams = [...params];
  if (status) { workWhere.push('w.status = ?'); workParams.push(status); }
  if (search) { const p = likeParam(search); workWhere.push("(w.code LIKE ? ESCAPE '\\' OR w.title LIKE ? ESCAPE '\\' OR w.notes LIKE ? ESCAPE '\\' OR w.resolution LIKE ? ESCAPE '\\' OR e.name LIKE ? ESCAPE '\\')"); workParams.push(p, p, p, p, p); }
  // Inclusive overlap: started by the end and not closed before the start.
  // Open jobs have no closing date and remain active through the present.
  if (from?.value) { workWhere.push('(w.closed_at IS NULL OR workshop_day(w.closed_at, ?) >= ?)'); workParams.push(zone, from.value); }
  if (to?.value) { workWhere.push('workshop_day(w.created_at, ?) <= ?'); workParams.push(zone, to.value); }
  const where = (conditions) => conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const work = view === 'maintenance' ? [] : all(`SELECT 'work' AS kind, w.id, w.code, w.title, w.status, w.priority,
    e.id AS equipment_id, e.name AS equipment_name, e.category, u.name AS owner,
    w.resolution, w.created_at, w.closed_at,
    workshop_day(w.created_at, ?) AS opened_day,
    workshop_day((SELECT MIN(s.created_at) FROM work_order_updates s WHERE s.work_order_id=w.id), ?) AS start_day,
    workshop_day(w.closed_at, ?) AS end_day,
    COALESCE(${effectiveHours()}, 0) AS hours, ${workOrderCost()} AS cost, 'parts' AS cost_basis
    FROM work_orders w JOIN equipment e ON e.id=w.equipment_id
    LEFT JOIN users u ON u.id=w.assigned_to ${where(workWhere)}`, zone, zone, zone, ...workParams);
  let maintenance = [];
  if (view !== 'work' && (!status || status === 'done')) {
    const pmWhere = [...clauses], pmParams = [...params];
    if (search) { const p = likeParam(search); pmWhere.push("(s.task LIKE ? ESCAPE '\\' OR e.name LIKE ? ESCAPE '\\')"); pmParams.push(p, p); }
    if (from?.value) { pmWhere.push('p.completed_on >= ?'); pmParams.push(from.value); }
    if (to?.value) { pmWhere.push('p.completed_on <= ?'); pmParams.push(to.value); }
    maintenance = all(`SELECT 'maintenance' AS kind, p.id, NULL AS code, s.task AS title,
      'done' AS status, NULL AS priority, e.id AS equipment_id, e.name AS equipment_name,
      e.category, u.name AS owner, NULL AS resolution, NULL AS created_at, NULL AS closed_at,
      NULL AS opened_day, NULL AS start_day, p.completed_on AS end_day, NULL AS hours, NULL AS cost, p.source
      FROM pm_completions p JOIN pm_schedule s ON s.id=p.schedule_id
      JOIN equipment e ON e.id=s.equipment_id LEFT JOIN users u ON u.id=p.recorded_by
      ${where(pmWhere)}`, ...pmParams);
  }
  const rows = [...work, ...maintenance].sort((a, b) =>
    String(b.end_day || b.start_day || b.opened_day || '').localeCompare(String(a.end_day || a.start_day || a.opened_day || '')) || b.id - a.id);
  return { view, rows, total: rows.length, time_zone: zone };
}
