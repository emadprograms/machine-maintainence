import { Request, Response, NextFunction } from 'express';
import { queryOne } from '../database.js';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Authentication required' });

  const user = queryOne(`
    SELECT u.id, u.name, u.email, u.role
    FROM sessions s JOIN users u ON s.user_id = u.id
    WHERE s.token = ?
  `, [auth]) as any;

  if (!user) return res.status(401).json({ error: 'Invalid or expired token' });

  (req as any).user = user;
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
