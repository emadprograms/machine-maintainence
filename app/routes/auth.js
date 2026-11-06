// Signing in, signing out, and who am I. The only routes that are public.
//
// A failed sign-in is recorded beside the database and never refused, however
// many times it happens: see login-log.js for why that is the deliberate choice.

import { DATA_DIR, get } from '../db.js';
import { createLoginLog } from '../login-log.js';
import { open as openSession, revoke as revokeSession } from '../sessions.js';
import { send, readBody, route } from '../http.js';
import { sourceOf, cookieToken } from '../who.js';
import { hashPassword, verifyPassword, signToken } from '../auth.js';

const failedLogins = createLoginLog(DATA_DIR);

export default {
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
};
