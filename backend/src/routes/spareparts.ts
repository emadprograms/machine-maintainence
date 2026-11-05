import { Router, Request, Response } from 'express';
import { queryAll, queryOne, execute } from '../database.js';
import { v4 as uuid } from 'uuid';
import { requireRole } from '../middleware/authGuard.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const parts = queryAll(`
    SELECT sp.*, f.title as fault_title, e.name as equipment_name
    FROM spare_parts sp
    LEFT JOIN faults f ON sp.fault_id = f.id
    LEFT JOIN equipment e ON f.equipment_id = e.id
    ORDER BY sp.created_at DESC
  `);
  res.json(parts);
});

router.get('/:id', (req: Request, res: Response) => {
  const part = queryOne(
    'SELECT sp.*, f.title as fault_title FROM spare_parts sp LEFT JOIN faults f ON sp.fault_id = f.id WHERE sp.id = ?',
    [req.params.id]
  );
  if (!part) return res.status(404).json({ error: 'Spare part not found' });
  res.json(part);
});

router.post('/', requireRole('admin', 'manager'), (req: Request, res: Response) => {
  const { fault_id, name, reference, quantity, unit_price, supplier } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });

  const id = uuid();
  execute(
    'INSERT INTO spare_parts (id, fault_id, name, reference, quantity, unit_price, supplier) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, fault_id || null, name, reference || null, quantity || 1, unit_price || 0, supplier || null]
  );

  if (fault_id) {
    execute(
      'INSERT INTO activities (id, type, message, related_id, related_type) VALUES (?, ?, ?, ?, ?)',
      [uuid(), 'part_ordered', `Pièce commandée : ${name} x${quantity || 1}`, id, 'spare_part']
    );
  }

  const part = queryOne('SELECT * FROM spare_parts WHERE id = ?', [id]);
  res.status(201).json(part);
});

router.patch('/:id/status', requireRole('admin', 'manager'), (req: Request, res: Response) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'ordered', 'received', 'installed', 'cancelled'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const existing = queryOne('SELECT * FROM spare_parts WHERE id = ?', [req.params.id]) as any;
  if (!existing) return res.status(404).json({ error: 'Spare part not found' });

  execute("UPDATE spare_parts SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, req.params.id]);

  const type = status === 'received' ? 'part_received' : status === 'ordered' ? 'part_ordered' : 'status_change';
  execute(
    'INSERT INTO activities (id, type, message, related_id, related_type) VALUES (?, ?, ?, ?, ?)',
    [uuid(), type, `Pièce "${existing.name}" : ${status}`, req.params.id, 'spare_part']
  );

  const updated = queryOne('SELECT * FROM spare_parts WHERE id = ?', [req.params.id]);
  res.json(updated);
});

export default router;
