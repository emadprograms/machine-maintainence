// Workshop-wide settings stored in the database.
import { get, run } from './db.js';
import { validTimeZone } from './public/time-zone.js';

export const TIME_ZONE_KEY = 'time_zone';

export function getSetting(key, fallback = null) {
  const row = get('SELECT value FROM settings WHERE key = ?', key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  run(`INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value`, key, String(value));
}

/** Workshop-wide IANA time zone; legacy installations retain UTC. */
export function timeZone() {
  const zone = getSetting(TIME_ZONE_KEY, 'UTC');
  return validTimeZone(zone) ? zone : 'UTC';
}
