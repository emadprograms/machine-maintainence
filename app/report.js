// One month of work: how many jobs, how long they took, and what they cost.
//
// The money is deliberately simple and honest: parts cost what was recorded when
// used, and labour is hours × one rate. Per-person rates or overtime would be a
// different product.
import { all, get } from './db.js';
import { hourlyRate, timeZone } from './settings.js';
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
  const rate = hourlyRate();
  const zone = timeZone();

  const totals = get(`SELECT COUNT(*) AS jobs, COALESCE(SUM(${effectiveHours()}), 0) AS hours
                      FROM work_orders w WHERE ${IN_MONTH}`, zone, start, zone, next);

  const parts = get(`SELECT COALESCE(SUM(wop.cost_total), 0) AS cost
                     FROM work_order_parts wop
                     JOIN work_orders w ON w.id = wop.work_order_id
                     JOIN parts p ON p.id = wop.part_id
                     WHERE ${IN_MONTH}`, zone, start, zone, next);

  const perMachine = all(`SELECT e.id, e.name, COUNT(*) AS jobs,
                                 COALESCE(SUM(${effectiveHours()}), 0) AS hours
                          FROM work_orders w
                          JOIN equipment e ON e.id = w.equipment_id
                          WHERE ${IN_MONTH}
                          GROUP BY e.id
                          ORDER BY jobs DESC, e.name`, zone, start, zone, next);

  // Parts per machine is a second query rather than a correlated subquery in the
  // GROUP BY: two readable queries beat one that needs explaining.
  const partsPerMachine = all(`SELECT w.equipment_id AS id,
                                      COALESCE(SUM(wop.cost_total), 0) AS cost
                               FROM work_order_parts wop
                               JOIN work_orders w ON w.id = wop.work_order_id
                               JOIN parts p ON p.id = wop.part_id
                               WHERE ${IN_MONTH}
                               GROUP BY w.equipment_id`, zone, start, zone, next);

  const partsByMachine = new Map(partsPerMachine.map((r) => [Number(r.id), Number(r.cost)]));

  const hours = Number(totals.hours);
  const partsCost = Number(parts.cost);
  const labourCost = round2(hours * rate);

  return {
    month: String(month),
    hourly_rate: rate,
    jobs: Number(totals.jobs),
    hours: round2(hours),
    parts_cost: round2(partsCost),
    labour_cost: labourCost,
    total: round2(partsCost + labourCost),
    // The machines that took the most work, which is the question behind the
    // question: what is failing, and where should the next hour go?
    machines: perMachine.map((m) => {
      const machineHours = Number(m.hours);
      const machineParts = partsByMachine.get(Number(m.id)) || 0;
      return {
        id: Number(m.id),
        name: m.name,
        jobs: Number(m.jobs),
        hours: round2(machineHours),
        parts_cost: round2(machineParts),
        labour_cost: round2(machineHours * rate),
        total: round2(machineParts + machineHours * rate),
      };
    }),
  };
}
