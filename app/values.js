// Turning what a browser sends into what the database may store.
//
// Every function returns { value } or { error } — never a silently corrected
// value. Turning -5 into 0 would hide the data-entry mistake rather than report
// it, and the person who typed it would never learn.

import { get } from './db.js';

/** Nothing in a workshop has a million of anything; a number past this is a typo
 *  or an attack, and either way it is refused rather than stored. */
const MAX_COUNT = 1_000_000;
export function stockValue(raw, fallback) {
  if (raw === undefined || raw === null || raw === '') return { value: fallback };
  const n = Number(raw);
  if (!Number.isInteger(n)) return { error: 'Quantity must be a whole number' };
  if (n < 0) return { error: 'Quantity cannot be negative' };
  if (n > MAX_COUNT) return { error: 'Quantity is unrealistically large' };
  return { value: n };
}

/**
 * Time spent on a job. `undefined` means "not mentioned" (leave it alone),
 * empty means "clear it", and anything else must be a number that a human could
 * have worked. Nullable on purpose: a job nobody has costed is not a job that
 * took zero hours.
 */
export function hoursValue(raw) {
  if (raw === undefined) return { missing: true };
  if (raw === null || raw === '') return { value: null };
  const n = Number(raw);
  if (!Number.isFinite(n)) return { error: 'Hours must be a number' };
  if (n < 0) return { error: 'Hours cannot be negative' };
  if (n > 10000) return { error: 'Hours must be under 10000 for one job' };
  return { value: n };
}

/** A user id to own a job, or null to unassign. Validated against the table so a
 *  bad id is a sentence, not "FOREIGN KEY constraint failed". */
export function assigneeValue(raw) {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return { error: 'That person does not exist' };
  if (!get('SELECT id FROM users WHERE id = ?', n)) return { error: 'That person does not exist' };
  return { value: n };
}

/** A non-negative money value, or null to clear it. */
export function priceValue(raw) {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  const n = Number(raw);
  if (!Number.isFinite(n)) return { error: 'Unit price must be a number' };
  if (n < 0) return { error: 'Unit price cannot be negative' };
  return { value: n };
}
