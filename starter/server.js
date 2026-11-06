// The web server: routing, login, and the API. ~230 lines, one file.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { all, get, run, transaction, backup, close } from './db.js';
import { DATA_DIR, DB_PATH, rememberFirstPassword, forgetFirstPassword } from './db.js';
import { open as openSession, userIdOf, revoke as revokeSession, purgeExpired } from './sessions.js';
import { createLoginLog } from './login-log.js';
import { nowStamp, parseDay } from './dates.js';
import { workOrderFilter, partsFilter, equipmentFilter, historyFilter, historySql } from './filters.js';
import { hourlyRate, setSetting, getSetting, RATE_KEY } from './settings.js';
import { monthReport } from './report.js';
import { hashPassword, verifyPassword, signToken, verifyToken, randomPassword } from './auth.js';

const root = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';           // reachable from other PCs on the workshop network

// Failed sign-ins are recorded, never refused. See login-log.js for why this is
// a log and not a block.
const failedLogins = createLoginLog(DATA_DIR);

// One client, one origin. Node reports IPv4 connections as ::ffff:a.b.c.d when
// the listener is dual-stack; normalising means one client reads as one line in
// the log rather than two.
function sourceOf(req) {
  const raw = req.socket?.remoteAddress || 'unknown';
  return raw.startsWith('::ffff:') ? raw.slice(7) : raw;
}

// ------------------------------------------------------------- first run
// Instead of seeding demo accounts with a known password (what the reviewed
// repo did), create one admin whose password we print once — and also write it
// next to the database, because a password that exists only in a console window
// that gets closed is a password that cannot be recovered.
if (!get('SELECT id FROM users LIMIT 1')) {
  const password = process.env.MM_ADMIN_PASSWORD || randomPassword();
  run('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)',
    'Admin', 'admin@local', hashPassword(password), 'admin');
  const note = rememberFirstPassword(password);
  console.log('\n  Created the first account:');
  console.log('    email:    admin@local');
  console.log(`    password: ${password}`);
  console.log(`  It is also written to ${note}`);
  console.log('  Sign in, open Users, and change it — that deletes the file.\n');
}

// --------------------------------------------------------------- session
function cookieToken(req) {
  return (req.headers.cookie || '')
    .split(';').map(s => s.trim()).find(s => s.startsWith('sid='))?.slice(4);
}

function currentUser(req) {
  const token = cookieToken(req);
  if (!token) return null;
  // The session row, not a Map in memory: this is what survives a restart.
  if (userIdOf(token) === null) return null;
  return verifyToken(token);
}

// ----------------------------------------------------------------- utils
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
const send = (res, status, body) => {
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
const readBody = (req) => {
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
const route = (fn, opts = {}) => async (req, res) => {
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

const id = (v) => Number(v);
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

/** A whole, non-negative count. Returns { value } or { error } — never clamps,
 *  because silently turning -5 into 0 would hide the data-entry mistake. */
const MAX_COUNT = 1_000_000;
function stockValue(raw, fallback) {
  if (raw === undefined || raw === null || raw === '') return { value: fallback };
  const n = Number(raw);
  if (!Number.isInteger(n)) return { error: 'Quantity must be a whole number' };
  if (n < 0) return { error: 'Quantity cannot be negative' };
  if (n > MAX_COUNT) return { error: 'Quantity is unrealistically large' };
  return { value: n };
}

/**
 * Time spent on a job. `undefined` means "not mentioned" (leave it alone),
 * empty means "clear it", and anything else must be a number that a human could
 * have worked. Nullable on purpose: a job nobody has costed is not a job that
 * took zero hours.
 */
function hoursValue(raw) {
  if (raw === undefined) return { missing: true };
  if (raw === null || raw === '') return { value: null };
  const n = Number(raw);
  if (!Number.isFinite(n)) return { error: 'Hours must be a number' };
  if (n < 0) return { error: 'Hours cannot be negative' };
  if (n > 10000) return { error: 'Hours must be under 10000 for one job' };
  return { value: n };
}

/** A user id to own a job, or null to unassign. Validated against the table so a
 *  bad id is a sentence, not "FOREIGN KEY constraint failed". */
function assigneeValue(raw) {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return { error: 'That person does not exist' };
  if (!get('SELECT id FROM users WHERE id = ?', n)) return { error: 'That person does not exist' };
  return { value: n };
}

/** A non-negative money value, or null to clear it. */
function priceValue(raw) {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  const n = Number(raw);
  if (!Number.isFinite(n)) return { error: 'Unit price must be a number' };
  if (n < 0) return { error: 'Unit price cannot be negative' };
  return { value: n };
}

// ------------------------------------------------------------------- CSV
/** RFC 4180. A cell is quoted when it contains a comma, a quote, a line break or
 *  leading/trailing space; internal quotes are doubled. Applied to every cell
 *  rather than only the ones that look dangerous — the branch that decides is
 *  the branch that eventually gets it wrong. */
function csvCell(value) {
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

function toCsv(rows, columns) {
  const line = (cells) => cells.map(csvCell).join(',');
  const body = rows.map((row) => line(columns.map((c) => row[c.key])));
  return [line(columns.map((c) => c.label)), ...body].join('\r\n') + '\r\n';
}

/** Everything a CSV download needs, including the BOM Excel wants. */
function sendCsv(res, filename, rows, columns) {
  const body = '\uFEFF' + toCsv(rows, columns);
  res.writeHead(200, {
    'content-type': 'text/csv; charset=utf-8',
    'content-disposition': `attachment; filename="${filename}"`,
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

// The WHERE clauses now live in filters.js: one home for "which rows", shared by
// every list screen and both exports. A separate export query is how "the file
// does not match the screen" gets shipped (CSV-03).

// ------------------------------------------------------------------ API
const api = {
  // ---- auth
  'POST /api/login': route(async (req, res) => {
    const body = await readBody(req);
    const user = get('SELECT * FROM users WHERE email = ?',
      String(body?.email || '').trim().toLowerCase());
    // Constant-time-ish: always hash something so timing does not leak whether an email exists.
    const ok = verifyPassword(String(body?.password || ''), user?.password_hash || hashPassword('x'));
    if (!user || !ok) {
      // Written down so attempts are visible, without costing the next attempt
      // anything. An unknown email is recorded identically — the record must not
      // become a way to tell which addresses exist.
      failedLogins.record({
        email: String(body?.email || '').trim().toLowerCase(),
        source: sourceOf(req),
        reason: user ? 'wrong password' : 'no such account',
      });
      return send(res, 401, { error: 'Wrong email or password' });
    }
    if (!user.active) return send(res, 403, { error: 'This account has been disabled' });
    const token = signToken({ sub: user.id, role: user.role, name: user.name });
    openSession(token, user.id);            // a row, so a restart does not sign you out
    res.setHeader('Set-Cookie', `sid=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=43200`);
    send(res, 200, { id: user.id, name: user.name, role: user.role });
  }, { public: true }),

  'POST /api/logout': route(async (req, res) => {
    const token = (req.headers.cookie || '').split(';').map(s => s.trim())
      .find(s => s.startsWith('sid='))?.slice(4);
    revokeSession(cookieToken(req));        // the repo could not do this at all
    res.setHeader('Set-Cookie', 'sid=; HttpOnly; Path=/; Max-Age=0');
    send(res, 200, { ok: true });
  }, { public: true }),

  'GET /api/me': route(async (req, res) => send(res, 200, req.user)),

  // ---- history. The record: what has been closed, and everything that ever
  // happened to one machine. One endpoint serves both because they are the same
  // query with a different filter, and because phase 15 exports through it.
  'GET /api/history': route(async (req, res) => {
    const filter = historyFilter(req.query);
    if (filter.error) return send(res, 400, { error: filter.error });
    const sql = historySql(filter);
    const total = Number(get(sql.total, ...filter.params)?.n ?? 0);
    const rows = all(sql.rows, ...filter.params);
    // The list is capped on purpose; the count is not, so a screen can say
    // "showing 500 of 812" instead of quietly lying about the size of the past.
    send(res, 200, { rows, total, shown: rows.length });
  }),

  // ---- equipment
  'GET /api/equipment': route(async (req, res) => {
    const f = equipmentFilter(req.query);
    send(res, 200, all(`SELECT e.* FROM equipment e ${f.sql} ORDER BY e.name`, ...f.params));
  }),

  'POST /api/equipment': route(async (req, res) => {
    const b = await readBody(req);
    if (!b?.name?.trim()) return send(res, 400, { error: 'Name is required' });
    const r = run(`INSERT INTO equipment (name, asset_tag, category, location, status, notes, manufacturer)
                   VALUES (?,?,?,?,?,?,?)`,
      b.name.trim(), b.asset_tag || null, b.category || null, b.location || null,
      b.status || 'active', b.notes || null, b.manufacturer || null);
    send(res, 201, get('SELECT * FROM equipment WHERE id = ?', r.lastInsertRowid));
  }),

  'PUT /api/equipment/:id': route(async (req, res) => {
    const b = await readBody(req);
    const before = get('SELECT * FROM equipment WHERE id = ?', id(req.params.id));
    if (!before) return send(res, 404, { error: 'Machine not found' });
    run(`UPDATE equipment SET name=?, asset_tag=?, category=?, location=?, status=?, notes=? WHERE id=?`,
      b.name ?? before.name, b.asset_tag ?? before.asset_tag, b.category ?? before.category,
      b.location ?? before.location, b.status ?? before.status, b.notes ?? before.notes,
      id(req.params.id));
    send(res, 200, get('SELECT * FROM equipment WHERE id = ?', id(req.params.id)));
  }),

  'DELETE /api/equipment/:id': route(async (req, res) => {
    if (req.user.role !== 'admin') return send(res, 403, { error: 'Admins only' });
    run('DELETE FROM equipment WHERE id = ?', id(req.params.id));
    send(res, 200, { ok: true });
  }),

  // ---- work orders
  // The owner's name is resolved here, with no filter on `active`: a person who
  // has left still has to render on the jobs they owned (WO-02).
  'GET /api/work-orders': route(async (req, res) => {
    const f = workOrderFilter(req.query);
    send(res, 200, all(`
      SELECT w.*, e.name AS equipment_name, u.name AS assignee_name,
             -- parts used on this job, plus recorded hours at the configured rate
             ROUND(COALESCE(w.labour_hours, 0) * ?
                   + (SELECT COALESCE(SUM(wop.qty * COALESCE(p.unit_price, 0)), 0)
                        FROM work_order_parts wop JOIN parts p ON p.id = wop.part_id
                       WHERE wop.work_order_id = w.id), 2) AS cost
      FROM work_orders w
      JOIN equipment e ON e.id = w.equipment_id
      LEFT JOIN users u ON u.id = w.assigned_to
      ${f.sql}
      ORDER BY CASE w.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
               w.created_at DESC`, hourlyRate(), ...f.params));
  }),

  'POST /api/work-orders': route(async (req, res) => {
    const b = await readBody(req);
    if (!b?.equipment_id || !b?.title?.trim()) {
      return send(res, 400, { error: 'Machine and title are required' });
    }
    const owner = assigneeValue(b.assigned_to);
    if (owner.error) return send(res, 400, { error: owner.error });
    // FK constraint catches a bogus machine id -> 400 instead of an orphan record.
    const hours = hoursValue(b.labour_hours);
    if (hours.error) return send(res, 400, { error: hours.error });
    const r = run(`INSERT INTO work_orders (equipment_id, title, notes, priority, assigned_to, labour_hours)
                   VALUES (?,?,?,?,?,?)`,
      id(b.equipment_id), b.title.trim(), b.notes || null, b.priority || 'medium', owner.value,
      hours.missing ? null : hours.value);
    send(res, 201, get('SELECT * FROM work_orders WHERE id = ?', r.lastInsertRowid));
  }),

  'PATCH /api/work-orders/:id': route(async (req, res) => {
    const b = await readBody(req);
    const before = get('SELECT * FROM work_orders WHERE id = ?', id(req.params.id));
    if (!before) return send(res, 404, { error: 'Work order not found' });
    if (b.title !== undefined && !String(b.title).trim()) {
      return send(res, 400, { error: 'Title cannot be empty' });
    }
    const owner = b.assigned_to === undefined
      ? { value: before.assigned_to }
      : assigneeValue(b.assigned_to);
    if (owner.error) return send(res, 400, { error: owner.error });
    const hours = hoursValue(b.labour_hours);
    if (hours.error) return send(res, 400, { error: hours.error });
    run(`UPDATE work_orders SET title=?, status=?, priority=?, notes=?, closed_at=?, assigned_to=?,
         labour_hours=? WHERE id=?`,
      b.title === undefined ? before.title : String(b.title).trim(),
      b.status ?? before.status, b.priority ?? before.priority, b.notes ?? before.notes,
      (b.status ?? before.status) === 'done' ? (before.closed_at ?? nowStamp()) : null,
      owner.value, hours.missing ? before.labour_hours : hours.value, id(req.params.id));
    send(res, 200, get('SELECT * FROM work_orders WHERE id = ?', id(req.params.id)));
  }),

  // ---- spare parts
  'GET /api/parts': route(async (req, res) => {
    const f = partsFilter(req.query);
    send(res, 200, all(`SELECT p.* FROM parts p ${f.sql} ORDER BY p.name`, ...f.params));
  }),

  'POST /api/parts': route(async (req, res) => {
    const b = await readBody(req);
    if (!b?.name?.trim()) return send(res, 400, { error: 'Name is required' });
    const stock = stockValue(b.qty, 0);
    if (stock.error) return send(res, 400, { error: stock.error });
    const level = stockValue(b.reorder_level, 5);
    if (level.error) return send(res, 400, { error: level.error.replace('Quantity', 'Reorder level') });
    const price = priceValue(b.unit_price);
    if (price.error) return send(res, 400, { error: price.error });
    const r = run(`INSERT INTO parts (name, reference, qty, unit_price, supplier, reorder_level)
                   VALUES (?,?,?,?,?,?)`,
      b.name.trim(), b.reference || null, stock.value, price.value, b.supplier || null, level.value);
    send(res, 201, get('SELECT * FROM parts WHERE id = ?', r.lastInsertRowid));
  }),

  // Restock or correct a part. Every field is optional: the row is read first and
  // an absent key keeps its current value, so correcting a typo in the name cannot
  // quietly zero the stock (bug class the reviewed repo hit).
  'PUT /api/parts/:id': route(async (req, res) => {
    // readBody rejects on malformed JSON, so `b` is always an object here.
    const b = await readBody(req);
    const before = get('SELECT * FROM parts WHERE id = ?', id(req.params.id));
    if (!before) return send(res, 404, { error: 'Part not found' });

    if (b.name !== undefined && !String(b.name).trim()) {
      return send(res, 400, { error: 'Name cannot be empty' });
    }
    const stock = b.qty === undefined ? { value: before.qty } : stockValue(b.qty, before.qty);
    if (stock.error) return send(res, 400, { error: stock.error });
    const level = b.reorder_level === undefined
      ? { value: before.reorder_level }
      : stockValue(b.reorder_level, before.reorder_level);
    if (level.error) return send(res, 400, { error: level.error.replace('Quantity', 'Reorder level') });
    const price = b.unit_price === undefined ? { value: before.unit_price } : priceValue(b.unit_price);
    if (price.error) return send(res, 400, { error: price.error });

    run(`UPDATE parts SET name = ?, reference = ?, qty = ?, unit_price = ?, supplier = ?,
                          reorder_level = ?
         WHERE id = ?`,
      b.name === undefined ? before.name : String(b.name).trim(),
      b.reference === undefined ? before.reference : (b.reference || null),
      stock.value, price.value,
      b.supplier === undefined ? before.supplier : (b.supplier || null),
      level.value, before.id);
    send(res, 200, get('SELECT * FROM parts WHERE id = ?', before.id));
  }),

  // Deleting is allowed only for a part no job has consumed. The pre-check exists
  // to build a message naming the jobs — relying on ON DELETE RESTRICT alone would
  // surface "FOREIGN KEY constraint failed", which tells a workshop nothing.
  'DELETE /api/parts/:id': route(async (req, res) => {
    const part = get('SELECT * FROM parts WHERE id = ?', id(req.params.id));
    if (!part) return send(res, 404, { error: 'Part not found' });

    const usedOn = all(`SELECT w.id, w.title FROM work_order_parts wop
                        JOIN work_orders w ON w.id = wop.work_order_id
                        WHERE wop.part_id = ? ORDER BY w.created_at DESC`, part.id);
    if (usedOn.length) {
      const titles = usedOn.map((w) => w.title).join(', ');
      return send(res, 400, {
        error: `This part was used on: ${titles}. Remove it from those jobs first.`,
        work_orders: usedOn,
      });
    }
    run('DELETE FROM parts WHERE id = ?', part.id);
    send(res, 200, { ok: true });
  }),

  // Which parts were used on this job.
  'GET /api/work-orders/:id/parts': route(async (req, res) => send(res, 200, all(`
    SELECT p.id, p.name, p.reference, wop.qty
    FROM work_order_parts wop JOIN parts p ON p.id = wop.part_id
    WHERE wop.work_order_id = ? ORDER BY p.name`, id(req.params.id)))),

  // Use a part on a job: checks stock, links the part and decrements it —
  // all inside one transaction, so a failure leaves nothing half-written.
  'POST /api/work-orders/:id/parts': route(async (req, res) => {
    const b = await readBody(req);
    const qty = Number(b?.qty) || 1;
    if (!(qty > 0)) return send(res, 400, { error: 'Quantity must be more than zero' });

    const part = get('SELECT * FROM parts WHERE id = ?', id(b.part_id));
    if (!part) return send(res, 404, { error: 'Part not found' });
    if (part.qty < qty) {
      return send(res, 400, { error: `Only ${part.qty} in stock, cannot use ${qty}` });
    }
    if (!get('SELECT id FROM work_orders WHERE id = ?', id(req.params.id))) {
      return send(res, 404, { error: 'Work order not found' });
    }

    transaction(() => {
      // Same part twice on one job: add to the existing line instead of failing.
      run(`INSERT INTO work_order_parts (work_order_id, part_id, qty) VALUES (?,?,?)
           ON CONFLICT (work_order_id, part_id) DO UPDATE SET qty = qty + excluded.qty`,
        id(req.params.id), id(b.part_id), qty);
      run('UPDATE parts SET qty = qty - ? WHERE id = ?', qty, id(b.part_id));
    });
    send(res, 200, all('SELECT p.name, wop.qty FROM work_order_parts wop '
      + 'JOIN parts p ON p.id = wop.part_id WHERE wop.work_order_id = ?', id(req.params.id)));
  }),

  // ---- preventive maintenance  (the feature the reviewed repo lacks)
  'GET /api/pm': route(async (_req, res) => send(res, 200, all(`
    SELECT p.*, e.name AS equipment_name,
           CAST(julianday(p.next_due) - julianday('now') AS INTEGER) AS days_left
    FROM pm_schedule p JOIN equipment e ON e.id = p.equipment_id
    ORDER BY p.next_due`))),

  // "Due soon": due within N days, or already overdue.
  // ---- dashboard. One request, four answers.
  //
  // The alternative was four existing list calls and a client that counts. That
  // puts the answer in the one place this project cannot test — the smoke suite
  // has no DOM — and ships four payloads to render four numbers. Every query here
  // reuses a predicate the owning screen already uses, so a card cannot disagree
  // with the list it links to.
  'GET /api/dashboard': route(async (_req, res) => {
    const DUE_DAYS = 7;      // the first option on the Due soon screen
    const CAP = 5;           // enough to act on; the card links to the rest

    const openWork = workOrderFilter({});
    const openFilter = openWork.sql
      ? `${openWork.sql} AND w.status <> 'done'`
      : `WHERE w.status <> 'done'`;

    const work = all(`
      SELECT w.id, w.title, w.priority, w.status, e.name AS equipment_name
      FROM work_orders w JOIN equipment e ON e.id = w.equipment_id
      ${openFilter}
      ORDER BY CASE w.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
               w.created_at ASC`);
    const dueRows = all(`
      SELECT p.id, p.task, p.next_due, e.name AS equipment_name,
             CAST(julianday(p.next_due) - julianday('now') AS INTEGER) AS days_left
      FROM pm_schedule p JOIN equipment e ON e.id = p.equipment_id
      WHERE julianday(p.next_due) <= julianday('now', '+' || ? || ' days')
      ORDER BY p.next_due`, DUE_DAYS);
    const lowRows = all(`
      SELECT part.id, part.name, part.qty, part.reorder_level
      FROM parts part WHERE part.qty <= part.reorder_level
      ORDER BY (part.qty - part.reorder_level) ASC`);
    const downRows = all(
      `SELECT id, name, status FROM equipment WHERE status = 'down' ORDER BY name`);

    // The count is always the true total; only the list is capped. Capping the
    // count as well would make a card say "5" when 40 parts are low.
    const section = (rows, items, href) => ({
      count: rows.length,
      items: items.slice(0, CAP),
      href,
    });

    send(res, 200, {
      work_orders: section(work, work, '#work'),
      due_soon: section(dueRows, dueRows, '#due'),
      low_stock: section(lowRows, lowRows, '#parts'),
      machines: section(downRows, downRows, '#equipment'),
    });
  }),

  'GET /api/pm/due': route(async (req, res) => {
    const days = Number(req.query.days) || 7;
    send(res, 200, all(`
      SELECT p.*, e.name AS equipment_name,
             CAST(julianday(p.next_due) - julianday('now') AS INTEGER) AS days_left
      FROM pm_schedule p JOIN equipment e ON e.id = p.equipment_id
      WHERE julianday(p.next_due) <= julianday('now', '+' || ? || ' days')
      ORDER BY p.next_due`, days));
  }),

  'POST /api/pm': route(async (req, res) => {
    const b = await readBody(req);
    const interval = Number(b?.interval_days);
    if (!b?.equipment_id || !b?.task?.trim() || !(interval > 0)) {
      return send(res, 400, { error: 'Machine, task and a positive interval are required' });
    }
    const due = b.next_due || new Date(Date.now() + interval * 86400_000).toISOString().slice(0, 10);
    const r = run('INSERT INTO pm_schedule (equipment_id, task, interval_days, last_done, next_due) '
      + 'VALUES (?,?,?,?,?)', id(b.equipment_id), b.task.trim(), interval, day(b.last_done), day(due));
    send(res, 201, get('SELECT * FROM pm_schedule WHERE id = ?', r.lastInsertRowid));
  }),

  // "Mark done": rolls next_due forward by the interval. One line of SQL, no fake dates.
  'POST /api/pm/:id/done': route(async (req, res) => {
    const row = get('SELECT * FROM pm_schedule WHERE id = ?', id(req.params.id));
    if (!row) return send(res, 404, { error: 'Schedule not found' });

    const today = new Date().toISOString().slice(0, 10);
    // Absent means "it was done today" — that default is fine. Present means the
    // caller said something specific, and it must be used or refused, never
    // quietly swapped for today (v1.0 did exactly that: HTTP 200, value ignored).
    let base = today;
    if (req.body?.on !== undefined && req.body.on !== null && req.body.on !== '') {
      const parsed = parseDay(req.body.on, 'on');
      if (parsed.error) return send(res, 400, { error: parsed.error });
      if (parsed.value > today) {
        return send(res, 400, { error: 'A maintenance task cannot be completed in the future' });
      }
      if (row.last_done && parsed.value < row.last_done) {
        return send(res, 400, {
          error: `This was last done on ${row.last_done}; a completion date cannot be earlier than that`,
        });
      }
      base = parsed.value;
    }

    run(`UPDATE pm_schedule
         SET last_done = ?, next_due = date(?, '+' || interval_days || ' days')
         WHERE id = ?`, base, base, id(req.params.id));
    send(res, 200, get('SELECT * FROM pm_schedule WHERE id = ?', id(req.params.id)));
  }),

  // Names only, for populating an assignment dropdown. Any signed-in user may call
  // this — a technician has to be able to say who owns a job. It deliberately
  // exposes id and name and nothing else, so it cannot become the staff-directory
  // leak that bug #11 closed (T-8-01).
  'GET /api/users/assignable': route(async (_req, res) =>
    send(res, 200, all('SELECT id, name FROM users ORDER BY name'))),

  // ---- users (admin only). There is deliberately no public sign-up route.
  // The role check is on the *read* too: a technician has no business seeing
  // the staff list. This was missing until the live demo preview caught it —
  // the smoke test only covered POST, not GET (bug #11).
  'GET /api/users': route(async (req, res) => {
    if (req.user.role !== 'admin') return send(res, 403, { error: 'Admins only' });
    send(res, 200, all('SELECT id, name, email, role, active, created_at FROM users ORDER BY name'));
  }),

  'POST /api/users': route(async (req, res) => {
    if (req.user.role !== 'admin') return send(res, 403, { error: 'Admins only' });
    const b = await readBody(req);
    if (!b?.name?.trim() || !b?.email?.trim()) {
      return send(res, 400, { error: 'Name and email are required' });
    }
    const email = String(b.email).trim().toLowerCase();
    // Deliberately permissive: offline workshops use names like `tech@workshop`
    // with no dot. Anything with a local part and a host part is acceptable.
    if (!/^[^\s@]+@[^\s@]+$/.test(email)) {
      return send(res, 400, { error: 'That does not look like an email address' });
    }
    if (!b.password || String(b.password).length < 8) {
      return send(res, 400, { error: 'Password must be at least 8 characters' });
    }
    const role = b.role === 'admin' ? 'admin' : 'tech';
    const r = run('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)',
      b.name.trim(), email, hashPassword(b.password), role);
    send(res, 201, get('SELECT id, name, email, role, active FROM users WHERE id = ?',
      r.lastInsertRowid));
  }),

  'PUT /api/users/:id': route(async (req, res) => {
    if (req.user.role !== 'admin') return send(res, 403, { error: 'Admins only' });
    const b = await readBody(req);
    const target = get('SELECT * FROM users WHERE id = ?', id(req.params.id));
    if (!target) return send(res, 404, { error: 'User not found' });

    // Never let an admin lock themselves out of their own installation.
    // Two traps here, both of which bit this file once:
    //   - the token carries the id as a JSON number, the row is a SQLite integer,
    //     so compare with Number(...) rather than ===
    //   - clients send `false` for "disable", not `0`, so accept both
    const wantsDisable = b.active === 0 || b.active === false || b.active === '0';
    if (Number(target.id) === Number(req.user.sub) && wantsDisable) {
      return send(res, 400, { error: 'You cannot disable your own account' });
    }
    if (b.password) {
      if (String(b.password).length < 8) {
        return send(res, 400, { error: 'Password must be at least 8 characters' });
      }
      run('UPDATE users SET password_hash = ? WHERE id = ?',
        hashPassword(b.password), target.id);
      // first-password.txt only ever holds admin@local's original password.
      // Once that password is replaced the note is stale, and leaving a working
      // password in a text file would be worse than the lockout it prevents.
      if (target.email === 'admin@local') forgetFirstPassword();
    }
    run('UPDATE users SET name = ?, role = ?, active = ? WHERE id = ?',
      b.name ?? target.name, b.role ?? target.role,
      b.active === undefined ? target.active : (b.active ? 1 : 0), target.id);
    send(res, 200, get('SELECT id, name, email, role, active FROM users WHERE id = ?', target.id));
  }),

  // ---- history as a file. It uses historyFilter, exactly as the screen does,
  // so "what did we close in October" is one query with two renderings.
  'GET /api/export/history.csv': route(async (req, res) => {
    const filter = historyFilter(req.query);
    if (filter.error) return send(res, 400, { error: filter.error });
    // No LIMIT here on purpose: the screen shows the most recent 500, but a file
    // is the place to put everything that matches.
    const rows = all(historySql(filter, 1_000_000).rows, ...filter.params);
    sendCsv(res, 'history.csv', rows, [
      { key: 'equipment_name', label: 'Machine' },
      { key: 'title', label: 'Job' },
      { key: 'status', label: 'Status' },
      { key: 'owner', label: 'Owner' },
      { key: 'priority', label: 'Priority' },
      { key: 'created_at', label: 'Opened' },
      { key: 'closed_at', label: 'Closed' },
    ]);
  }),

  // ---- CSV export. Same filter builders as the list routes above, so the file
  // matches the screen by construction rather than by two queries agreeing.
  'GET /api/export/work-orders.csv': route(async (req, res) => {
    const f = workOrderFilter(req.query);
    const rows = all(`
      SELECT w.id, w.title, w.status, w.priority, w.created_at, w.closed_at,
             e.name AS equipment, u.name AS owner
      FROM work_orders w
      JOIN equipment e ON e.id = w.equipment_id
      LEFT JOIN users u ON u.id = w.assigned_to
      ${f.sql} ORDER BY w.created_at DESC`, ...f.params);
    sendCsv(res, 'work-orders.csv', rows, [
      { key: 'id', label: 'ID' },
      { key: 'equipment', label: 'Machine' },
      { key: 'title', label: 'Problem' },
      { key: 'owner', label: 'Owner' },
      { key: 'priority', label: 'Priority' },
      { key: 'status', label: 'Status' },
      { key: 'created_at', label: 'Created' },
      { key: 'closed_at', label: 'Closed' },
    ]);
  }),

  'GET /api/export/parts.csv': route(async (req, res) => {
    const f = partsFilter(req.query);
    const rows = all(`
      SELECT p.id, p.name, p.reference, p.qty, p.reorder_level, p.unit_price, p.supplier
      FROM parts p ${f.sql} ORDER BY p.name`, ...f.params);
    sendCsv(res, 'spare-parts.csv', rows, [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name' },
      { key: 'reference', label: 'Reference' },
      { key: 'qty', label: 'In stock' },
      { key: 'reorder_level', label: 'Reorder at' },
      { key: 'unit_price', label: 'Unit price' },
      { key: 'supplier', label: 'Supplier' },
    ]);
  }),

  // ---- backup (same idea as the repo's /tmp problem, solved properly)
  // ---- settings and the month report
  'GET /api/settings': route(async (_req, res) =>
    send(res, 200, { hourly_rate: hourlyRate() })),

  'PUT /api/settings': route(async (req, res) => {
    if (req.user.role !== 'admin') return send(res, 403, { error: 'Admins only' });
    const b = await readBody(req);
    const rate = Number(b?.hourly_rate);
    if (!Number.isFinite(rate)) return send(res, 400, { error: 'Hourly rate must be a number' });
    if (rate < 0) return send(res, 400, { error: 'Hourly rate cannot be negative' });
    setSetting(RATE_KEY, rate);
    send(res, 200, { hourly_rate: rate });
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

  'POST /api/backup': route(async (req, res) => {
    if (req.user.role !== 'admin') return send(res, 403, { error: 'Admins only' });
    send(res, 200, { file: backup() });
  }),
};

// -------------------------------------------------------------- routing
// Turn "/api/equipment/:id" into a regex so we never hand-parse paths.
const routes = Object.entries(api).map(([key, handler]) => {
  const [method, pattern] = key.split(' ');
  const keys = [];
  const regex = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => {
    keys.push(k);
    return '([^/]+)';
  }) + '$');
  return { method, regex, keys, handler };
});

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  req.query = Object.fromEntries(url.searchParams);

  for (const r of routes) {
    if (r.method !== req.method) continue;
    const m = url.pathname.match(r.regex);
    if (!m) continue;
    req.params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    return r.handler(req, res);
  }

  // Everything else is a static file, with a fallback to index.html.
  const file = join(root, 'public', url.pathname === '/' ? 'index.html' : url.pathname);
  if (existsSync(file) && file.startsWith(join(root, 'public'))) {
    const type = file.endsWith('.js') ? 'text/javascript'
      : file.endsWith('.css') ? 'text/css' : 'text/html';
    res.writeHead(200, { 'content-type': `${type}; charset=utf-8` });
    return res.end(readFileSync(file));
  }
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('Not found');
});

// Sessions left over from before a restart are still valid; expired ones are
// deleted on the way in so the table cannot grow without limit.
purgeExpired();

// Ctrl+C closes the database properly, which merges the side file into
// maintain.db. Windows cannot trap SIGTERM, which is why every write also
// checkpoints on its own — shutting down cleanly is a bonus, not the safety net.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log('\n  Closing the database.');
    try { close(); } catch { /* already closed */ }
    process.exit(0);
  });
}

server.listen(PORT, HOST, () => {
  console.log(`Machine maintenance running at http://localhost:${PORT}`);
  console.log(`Database: ${DB_PATH}`);
  console.log('Stop it with Ctrl+C in this window.');
});
