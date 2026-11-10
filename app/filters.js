// How every list in this app is narrowed, in one place.
//
// The reason this file exists: a screen and its CSV export must never disagree
// about what "these work orders" means. They call the same function here and
// differ only in what they do with the rows. Two copies of a filter drift the
// moment one of them grows a new field.
import { parseDay } from './dates.js';
import { IN_SERVICE_SQL, RETIRED_SQL } from './status.js';

/**
 * A LIKE pattern built from what somebody typed.
 *
 * `%` and `_` are wildcards to LIKE, so a search for "50%" would otherwise match
 * everything. They are escaped and the queries say `ESCAPE '\'`, which means a
 * literal percent sign searches for a literal percent sign.
 */
export function likeParam(text) {
  const escaped = String(text).trim().replace(/[\\%_]/g, (c) => `\\${c}`);
  return `%${escaped}%`;
}

const whereOf = (where, params) => ({
  sql: where.length ? `WHERE ${where.join(' AND ')}` : '',
  params,
});

// ------------------------------------------------------------ work orders
export function workOrderFilter(query = {}) {
  const where = [];
  const params = [];

  if (query.status) { where.push('w.status = ?'); params.push(String(query.status)); }
  if (query.equipment_id) { where.push('w.equipment_id = ?'); params.push(Number(query.equipment_id)); }
  if (query.assigned_to) { where.push('w.assigned_to = ?'); params.push(Number(query.assigned_to)); }
  if (query.q) {
    // One box over the problem, the notes and the machine's name, because that
    // is how a job is remembered: "the oil leak on the lathe".
    where.push(`(w.title LIKE ? ESCAPE '\\' OR w.notes LIKE ? ESCAPE '\\'
                 OR e.name LIKE ? ESCAPE '\\')`);
    const p = likeParam(query.q);
    params.push(p, p, p);
  }

  return whereOf(where, params);
}

// ---------------------------------------------------------------- machines
export function equipmentFilter(query = {}) {
  const where = [];
  const params = [];

  if (query.q) {
    where.push(`(e.name LIKE ? ESCAPE '\\' OR e.asset_tag LIKE ? ESCAPE '\\'
                 OR e.location LIKE ? ESCAPE '\\' OR e.category LIKE ? ESCAPE '\\'
                 OR e.model LIKE ? ESCAPE '\\' OR e.serial_number LIKE ? ESCAPE '\\')`);
    const p = likeParam(query.q);
    params.push(p, p, p, p, p, p);
  }
  // Retired machines are not offered for new work (261106-eqt). The screen asks with
  // ?service=active; no parameter still means everything, so nothing that already
  // called this list changes behaviour.
  if (query.service === 'active') where.push(IN_SERVICE_SQL);
  if (query.service === 'retired') where.push(RETIRED_SQL);
  // No `status` clause here on purpose: `down` is derived from the work orders, so
  // the route filters the finished list instead. `service` is the stored column.

  return whereOf(where, params);
}

// ------------------------------------------------------------------- parts
export function partsFilter(query = {}) {
  // The three used to be alternatives: asking for low stock and a search at the same
  // time silently dropped the search, so typing a name to narrow the order list gave
  // you every part in the workshop. They are clauses now, and they add up.
  const where = [];
  const params = [];
  if (query.low) where.push('p.qty <= p.reorder_level');
  if (query.out) where.push('p.qty <= 0');
  if (query.q) {
    where.push(`(p.name LIKE ? ESCAPE '\\' OR p.reference LIKE ? ESCAPE '\\')`);
    params.push(likeParam(query.q), likeParam(query.q));
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

// ----------------------------------------------------------------- history
/** Rows a screen will show. The total is counted separately so a cut list says so. */
export const MAX_ROWS = 500;

export function historyFilter(query = {}, zone = 'UTC') {
  const where = [];
  const params = [];

  if (query.equipment_id) {
    where.push('w.equipment_id = ?');
    params.push(Number(query.equipment_id));
  }
  if (query.status) {
    where.push('w.status = ?');
    params.push(String(query.status));
  }
  if (query.q) {
    where.push(`(w.title LIKE ? ESCAPE '\\' OR w.notes LIKE ? ESCAPE '\\'
                 OR e.name LIKE ? ESCAPE '\\')`);
    const p = likeParam(query.q);
    params.push(p, p, p);
  }

  // Closed-date filters use the selected workshop calendar, not the UTC day.
  const from = query.from ? parseDay(String(query.from), 'From') : null;
  if (from?.error) return { error: from.error };
  const to = query.to ? parseDay(String(query.to), 'To') : null;
  if (to?.error) return { error: to.error };

  if (from?.value && to?.value && from.value > to.value) {
    return { error: 'The start of the range is after its end' };
  }
  if (from?.value) {
    where.push('workshop_day(w.closed_at, ?) >= ?');
    params.push(zone, from.value);
  }
  if (to?.value) {
    where.push('workshop_day(w.closed_at, ?) <= ?');
    params.push(zone, to.value);
  }

  return whereOf(where, params);
}

/** The one SELECT behind both history views and the history export. */
export function historySql(filter, limit = MAX_ROWS) {
  return {
    rows: `
      SELECT w.id, w.code, w.title, w.status, w.priority, w.created_at, w.closed_at,
             w.resolution, w.verified_by,
             e.id AS equipment_id, e.name AS equipment_name, u.name AS owner
      FROM work_orders w
      JOIN equipment e ON e.id = w.equipment_id
      LEFT JOIN users u ON u.id = w.assigned_to
      ${filter.sql}
      -- newest first, whether the job is closed or still running, so one
      -- machine's history reads as a timeline rather than two lists
      ORDER BY COALESCE(w.closed_at, w.created_at) DESC, w.id DESC
      LIMIT ${Number(limit)}`,
    total: `SELECT COUNT(*) AS n FROM work_orders w
            JOIN equipment e ON e.id = w.equipment_id ${filter.sql}`,
  };
}
