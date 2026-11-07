// Work order numbers: WO-2026-0001, one series per year.
//
// The database has ids and they are not the same thing. An id is how a row is
// found; a number is how a job is talked about — on a whiteboard, on the phone to
// a vendor, on a printed sheet that goes out to the machine. Serialized rather
// than random for exactly that reason: a person can see that 0007 came after 0006
// and that nothing is missing.

import { get } from './db.js';

/** `WO-2026-0007`. Past 9999 the number simply grows a digit. */
export const formatCode = (year, sequence) =>
  `WO-${year}-${String(sequence).padStart(4, '0')}`;

/** The next number for the year of `stamp`, which is a stored timestamp. */
export function nextWorkOrderCode(stamp) {
  const year = String(stamp).slice(0, 4);
  // Ordered by length first: WO-2026-10000 is longer than WO-2026-9999 and would
  // otherwise sort before it, which would hand out 10000 twice.
  const last = get(`SELECT code FROM work_orders WHERE code LIKE ?
                    ORDER BY LENGTH(code) DESC, code DESC LIMIT 1`, `WO-${year}-%`);
  const sequence = last ? Number(String(last.code).slice(-4)) + 1 : 1;
  return formatCode(year, sequence);
}
