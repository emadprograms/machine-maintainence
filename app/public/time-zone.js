// All stored timestamps are UTC. Calendar-only values are not instants and are
// never shifted. The same formatter is used in the browser and server exports.
let displayZone = 'UTC';
const formatters = new Map();
export function validTimeZone(zone) {
  if (typeof zone !== 'string' || !zone.trim() || zone.length > 100) return false;
  if (formatters.has(zone)) return true;
  try { new Intl.DateTimeFormat('en-GB', { timeZone: zone }).format(new Date()); return true; }
  catch { return false; }
}
export function setDisplayZone(zone) {
  if (!validTimeZone(zone)) throw new RangeError(`This browser does not support the workshop time zone: ${zone}`);
  displayZone = zone;
}
export function getDisplayZone() { return displayZone; }
function formatter(zone) {
  if (!formatters.has(zone)) formatters.set(zone, new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }));
  return formatters.get(zone);
}
function parts(value, zone) {
  const date = value instanceof Date ? value : new Date(String(value).replace(' ', 'T') + (/Z$|[+-]\d\d:\d\d$/.test(String(value)) ? '' : 'Z'));
  if (!Number.isFinite(date.getTime()) || !validTimeZone(zone)) return null;
  return Object.fromEntries(formatter(zone).formatToParts(date).map((p) => [p.type, p.value]));
}
export function zoneDate(value, zone = displayZone) {
  if (value == null || value === '') return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const p = parts(value, zone);
  return p ? `${p.year}-${p.month}-${p.day}` : null;
}
export function zoneDateTime(value, zone = displayZone) {
  if (value == null || value === '') return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const p = parts(value, zone);
  return p ? `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}` : null;
}
export function todayInZone(zone = displayZone) { return zoneDate(new Date(), zone); }
