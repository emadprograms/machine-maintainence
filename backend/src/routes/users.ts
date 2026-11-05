import { Router, Request, Response } from 'express';
import { queryAll, queryOne } from '../database.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const users = queryAll('SELECT id, name, email, role, avatar, created_at FROM users ORDER BY name ASC');
  res.json(users);
});

router.get('/:id', (req: Request, res: Response) => {
  const user = queryOne('SELECT id, name, email, role, avatar, created_at FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

export default router;
