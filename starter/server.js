// The web server: routing, login, and the API. ~230 lines, one file.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { all, get, run, transaction, backup } from './db.js';
import { hashPassword, verifyPassword, signToken, verifyToken } from './auth.js';

const root = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';           // reachable from other PCs on the workshop network
const cookies = new Map();         // token -> expiry  (cleared on restart = "log out everywhere")

// ------------------------------------------------------------- first run
// Instead of seeding demo accounts with a known password (what the reviewed
// repo did), create one admin whose password we print once.
if (!get('SELECT id FROM users LIMIT 1')) {
  const password = process.env.MM_ADMIN_PASSWORD || randomPassword();
  run('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)',
    'Admin', 'admin@local', hashPassword(password), 'admin');
  console.log('\n  Created the first account:');
  console.log('    email:    admin@local');
  console.log(`    password: ${password}`);
  console.log('  Write it down now — it is not shown again.\n');
}

function randomPassword() {
  return Array.from({ length: 3 }, () => createHash('sha256')
    .update(String(Math.random())).digest('base64url').slice(0, 5)).join('-');
}

// --------------------------------------------------------------- session
function currentUser(req) {
  const token = (req.headers.cookie || '')
    .split(';').map(s => s.trim()).find(s => s.startsWith('sid='))?.slice(4);
  if (!token || !cookies.has(token)) return null;
  if (cookies.get(token) < Date.now()) { cookies.delete(token); return null; }
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

const readBody = (req) => new Promise((resolve, reject) => {
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

/** Wraps a handler so one bad request can never kill the server. */
const route = (fn, opts = {}) => async (req, res) => {
  try {
    // Every API route requires a session, read or write. Only the two auth
    // routes are public, and they declare it with `{ public: true }` below.
    const user = currentUser(req);
    if (!user && !opts.public) return send(res, 401, { error: 'Please sign in' });
    req.user = user;
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

/** A non-negative money value, or null to clear it. */
function priceValue(raw) {
  if (raw === undefined || raw === null || raw === '') return { value: null };
  const n = Number(raw);
  if (!Number.isFinite(n)) return { error: 'Unit price must be a number' };
  if (n < 0) return { error: 'Unit price cannot be negative' };
  return { value: n };
}

// ------------------------------------------------------------------ API
const api = {
  // ---- auth
  'POST /api/login': route(async (req, res) => {
    const body = await readBody(req);
    const user = get('SELECT * FROM users WHERE email = ?',
      String(body?.email || '').trim().toLowerCase());
    // Constant-time-ish: always hash something so timing does not leak whether an email exists.
    const ok = verifyPassword(String(body?.password || ''), user?.password_hash || hashPassword('x'));
    if (!user || !ok) return send(res, 401, { error: 'Wrong email or password' });
    if (!user.active) return send(res, 403, { error: 'This account has been disabled' });
    const token = signToken({ sub: user.id, role: user.role, name: user.name });
    cookies.set(token, Date.now() + 12 * 3600_000);
    res.setHeader('Set-Cookie', `sid=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=43200`);
    send(res, 200, { id: user.id, name: user.name, role: user.role });
  }, { public: true }),

  'POST /api/logout': route(async (req, res) => {
    const token = (req.headers.cookie || '').split(';').map(s => s.trim())
      .find(s => s.startsWith('sid='))?.slice(4);
    cookies.delete(token);                  // the repo could not do this at all
    res.setHeader('Set-Cookie', 'sid=; HttpOnly; Path=/; Max-Age=0');
    send(res, 200, { ok: true });
  }, { public: true }),

  'GET /api/me': route(async (req, res) => send(res, 200, req.user)),

  // ---- equipment
  'GET /api/equipment': route(async (_req, res) =>
    send(res, 200, all('SELECT * FROM equipment ORDER BY name'))),

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
  'GET /api/work-orders': route(async (_req, res) => send(res, 200, all(`
    SELECT w.*, e.name AS equipment_name
    FROM work_orders w JOIN equipment e ON e.id = w.equipment_id
    ORDER BY CASE w.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
             w.created_at DESC`))),

  'POST /api/work-orders': route(async (req, res) => {
    const b = await readBody(req);
    if (!b?.equipment_id || !b?.title?.trim()) {
      return send(res, 400, { error: 'Machine and title are required' });
    }
    // FK constraint catches a bogus machine id -> 400 instead of an orphan record.
    const r = run('INSERT INTO work_orders (equipment_id, title, notes, priority) VALUES (?,?,?,?)',
      id(b.equipment_id), b.title.trim(), b.notes || null, b.priority || 'medium');
    send(res, 201, get('SELECT * FROM work_orders WHERE id = ?', r.lastInsertRowid));
  }),

  'PATCH /api/work-orders/:id': route(async (req, res) => {
    const b = await readBody(req);
    const before = get('SELECT * FROM work_orders WHERE id = ?', id(req.params.id));
    if (!before) return send(res, 404, { error: 'Work order not found' });
    run('UPDATE work_orders SET status=?, priority=?, notes=?, closed_at=? WHERE id=?',
      b.status ?? before.status, b.priority ?? before.priority, b.notes ?? before.notes,
      (b.status ?? before.status) === 'done' ? new Date().toISOString() : null,
      id(req.params.id));
    send(res, 200, get('SELECT * FROM work_orders WHERE id = ?', id(req.params.id)));
  }),

  // ---- spare parts
  'GET /api/parts': route(async (_req, res) => send(res, 200, all('SELECT * FROM parts ORDER BY name'))),

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
    const base = req.body?.on || new Date().toISOString().slice(0, 10);
    run(`UPDATE pm_schedule
         SET last_done = ?, next_due = date(?, '+' || interval_days || ' days')
         WHERE id = ?`, base, base, id(req.params.id));
    send(res, 200, get('SELECT * FROM pm_schedule WHERE id = ?', id(req.params.id)));
  }),

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
    }
    run('UPDATE users SET name = ?, role = ?, active = ? WHERE id = ?',
      b.name ?? target.name, b.role ?? target.role,
      b.active === undefined ? target.active : (b.active ? 1 : 0), target.id);
    send(res, 200, get('SELECT id, name, email, role, active FROM users WHERE id = ?', target.id));
  }),

  // ---- backup (same idea as the repo's /tmp problem, solved properly)
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

server.listen(PORT, HOST, () => {
  console.log(`Machine maintenance running at http://localhost:${PORT}`);
  console.log(`Database: ${process.env.MM_DB || 'data/maintain.db'}`);
});
