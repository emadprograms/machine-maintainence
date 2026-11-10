// The record: finished work, one machine's past, and the same rows as a file.
//
// These routes and history.js in the browser answer the question v3.0 exists
// for — "what happened to this pump, and what did we close in October".

import { send, route, sendCsv } from '../http.js';
import { all, get } from '../db.js';
import { historyFilter, historySql } from '../filters.js';
import { timeZone } from '../settings.js';
import { exportTimes } from '../time-export.js';

export default {
  // ---- history. The record: what has been closed, and everything that ever
  // happened to one machine. One endpoint serves both because they are the same
  // query with a different filter, and because phase 15 exports through it.
  'GET /api/history': route(async (req, res) => {
    const filter = historyFilter(req.query, timeZone());
    if (filter.error) return send(res, 400, { error: filter.error });
    const sql = historySql(filter);
    const total = Number(get(sql.total, ...filter.params)?.n ?? 0);
    const rows = all(sql.rows, ...filter.params);
    // The list is capped on purpose; the count is not, so a screen can say
    // "showing 500 of 812" instead of quietly lying about the size of the past.
    send(res, 200, { rows, total, shown: rows.length });
  }),

  // ---- history as a file. It uses historyFilter, exactly as the screen does,
  // so "what did we close in October" is one query with two renderings.
  'GET /api/export/history.csv': route(async (req, res) => {
    const filter = historyFilter(req.query, timeZone());
    if (filter.error) return send(res, 400, { error: filter.error });
    // No LIMIT here on purpose: the screen shows the most recent 500, but a file
    // is the place to put everything that matches.
    const rows = all(historySql(filter, 1_000_000).rows, ...filter.params);
    sendCsv(res, 'history.csv', exportTimes(rows, timeZone(), ['created_at', 'closed_at']), [
      { key: 'code', label: 'Number' },
      { key: 'equipment_name', label: 'Machine' },
      { key: 'title', label: 'Job' },
      { key: 'resolution', label: 'What was done' },
      { key: 'status', label: 'Status' },
      { key: 'owner', label: 'Assigned to' },
      { key: 'priority', label: 'Priority' },
      { key: 'created_at', label: 'Opened' },
      { key: 'closed_at', label: 'Closed' },
    ]);
  }),
};
