// The two date shapes this app uses, in one place.
//
// A timestamp is what SQLite's datetime('now') writes ("2026-11-06 15:26:57"),
// stored as text so it sorts as text. A day is what a date input sends
// ("2026-11-06"). They were inline in server.js until the History screen needed
// the same validation; one copy is the point.

/** The current moment, in the same shape datetime('now') writes. */
export function nowStamp() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

/** A calendar date as YYYY-MM-DD, or an error naming the field.
 *  Round-trips through Date so 2026-02-30 is refused rather than rolled into March. */
export function parseDay(raw, field = 'date') {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { error: `${field} must be a date written as YYYY-MM-DD` };
  }
  const d = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw) {
    return { error: `${field} is not a real calendar date` };
  }
  return { value: raw };
}
