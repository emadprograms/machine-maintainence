import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'crypto';

const SECRET = process.env.AUTH_SECRET || 'maintainx-pro-dev-secret-change-me';
const TOKEN_TTL_SECONDS = 60 * 60 * 12; // 12h

/* ----------------------------- Password hashing ---------------------------- */

/** Returns a self-describing hash: scrypt$<saltHex>$<hashHex>. */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(plain, salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export function isHashed(stored: string | null | undefined): boolean {
  return typeof stored === 'string' && stored.startsWith('scrypt$');
}

/** Verifies a plaintext password against a stored value (hashed or legacy plaintext). */
export function verifyPassword(plain: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  if (!isHashed(stored)) {
    // Legacy plaintext fallback (pre-migration safety).
    return plain === stored;
  }
  const [, saltHex, hashHex] = stored.split('$');
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const derived = scryptSync(plain, salt, expected.length);
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

/* --------------------------------- Tokens ---------------------------------- */

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sign(data: string): string {
  return b64url(createHmac('sha256', SECRET).update(data).digest());
}

export interface TokenPayload {
  sub: string;   // user id
  role: string;
  email: string;
  exp: number;   // unix seconds
}

/** Minimal signed token (JWT-like, HS256) without external dependencies. */
export function signToken(payload: Omit<TokenPayload, 'exp'>): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS }));
  const signature = sign(`${header}.${body}`);
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string | undefined): TokenPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  if (sign(`${header}.${body}`) !== signature) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64').toString('utf8')) as TokenPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
