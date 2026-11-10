// Workshop settings and a month of recorded parts costs.

import { send, readBody, route, sendCsv } from '../http.js';
import { setSetting, TIME_ZONE_KEY, timeZone } from '../settings.js';
import { validTimeZone } from '../public/time-zone.js';
import { monthReport } from '../report.js';

export default {
  // ---- settings and the month report
  'GET /api/settings': route(async (_req, res) =>
    send(res, 200, { time_zone: timeZone() })),

  'PUT /api/settings': route(async (req, res) => {
    if (req.user.role !== 'admin') return send(res, 403, { error: 'Admins only' });
    const b = await readBody(req);
    if (Object.keys(b || {}).some((key) => key !== 'time_zone'))
      return send(res, 400, { error: 'Only the workshop time zone can be changed here' });
    const zone = typeof b?.time_zone === 'string' ? b.time_zone.trim() : b?.time_zone;
    if (!validTimeZone(zone)) return send(res, 400, { error: 'Choose a valid IANA time zone, such as Asia/Bahrain' });
    setSetting(TIME_ZONE_KEY, zone);
    res.setHeader('X-Workshop-Time-Zone', timeZone());
    send(res, 200, { time_zone: timeZone() });
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
      total: m.total,
    }));
    rows.push({
      month: report.month, machine: 'All machines', jobs: report.jobs, hours: report.hours,
      total: report.total,
    });
    sendCsv(res, `report-${report.month}.csv`, rows, [
      { key: 'month', label: 'Month' },
      { key: 'machine', label: 'Machine' },
      { key: 'jobs', label: 'Jobs closed' },
      { key: 'hours', label: 'Hours' },
      { key: 'total', label: 'Total service cost' },
    ]);
  }),

};
