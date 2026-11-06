// Who is asking. A session is a row in the database (sessions.js), not a Map in
// memory, so a restart does not sign the workshop out — the v2.1 lesson.

import { userIdOf } from './sessions.js';
import { verifyToken } from './auth.js';
import { get } from './db.js';

// One client, one origin. Node reports IPv4 connections as ::ffff:a.b.c.d when
// the listener is dual-stack; normalising means one client reads as one line in
// the log rather than two.
export function sourceOf(req) {
  const raw = req.socket?.remoteAddress || 'unknown';
  return raw.startsWith('::ffff:') ? raw.slice(7) : raw;
}

export function cookieToken(req) {
  return (req.headers.cookie || '')
    .split(';').map(s => s.trim()).find(s => s.startsWith('sid='))?.slice(4);
}

export function currentUser(req) {
  const token = cookieToken(req);
  if (!token) return null;
  // The session row, not a Map in memory: this is what survives a restart.
  if (userIdOf(token) === null) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  // Who they are *now*, not who they were when they signed in. The token carries
  // a role and a name, and trusting them for twelve hours meant that disabling
  // an account did nothing to the session already open, and a demoted admin kept
  // the admin screen. One lookup per request buys both.
  const row = get('SELECT id, name, role, active FROM users WHERE id = ?', Number(payload.sub));
  if (!row || !row.active) return null;
  return { ...payload, name: row.name, role: row.role };
}
