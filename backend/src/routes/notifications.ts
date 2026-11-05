import { Router, Request, Response } from 'express';
import { queryAll, queryOne, execute } from '../database.js';

const router = Router();

router.get('/unread-count', (req: Request, res: Response) => {
  const userId = req.auth?.sub;
  const role = req.auth?.role;
  let unread = 0;
  if (role === 'admin') {
    unread = (queryOne('SELECT COUNT(*) as count FROM activities WHERE read = 0') as any)?.count || 0;
  } else {
    unread = (queryOne('SELECT COUNT(*) as count FROM activities WHERE read = 0 AND (target_user_id = ? OR user_id = ?)', [userId, userId]) as any)?.count || 0;
  }
  res.json({ unread });
});

router.get('/', (req: Request, res: Response) => {
  const userId = req.auth?.sub;
  const role = req.auth?.role;
  let activities;
  if (role === 'admin') {
    activities = queryAll('SELECT * FROM activities ORDER BY created_at DESC LIMIT 50');
  } else {
    activities = queryAll(
      'SELECT * FROM activities WHERE target_user_id = ? OR user_id = ? ORDER BY created_at DESC LIMIT 50',
      [userId, userId]
    );
  }
  const unread = activities.filter((a: any) => !a.read).length;
  res.json({ activities, unread });
});

router.patch('/:id/read', (req: Request, res: Response) => {
  execute('UPDATE activities SET read = 1 WHERE id = ?', [req.params.id]);
  res.json({ message: 'Marked as read' });
});

router.post('/mark-all-read', (_req: Request, res: Response) => {
  execute('UPDATE activities SET read = 1 WHERE read = 0');
  res.json({ message: 'All marked as read' });
});

export default router;
