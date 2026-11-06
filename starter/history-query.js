// The filter behind the History screen and a machine's own history.
//
// It lives here, not inline in a route, for one reason: phase 15 would otherwise
// reimplement "closed between two dates" for the CSV export, and a screen and a
// file that are built from two copies of a filter drift apart silently. The
// export and the screen call this.
import { parseDay } from './dates.js';

/** Rows a screen will show. The total is returned separately so a cut list says so. */
export const MAX_ROWS = 500;

export function historyFilter(query = {}) {
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
  // A closed date range. Compared with date() on both sides so a timestamp in
  // the column and a plain day from a form compare as days, not strings.
  const from = query.from ? parseDay(String(query.from), 'From') : null;
  if (from?.error) return { error: from.error };
  const to = query.to ? parseDay(String(query.to), 'To') : null;
  if (to?.error) return { error: to.error };

  if (from?.value && to?.value && from.value > to.value) {
    return { error: 'The start of the range is after its end' };
  }
  if (from?.value) {
    where.push('date(w.closed_at) >= date(?)');
    params.push(from.value);
  }
  if (to?.value) {
    where.push('date(w.closed_at) <= date(?)');
    params.push(to.value);
  }

  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

/** The one SELECT behind both history views. */
export function historySql(filter, limit = MAX_ROWS) {
  return {
    rows: `
      SELECT w.id, w.title, w.status, w.priority, w.created_at, w.closed_at,
             e.id AS equipment_id, e.name AS equipment_name, u.name AS owner
      FROM work_orders w
      JOIN equipment e ON e.id = w.equipment_id
      LEFT JOIN users u ON u.id = w.assigned_to
      ${filter.sql}
      -- newest first, whether the job is closed or still running, so one
      -- machine's history reads as a timeline rather than two lists
      ORDER BY COALESCE(w.closed_at, w.created_at) DESC, w.id DESC
      LIMIT ${Number(limit)}`,
    total: `SELECT COUNT(*) AS n FROM work_orders w ${filter.sql}`,
  };
}
