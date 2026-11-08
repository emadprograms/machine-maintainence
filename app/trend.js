// Six months, for the charts on the dashboard.
//
// The dashboard's cards answer "what needs doing today". They cannot answer the
// question people actually ask next — "is this getting better or worse?" — because
// one number has no direction. This file supplies the direction.
//
// It does not do its own arithmetic. Each month is passed through report.js, the
// same function behind the Report screen, so a bar on the dashboard and the total
// on that screen cannot disagree. Six months of queries per dashboard load is
// nothing on a local database, and being wrong is expensive.

import { monthReport } from './report.js';
import { timeZone } from './settings.js';
import { zoneDate } from './public/time-zone.js';

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The last `count` months, oldest first — the order a chart reads in.
 *
 * Returns one small object per month. `label` is what goes under the bar;
 * `month` stays `YYYY-MM` so a chart can name the exact period in a tooltip or
 * an accessible description.
 */
export function monthlyTrend(count = 6, now = new Date()) {
  const months = [];
  const [year, month] = zoneDate(now, timeZone()).split('-').map(Number);
  for (let back = count - 1; back >= 0; back -= 1) {
    // Date.UTC normalises a negative month, so this needs no year arithmetic.
    const d = new Date(Date.UTC(year, month - 1 - back, 1));
    months.push({ key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
      label: SHORT_MONTHS[d.getUTCMonth()] });
  }

  return months.map(({ key, label }) => {
    const report = monthReport(key);
    // monthReport only fails on a malformed month, and these are built here.
    if (report.error) throw new Error(`trend month ${key}: ${report.error}`);
    return {
      month: key,
      label,
      closed: report.jobs,
      hours: report.hours,
      parts_cost: report.parts_cost,
      labour_cost: report.labour_cost,
      total: report.total,
    };
  });
}
