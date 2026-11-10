// Passwords and login tokens. Adapted from the reviewed repo's
// backend/src/lib/auth.ts (scrypt + timingSafeEqual + small signed token),
// with two changes: no hardcoded fallback secret, and logout actually revokes.
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';
import { machineSecret } from './db.js';

const SECRET = machineSecret();        // generated once, stored in data/secret.txt
const TTL_SECONDS = 60 * 60 * 12;      // 12 hours

// ------------------------------------------------------------- passwords
export function hashPassword(plain) {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

// A password nobody has to invent. Three groups of five, because it is read off
// a screen and typed by a person: 15 characters from randomBytes, not Math.random,
// which is predictable enough that the old version was worth replacing.
export function randomPassword() {
  const raw = randomBytes(18).toString('base64url').replace(/[-_]/g, 'x');
  return [raw.slice(0, 5), raw.slice(5, 10), raw.slice(10, 15)].join('-');
}

export function verifyPassword(plain, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, saltHex, hashHex] = stored.split('$');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(plain, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(expected, actual);
}

// ---------------------------------------------------------------- tokens
const b64 = (b) => Buffer.from(b).toString('base64url');
const sign = (data) => b64(createHmac('sha256', SECRET).update(data).digest());

export function signToken(payload) {
  const body = b64(JSON.stringify({ ...payload, exp: Date.now() + TTL_SECONDS * 1000 }));
  return `${body}.${sign(body)}`;
}

export function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const [body, signature] = token.split('.');
  const expected = sign(body);
  // constant-time compare; lengths must match before timingSafeEqual
  if (signature.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
