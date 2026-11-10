// Current recorded usage, not a stock ledger. Stage lines have dates and actual
// prices; older/direct job usage has neither an independently recorded date nor
// a per-use price. Subtract stage lines from the job aggregate to avoid doubles.
import { all } from './db.js';
import { parseDay } from './dates.js';
import { likeParam } from './filters.js';
import { timeZone } from './settings.js';

export function partsHistory(query = {}) {
  const from = query.from ? parseDay(String(query.from), 'From') : null;
  const to = query.to ? parseDay(String(query.to), 'To') : null;
  if (from?.error || to?.error) return { error: from?.error || to?.error };
  if (from?.value && to?.value && from.value > to.value) return { error: 'The start of the range is after its end' };
  const ids = (value, name) => {
    const raw = String(value || '');
    if (!raw) return [];
    if (!/^\d+(,\d+)*$/.test(raw) || raw.split(',').length > 200) throw new Error(`Choose up to 200 valid ${name}`);
    const result = [...new Set(raw.split(',').map(Number))];
    if (result.some(n => !Number.isSafeInteger(n) || n < 1)) throw new Error(`Invalid ${name} selection`);
    return result;
  };
  let machines, parts;
  try { machines = ids(query.machines, 'machines'); parts = ids(query.parts, 'parts'); }
  catch (error) { return { error: error.message }; }
  const category = String(query.category || '').trim(), search = String(query.q || '').trim();
  if (category.length > 200 || search.length > 200) return { error: 'Filter is too long' };
  const zone = timeZone(), conditions = [], params = [zone];
  if (machines.length) { conditions.push(`equipment_id IN (${machines.map(() => '?').join(',')})`); params.push(...machines); }
  if (parts.length) { conditions.push(`part_id IN (${parts.map(() => '?').join(',')})`); params.push(...parts); }
  if (category) { conditions.push('category = ?'); params.push(category); }
  if (search) { conditions.push("(part_name LIKE ? ESCAPE '\\' OR reference LIKE ? ESCAPE '\\' OR equipment_name LIKE ? ESCAPE '\\' OR code LIKE ? ESCAPE '\\' OR title LIKE ? ESCAPE '\\')"); const p = likeParam(search); params.push(p,p,p,p,p); }
  if (from?.value) { conditions.push('event_day >= ?'); params.push(from.value); }
  if (to?.value) { conditions.push('event_day <= ?'); params.push(to.value); }
  const rows = all(`WITH stage_totals AS (
    SELECT u.work_order_id, p.part_id, SUM(p.qty) AS qty
    FROM work_update_parts p JOIN work_order_updates u ON u.id=p.update_id GROUP BY u.work_order_id,p.part_id
  ), usage AS (
    SELECT 'stage' AS source, p.id, p.part_id, p.part_name, catalog.reference,
      e.id AS equipment_id, e.name AS equipment_name, e.category, w.id AS work_id, w.code, w.title,
      u.stage, workshop_day(u.created_at, ?) AS event_day, p.qty, p.unit_price, p.qty*p.unit_price AS cost
    FROM work_update_parts p JOIN work_order_updates u ON u.id=p.update_id
    JOIN work_orders w ON w.id=u.work_order_id JOIN equipment e ON e.id=w.equipment_id
    JOIN parts catalog ON catalog.id=p.part_id
    UNION ALL
    SELECT 'undated' AS source, NULL AS id, p.id AS part_id, p.name AS part_name, p.reference,
      e.id AS equipment_id, e.name AS equipment_name, e.category, w.id AS work_id, w.code, w.title,
      NULL AS stage, NULL AS event_day, wp.qty-COALESCE(st.qty,0) AS qty, NULL AS unit_price,
      NULL AS cost
    FROM work_order_parts wp JOIN parts p ON p.id=wp.part_id JOIN work_orders w ON w.id=wp.work_order_id
    JOIN equipment e ON e.id=w.equipment_id LEFT JOIN stage_totals st ON st.work_order_id=wp.work_order_id AND st.part_id=wp.part_id
    WHERE wp.qty>COALESCE(st.qty,0)
  ) SELECT * FROM usage ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
  ORDER BY event_day DESC, work_id DESC, part_name`, ...params);
  return { view: 'parts', rows, total: rows.length, time_zone: zone };
}
