// Who is asking. A session is a row in the database (sessions.js), not a Map in
// memory, so a restart does not sign the workshop out — the v2.1 lesson.

import { userIdOf } from './sessions.js';
import { verifyToken } from './auth.js';

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
  return verifyToken(token);
}
