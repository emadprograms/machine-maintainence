// Sign-in sessions, stored in the database instead of in the server's memory.
//
// They used to live in `const cookies = new Map()` in server.js, which meant a
// restart forgot every session and put the owner back on the login screen. On
// the owner's machine that was indistinguishable from "the password changed
// again" — the actual complaint this file exists to end.
//
// Only a SHA-256 of the token is stored. The database never holds a token that
// could be pasted into a browser.
import { createHash } from 'node:crypto';
import { get, run } from './db.js';

const TTL_MS = 12 * 3600_000;               // matches the cookie's Max-Age
const hash = (token) => createHash('sha256').update(String(token)).digest('hex');

/** Record a new session. Returns the moment it expires, in ms. */
export function open(token, userId, now = Date.now()) {
  const expiresAt = now + TTL_MS;
  run(`INSERT OR REPLACE INTO sessions (token_hash, user_id, expires_at)
       VALUES (?,?,?)`, hash(token), userId, expiresAt);
  return expiresAt;
}

/** The signed-in user id for a token, or null. Expired sessions count as none. */
export function userIdOf(token, now = Date.now()) {
  if (!token) return null;
  const row = get('SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?',
    hash(token), now);
  return row ? Number(row.user_id) : null;
}

/** Sign one token out. */
export function revoke(token) {
  if (!token) return;
  run('DELETE FROM sessions WHERE token_hash = ?', hash(token));
}

/** Sign everybody out — used when a password is reset. */
export function revokeAll() {
  run('DELETE FROM sessions');
}

/** Drop rows nobody can use any more, so the table cannot grow for ever. */
export function purgeExpired(now = Date.now()) {
  run('DELETE FROM sessions WHERE expires_at <= ?', now);
}
