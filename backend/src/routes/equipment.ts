import { Router, Request, Response } from 'express';
import { queryAll, queryOne, execute } from '../database.js';
import { v4 as uuid } from 'uuid';
import { requireRole } from '../middleware/authGuard.js';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  if (req.auth?.role === 'client') {
    const user = queryOne('SELECT company_id FROM users WHERE id = ?', [req.auth.sub]) as any;
    const equipment = queryAll('SELECT * FROM equipment WHERE company_id = ? ORDER BY created_at DESC', [user?.company_id || '']);
    return res.json(equipment);
  }
  const equipment = queryAll('SELECT * FROM equipment ORDER BY created_at DESC');
  res.json(equipment);
});

router.get('/:id', (req: Request, res: Response) => {
  const item = queryOne('SELECT * FROM equipment WHERE id = ?', [req.params.id]);
  if (!item) return res.status(404).json({ error: 'Equipment not found' });
  res.json(item);
});

router.post('/', requireRole('admin', 'manager'), (req: Request, res: Response) => {
  const { name, category, description, location, technical_sheet, images } = req.body;
  if (!name || !category) return res.status(400).json({ error: 'Name and category required' });

  const id = uuid();
  execute(
    'INSERT INTO equipment (id, name, category, description, location, technical_sheet, images) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, name, category, description || null, location || null, technical_sheet || null, JSON.stringify(images || [])]
  );

  execute(
    'INSERT INTO activities (id, type, message, related_id, related_type) VALUES (?, ?, ?, ?, ?)',
    [uuid(), 'equipment_added', `Nouvel équipement ajouté : ${name}`, id, 'equipment']
  );

  const item = queryOne('SELECT * FROM equipment WHERE id = ?', [id]);
  res.status(201).json(item);
});

router.put('/:id', requireRole('admin', 'manager'), (req: Request, res: Response) => {
  const { name, category, description, location, technical_sheet, status, health_score } = req.body;
  const existing = queryOne('SELECT * FROM equipment WHERE id = ?', [req.params.id]) as any;
  if (!existing) return res.status(404).json({ error: 'Equipment not found' });

  execute(
    `UPDATE equipment SET name = ?, category = ?, description = ?, location = ?, technical_sheet = ?,
     status = ?, health_score = ?, updated_at = datetime('now') WHERE id = ?`,
    [
      name ?? existing.name,
      category ?? existing.category,
      description ?? existing.description,
      location ?? existing.location,
      technical_sheet ?? existing.technical_sheet,
      status ?? existing.status,
      health_score ?? existing.health_score,
      req.params.id
    ]
  );

  const updated = queryOne('SELECT * FROM equipment WHERE id = ?', [req.params.id]);
  res.json(updated);
});

router.delete('/:id', requireRole('admin'), (req: Request, res: Response) => {
  const existing = queryOne('SELECT * FROM equipment WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Equipment not found' });
  execute('DELETE FROM equipment WHERE id = ?', [req.params.id]);
  res.json({ message: 'Equipment deleted' });
});

router.patch('/:id/images', (req: Request, res: Response) => {
  const { images, mode } = req.body as { images?: string[]; mode?: 'append' | 'replace' };
  if (!Array.isArray(images)) return res.status(400).json({ error: 'images must be an array' });

  const existing = queryOne('SELECT * FROM equipment WHERE id = ?', [req.params.id]) as any;
  if (!existing) return res.status(404).json({ error: 'Equipment not found' });

  let current: string[] = [];
  try { current = JSON.parse(existing.images || '[]'); } catch { current = []; }
  const next = mode === 'replace' ? images : [...current, ...images];

  execute("UPDATE equipment SET images = ?, updated_at = datetime('now') WHERE id = ?", [JSON.stringify(next), req.params.id]);
  const updated = queryOne('SELECT * FROM equipment WHERE id = ?', [req.params.id]);
  res.json(updated);
});

router.get('/:id/faults', (req: Request, res: Response) => {
  const faults = queryAll('SELECT * FROM faults WHERE equipment_id = ? ORDER BY created_at DESC', [req.params.id]);
  res.json(faults);
});

export default router;
