// All-time machine service and current spare-parts inventory snapshots.
// A service event is one work order, regardless of status; costs are parts only.
import { all, get } from './db.js';
import { effectiveHours } from './hours.js';
import { workOrderCost } from './costs.js';
import { withStatus } from './status.js';
import { timeZone } from './settings.js';
const round = (n) => Math.round(Number(n) * 100) / 100;
const roundHours = (n) => Math.round(Number(n) * 1e6) / 1e6;
export function machineReport(id, search = '') {
  const query = String(search || '').trim().slice(0, 200), term = query.toLowerCase();
  const row = get('SELECT * FROM equipment WHERE id = ?', id);
  if (!row) return null;
  const machine = withStatus([row])[0];
  const jobs = all(`SELECT w.id, w.code, w.title, w.status, w.created_at, w.closed_at,
      COALESCE(${effectiveHours()}, 0) AS hours, ${workOrderCost()} AS cost
    FROM work_orders w WHERE w.equipment_id = ? ORDER BY w.created_at DESC, w.id DESC`, id)
    .filter(j => `${j.code || ''} ${j.title} ${j.status.replace('_', ' ')}`.toLowerCase().includes(term));
  const counts = { open: 0, in_progress: 0, done: 0 };
  for (const job of jobs) counts[job.status]++;
  return { machine, jobs, query, counts, total_jobs: jobs.length,
    total_hours: roundHours(jobs.reduce((n, j) => n + Number(j.hours), 0)),
    total_cost: round(jobs.reduce((n, j) => n + Number(j.cost), 0)), cost_basis: 'parts', time_zone: timeZone() };
}
export function inventoryReport(search = '') {
  const query = String(search || '').trim().slice(0, 200), term = query.toLowerCase();
  const parts = all('SELECT id, name, reference, qty, unit_price, supplier, reorder_level FROM parts ORDER BY name, id')
    .filter(p => `${p.name || ''} ${p.reference || ''} ${p.supplier || ''}`.toLowerCase().includes(term));
  return { parts, query, total_parts: parts.length, low_stock: parts.filter((p) => p.qty <= p.reorder_level).length,
    total_units: parts.reduce((n, p) => n + Number(p.qty), 0),
    known_stock_value: round(parts.reduce((n, p) => n + (p.unit_price == null ? 0 : Number(p.qty) * Number(p.unit_price)), 0)),
    missing_prices: parts.filter((p) => p.unit_price == null).length, time_zone: timeZone() };
}
