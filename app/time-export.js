import { zoneDateTime } from './public/time-zone.js';

// Label each exported instant: CSV files can be read away from the app settings.
export function exportTimes(rows, zone, keys) {
  return rows.map((row) => {
    const result = { ...row };
    for (const key of keys) if (row[key]) {
      const local = zoneDateTime(row[key], zone);
      result[key] = local ? `${local} ${zone}` : row[key];
    }
    return result;
  });
}
