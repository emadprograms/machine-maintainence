// Admin-only: accounts and backup. There is deliberately no public sign-up
// route — accounts exist only because an administrator created one.

import { send, readBody, route, id } from '../http.js';
import { all, get, run, backup, forgetFirstPassword } from '../db.js';
import { hashPassword } from '../auth.js';

export default {
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
    // One spelling, as in POST: the app understands 'admin' and 'tech', and a
    // row storing 'Administrator' would silently behave like a technician.
    const role = b.role === undefined ? target.role : (b.role === 'admin' ? 'admin' : 'tech');
    run('UPDATE users SET name = ?, role = ?, active = ? WHERE id = ?',
      b.name ?? target.name, role,
      b.active === undefined ? target.active : (b.active ? 1 : 0), target.id);
    send(res, 200, get('SELECT id, name, email, role, active FROM users WHERE id = ?', target.id));
  }),

  // ---- backup: a consistent copy taken by SQLite itself, into a folder the
  // user chose, not /tmp (the reviewed repo's backups vanished with the process).
  'POST /api/backup': route(async (req, res) => {
    if (req.user.role !== 'admin') return send(res, 403, { error: 'Admins only' });
    send(res, 200, { file: backup() });
  }),

  'GET /api/users/assignable': route(async (_req, res) =>
    send(res, 200, all('SELECT id, name FROM users ORDER BY name'))),
};
