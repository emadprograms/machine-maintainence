import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../lib/auth.js';
import { execute } from '../database.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: TokenPayload;
    }
  }
}

function extractToken(req: Request): string | undefined {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : undefined;
}

function touchLastSeen(userId: string): void {
  execute("UPDATE users SET last_seen_at = datetime('now') WHERE id = ?", [userId]);
}

/** Rejects the request unless a valid token is present. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const payload = verifyToken(extractToken(req));
  if (!payload) return res.status(401).json({ error: 'Authentification requise' });
  req.auth = payload;
  touchLastSeen(payload.sub);
  next();
}

/** Requires a valid token AND one of the allowed roles. */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const payload = verifyToken(extractToken(req));
    if (!payload) return res.status(401).json({ error: 'Authentification requise' });
    if (!roles.includes(payload.role)) {
      return res.status(403).json({ error: 'Accès refusé : privilèges insuffisants' });
    }
    req.auth = payload;
    touchLastSeen(payload.sub);
    next();
  };
}

export const requireAdmin = requireRole('admin');
