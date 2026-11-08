// What an hour costs, and what a month did.
//
// The rate is a settings row rather than a constant so changing it is a form,
// not a deployment, and so a report can say which rate produced its numbers.

import { send, readBody, route, sendCsv } from '../http.js';
import { hourlyRate, setSetting, RATE_KEY, TIME_ZONE_KEY, timeZone } from '../settings.js';
import { validTimeZone } from '../public/time-zone.js';
import { transaction } from '../db.js';
import { monthReport } from '../report.js';

export default {
  // ---- settings and the month report
  'GET /api/settings': route(async (_req, res) =>
    send(res, 200, { hourly_rate: hourlyRate(), time_zone: timeZone() })),

  'PUT /api/settings': route(async (req, res) => {
    if (req.user.role !== 'admin') return send(res, 403, { error: 'Admins only' });
    const b = await readBody(req);
    const hasRate = b?.hourly_rate !== undefined, hasZone = b?.time_zone !== undefined;
    if (!hasRate && !hasZone) return send(res, 400, { error: 'Choose a setting to change' });
    const rate = hasRate ? Number(b.hourly_rate) : hourlyRate();
    if (!Number.isFinite(rate)) return send(res, 400, { error: 'Hourly rate must be a number' });
    if (rate < 0) return send(res, 400, { error: 'Hourly rate cannot be negative' });
    const zone = hasZone && typeof b.time_zone === 'string' ? b.time_zone.trim() : b?.time_zone;
    if (hasZone && !validTimeZone(zone)) return send(res, 400, { error: 'Choose a valid IANA time zone, such as Asia/Bahrain' });
    transaction(() => {
      if (hasRate) setSetting(RATE_KEY, rate);
      if (hasZone) setSetting(TIME_ZONE_KEY, zone);
    });
    res.setHeader('X-Workshop-Time-Zone', timeZone());
    send(res, 200, { hourly_rate: rate, time_zone: timeZone() });
  }),

  'GET /api/report': route(async (req, res) => {
    const report = monthReport(req.query.month);
    if (report.error) return send(res, 400, { error: report.error });
    send(res, 200, report);
  }),

  'GET /api/export/report.csv': route(async (req, res) => {
    const report = monthReport(req.query.month);
    if (report.error) return send(res, 400, { error: report.error });
    // One row per machine plus a total, because a spreadsheet is where these
    // numbers get added to something else.
    const rows = report.machines.map((m) => ({
      month: report.month, machine: m.name, jobs: m.jobs, hours: m.hours,
      parts_cost: m.parts_cost, labour_cost: m.labour_cost, total: m.total,
    }));
    rows.push({
      month: report.month, machine: 'All machines', jobs: report.jobs, hours: report.hours,
      parts_cost: report.parts_cost, labour_cost: report.labour_cost, total: report.total,
    });
    sendCsv(res, `report-${report.month}.csv`, rows, [
      { key: 'month', label: 'Month' },
      { key: 'machine', label: 'Machine' },
      { key: 'jobs', label: 'Jobs closed' },
      { key: 'hours', label: 'Hours' },
      { key: 'parts_cost', label: 'Parts cost' },
      { key: 'labour_cost', label: 'Labour cost' },
      { key: 'total', label: 'Total' },
    ]);
  }),

};
