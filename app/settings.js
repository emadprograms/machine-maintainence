// The handful of numbers a workshop can change without editing code.
//
// Today that is one: the hourly rate, used to turn recorded hours into money.
// It lives in the database rather than in the source so changing it is a form,
// not a deploy — and so the report can say which rate it used.
import { get, run } from './db.js';
import { validTimeZone } from './public/time-zone.js';

export const RATE_KEY = 'hourly_rate';
export const TIME_ZONE_KEY = 'time_zone';

export function getSetting(key, fallback = null) {
  const row = get('SELECT value FROM settings WHERE key = ?', key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  run(`INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value`, key, String(value));
}

/** The rate as a number. A missing or nonsensical row is zero, never NaN. */
export function hourlyRate() {
  const rate = Number(getSetting(RATE_KEY, '0'));
  return Number.isFinite(rate) && rate >= 0 ? rate : 0;
}

/** Workshop-wide IANA time zone; legacy installations retain UTC. */
export function timeZone() {
  const zone = getSetting(TIME_ZONE_KEY, 'UTC');
  return validTimeZone(zone) ? zone : 'UTC';
}
