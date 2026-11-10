// One month of work: how many jobs, how long they took, and what they cost.
//
// Money is recorded parts only; service hours are reported separately.
import { all, get } from './db.js';
import { timeZone } from './settings.js';
import { workOrderCost } from './costs.js';
import { effectiveHours } from './hours.js';

const MONTH = /^\d{4}-\d{2}$/;
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * A month as a half-open range: 2026-11 covers 2026-11-01 up to, but not
 * including, 2026-12-01. Half-open means no job can land in two months, and
 * February does not need special handling.
 */
export function monthRange(month) {
  const text = String(month ?? '');
  if (!MONTH.test(text)) return { error: 'Month must be written as YYYY-MM' };
  const [year, monthNumber] = text.split('-').map(Number);
  if (monthNumber < 1 || monthNumber > 12) return { error: 'Month must be written as YYYY-MM' };
  const next = monthNumber === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(monthNumber + 1).padStart(2, '0')}-01`;
  return { start: `${text}-01`, next };
}

// A job counts when it is done AND its closing date falls in the month. Both,
// because a job can be marked done long after it was closed and the date is the
// thing the owner is asking about.
const IN_MONTH = `w.status = 'done'
  AND workshop_day(w.closed_at, ?) >= ? AND workshop_day(w.closed_at, ?) < ?`;

export function monthReport(month) {
  const range = monthRange(month);
  if (range.error) return range;
  const { start, next } = range;
  const zone = timeZone();

  const totals = get(`SELECT COUNT(*) AS jobs, COALESCE(SUM(${effectiveHours()}), 0) AS hours
                      FROM work_orders w WHERE ${IN_MONTH}`, zone, start, zone, next);

  // Sum the same rounded job costs that appear on the work-order list.
  const costs = get(`SELECT COALESCE(SUM(${workOrderCost()}), 0) AS cost
                     FROM work_orders w WHERE ${IN_MONTH}`, zone, start, zone, next);
  const perMachine = all(`SELECT e.id, e.name, COUNT(*) AS jobs,
                                 COALESCE(SUM(${effectiveHours()}), 0) AS hours,
                                 COALESCE(SUM(${workOrderCost()}), 0) AS cost
                          FROM work_orders w JOIN equipment e ON e.id = w.equipment_id
                          WHERE ${IN_MONTH} GROUP BY e.id
                          ORDER BY jobs DESC, e.name`, zone, start, zone, next);
  const hours = Number(totals.hours);
  const partsCost = round2(Number(costs.cost));

  return {
    month: String(month),
    cost_basis: 'parts',
    jobs: Number(totals.jobs),
    hours: round2(hours),
    parts_cost: partsCost,
    total: partsCost,
    // The machines that took the most work, which is the question behind the
    // question: what is failing, and where should the next hour go?
    machines: perMachine.map((m) => {
      const machineHours = Number(m.hours);
      const machineParts = round2(Number(m.cost));
      return {
        id: Number(m.id),
        name: m.name,
        jobs: Number(m.jobs),
        hours: round2(machineHours),
        parts_cost: machineParts,
        total: machineParts,
      };
    }),
  };
}
