// Everything a route needs to read a request and answer it, and nothing about
// any particular screen. `route()` is the one place a thrown error becomes a
// sentence rather than a stack trace.

import { currentUser } from './who.js';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
export const send = (res, status, body) => {
  res.writeHead(status, JSON_HEADERS);
  res.end(JSON.stringify(body));
};
// A malformed body is a client mistake, not a server crash. Rejecting with a
// typed error lets route() answer every handler with the same readable 400 —
// otherwise each handler has to remember a null check, and the one that forgets
// leaks "Cannot read properties of null" to the user (found in review of 7).
class BadBody extends Error {}

// A request stream can only be read once, so the parse promise is cached on the
// request. That lets route() populate `req.body` for every request while the
// existing handlers keep calling readBody(req) and get the same object back.
export const readBody = (req) => {
  if (req._body) return req._body;
  req._body = new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1_000_000) req.destroy();   // 1 MB cap: no giant photo payloads
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch { reject(new BadBody('invalid JSON')); }
    });
  });
  return req._body;
};

// Only methods that can carry a body. A GET's stream is already at EOF, so
// attaching listeners to it would wait for an 'end' that has already fired.
const HAS_BODY = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Wraps a handler so one bad request can never kill the server. */
export const route = (fn, opts = {}) => async (req, res) => {
  try {
    // Every API route requires a session, read or write. Only the two auth
    // routes are public, and they declare it with `{ public: true }` below.
    const user = currentUser(req);
    if (!user && !opts.public) return send(res, 401, { error: 'Please sign in' });
    req.user = user;
    // Handlers may read req.body directly. Before phase 9 nothing assigned it,
    // so `req.body?.on` was silently always undefined — the bug this phase exists
    // to fix. Populating it here means the next handler cannot repeat that.
    if (HAS_BODY.has(req.method)) req.body = await readBody(req);
    await fn(req, res);
  } catch (err) {
    if (err instanceof BadBody) {
      return send(res, 400, { error: 'The request body is not valid JSON' });
    }
    // Turn database constraint errors into messages a workshop user can act on.
    const raw = String(err.message);
    if (raw.includes('FOREIGN KEY')) {
      return send(res, 400, { error: 'That machine or part does not exist any more' });
    }
    if (raw.startsWith('CHECK constraint')) {
      return send(res, 400, { error: 'One of the values is not allowed (check status/priority)' });
    }
    if (raw.includes('UNIQUE constraint')) {
      return send(res, 400, { error: 'That record already exists' });
    }
    console.error(err);
    send(res, 400, { error: raw });
  }
};
export const id = (v) => Number(v);
export const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
/** RFC 4180. A cell is quoted when it contains a comma, a quote, a line break or
 *  leading/trailing space; internal quotes are doubled. Applied to every cell
 *  rather than only the ones that look dangerous — the branch that decides is
 *  the branch that eventually gets it wrong. */
export function csvCell(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  // A leading =, +, - or @ is executed as a formula by Excel and Sheets.
  // Prefixing with an apostrophe keeps the text and defuses it.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text) || /^\s|\s$/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(rows, columns) {
  const line = (cells) => cells.map(csvCell).join(',');
  const body = rows.map((row) => line(columns.map((c) => row[c.key])));
  return [line(columns.map((c) => c.label)), ...body].join('\r\n') + '\r\n';
}

/** Everything a CSV download needs, including the BOM Excel wants. */
export function sendCsv(res, filename, rows, columns) {
  const body = '\uFEFF' + toCsv(rows, columns);
  res.writeHead(200, {
    'content-type': 'text/csv; charset=utf-8',
    'content-disposition': `attachment; filename="${filename}"`,
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}
