import { Router, Request, Response } from 'express';
import { queryAll, queryOne, execute } from '../database.js';
import { v4 as uuid } from 'uuid';
import { auditFromReq } from '../lib/audit.js';

const router = Router();

function scopeFaultsForUser(req: Request): { sql: string; params: string[] } {
  const role = req.auth?.role;
  const userId = req.auth?.sub;
  if (role === 'client') {
    const user = queryOne('SELECT company_id FROM users WHERE id = ?', [userId]) as any;
    return {
      sql: ` AND e.company_id = ? AND f.reported_by = ?`,
      params: [user?.company_id || '', userId || ''],
    };
  }
  return { sql: '', params: [] };
}

router.get('/', (req: Request, res: Response) => {
  const { assignedTo } = req.query;
  let extraSql = '';
  const extraParams: string[] = [];

  if (assignedTo === 'me' && req.auth?.sub) {
    extraSql = ' AND f.assigned_to = ?';
    extraParams.push(req.auth.sub);
  }

  const scope = scopeFaultsForUser(req);

  const faults = queryAll(`
    SELECT f.*, e.name as equipment_name, e.category as equipment_category, e.company_id,
      c.name as company_name, u.name as assigned_name
    FROM faults f
    LEFT JOIN equipment e ON f.equipment_id = e.id
    LEFT JOIN companies c ON e.company_id = c.id
    LEFT JOIN users u ON f.assigned_to = u.id
    WHERE 1=1 ${scope.sql} ${extraSql}
    ORDER BY
      CASE f.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      f.created_at DESC
  `, [...scope.params, ...extraParams]);
  res.json(faults);
});

router.get('/:id', (req: Request, res: Response) => {
  const fault = queryOne(`
    SELECT f.*, e.name as equipment_name, e.category as equipment_category, e.company_id,
      c.name as company_name, u.name as assigned_name
    FROM faults f
    LEFT JOIN equipment e ON f.equipment_id = e.id
    LEFT JOIN companies c ON e.company_id = c.id
    LEFT JOIN users u ON f.assigned_to = u.id
    WHERE f.id = ?
  `, [req.params.id]) as any;
  if (!fault) return res.status(404).json({ error: 'Fault not found' });

  if (req.auth?.role === 'client') {
    const user = queryOne('SELECT company_id FROM users WHERE id = ?', [req.auth.sub]) as any;
    if (fault.company_id !== user?.company_id) return res.status(403).json({ error: 'Accès refusé' });
  }

  const comments = queryAll(
    'SELECT fc.*, u.name as user_name FROM fault_comments fc LEFT JOIN users u ON fc.user_id = u.id WHERE fc.fault_id = ? ORDER BY fc.created_at ASC',
    [req.params.id]
  );
  const parts = queryAll('SELECT * FROM spare_parts WHERE fault_id = ?', [req.params.id]);
  const report = queryOne('SELECT * FROM intervention_reports WHERE fault_id = ?', [req.params.id]);

  res.json({ ...fault, comments, spare_parts: parts, intervention_report: report });
});

router.post('/', (req: Request, res: Response) => {
  const { equipment_id, title, description, priority, images, reported_by } = req.body;
  if (!equipment_id || !title || !description) return res.status(400).json({ error: 'equipment_id, title, description required' });

  if (req.auth?.role === 'client') {
    const user = queryOne('SELECT company_id FROM users WHERE id = ?', [req.auth.sub]) as any;
    const eq = queryOne('SELECT company_id FROM equipment WHERE id = ?', [equipment_id]) as any;
    if (eq?.company_id !== user?.company_id) return res.status(403).json({ error: 'Équipement hors périmètre' });
  }

  const id = uuid();
  const reporter = reported_by || req.auth?.sub || null;
  execute(
    'INSERT INTO faults (id, equipment_id, title, description, priority, images, reported_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, equipment_id, title, description, priority || 'medium', JSON.stringify(images || []), reporter]
  );

  execute("UPDATE equipment SET status = 'maintenance', updated_at = datetime('now') WHERE id = ?", [equipment_id]);
  execute(
    'INSERT INTO activities (id, type, message, related_id, related_type, user_id) VALUES (?, ?, ?, ?, ?, ?)',
    [uuid(), 'fault_created', `Nouvelle panne signalée : ${title}`, id, 'fault', reporter]
  );
  auditFromReq(req, 'create_breakdown', 'fault', id, { title, priority });

  const fault = queryOne(
    'SELECT f.*, e.name as equipment_name FROM faults f LEFT JOIN equipment e ON f.equipment_id = e.id WHERE f.id = ?',
    [id]
  );
  res.status(201).json(fault);
});

router.patch('/:id/assign', (req: Request, res: Response) => {
  if (!['admin', 'manager'].includes(req.auth?.role || '')) {
    return res.status(403).json({ error: 'Seuls admin/manager peuvent assigner' });
  }
  const { technician_id } = req.body;
  execute("UPDATE faults SET assigned_to = ?, updated_at = datetime('now') WHERE id = ?", [technician_id, req.params.id]);
  auditFromReq(req, 'assign_breakdown', 'fault', req.params.id, { technician_id });
  res.json({ ok: true });
});

router.patch('/:id/status', (req: Request, res: Response) => {
  const { status, user_id } = req.body;
  const validStatuses = ['submitted', 'analysis', 'inspection', 'validation', 'manufacturing', 'delivery', 'closed'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });

  const existing = queryOne('SELECT * FROM faults WHERE id = ?', [req.params.id]) as any;
  if (!existing) return res.status(404).json({ error: 'Fault not found' });

  const role = req.auth?.role;
  if (role === 'client') return res.status(403).json({ error: 'Accès refusé' });
  if (role === 'technician') {
    const uid = req.auth?.sub;
    const canUpdate =
      !existing.assigned_to ||
      existing.assigned_to === uid ||
      existing.reported_by === uid;
    if (!canUpdate) {
      return res.status(403).json({ error: 'Panne non assignée à vous — demandez à un manager' });
    }
  }

  execute("UPDATE faults SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, req.params.id]);

  const statusLabels: Record<string, string> = {
    submitted: 'Soumis', analysis: 'Analyse', inspection: 'Inspection',
    validation: 'Validation', manufacturing: 'Fabrication', delivery: 'Livraison', closed: 'Clôturé'
  };

  const actor = user_id || req.auth?.sub || null;
  execute(
    'INSERT INTO activities (id, type, message, related_id, related_type, user_id, target_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [uuid(), 'status_change', `Panne "${existing.title}" passée à "${statusLabels[status]}"`, req.params.id, 'fault', actor, existing.reported_by]
  );
  auditFromReq(req, 'update_workflow', 'fault', req.params.id, { from: existing.status, to: status });

  if (status === 'closed') {
    execute("UPDATE equipment SET status = 'active', updated_at = datetime('now') WHERE id = ?", [existing.equipment_id]);
  }

  const fault = queryOne(
    'SELECT f.*, e.name as equipment_name FROM faults f LEFT JOIN equipment e ON f.equipment_id = e.id WHERE f.id = ?',
    [req.params.id]
  );
  res.json(fault);
});

router.post('/:id/report', (req: Request, res: Response) => {
  const fault = queryOne('SELECT * FROM faults WHERE id = ?', [req.params.id]) as any;
  if (!fault) return res.status(404).json({ error: 'Fault not found' });
  if (fault.status !== 'closed') return res.status(400).json({ error: 'Rapport disponible uniquement à la clôture' });
  if (req.auth?.role === 'technician' && fault.assigned_to !== req.auth.sub) {
    return res.status(403).json({ error: 'Non assigné' });
  }

  const { hours_spent, actions_taken, parts_used, estimated_cost, recommendations } = req.body;
  const existing = queryOne('SELECT id FROM intervention_reports WHERE fault_id = ?', [req.params.id]);
  if (existing) {
    execute(
      `UPDATE intervention_reports SET hours_spent = ?, actions_taken = ?, parts_used = ?, estimated_cost = ?, recommendations = ?, technician_id = ? WHERE fault_id = ?`,
      [hours_spent, actions_taken, JSON.stringify(parts_used || []), estimated_cost, recommendations, req.auth?.sub, req.params.id]
    );
  } else {
    execute(
      `INSERT INTO intervention_reports (id, fault_id, technician_id, hours_spent, actions_taken, parts_used, estimated_cost, recommendations)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid(), req.params.id, req.auth?.sub, hours_spent, actions_taken, JSON.stringify(parts_used || []), estimated_cost, recommendations]
    );
  }
  auditFromReq(req, 'submit_report', 'fault', req.params.id, { hours_spent });
  res.json(queryOne('SELECT * FROM intervention_reports WHERE fault_id = ?', [req.params.id]));
});

router.get('/:id/report', (req: Request, res: Response) => {
  const report = queryOne('SELECT * FROM intervention_reports WHERE fault_id = ?', [req.params.id]);
  if (!report) return res.status(404).json({ error: 'No report' });
  res.json(report);
});

router.patch('/:id/images', (req: Request, res: Response) => {
  const { images, mode } = req.body as { images?: string[]; mode?: 'append' | 'replace' };
  if (!Array.isArray(images)) return res.status(400).json({ error: 'images must be an array' });

  const existing = queryOne('SELECT * FROM faults WHERE id = ?', [req.params.id]) as any;
  if (!existing) return res.status(404).json({ error: 'Fault not found' });

  let current: string[] = [];
  try { current = JSON.parse(existing.images || '[]'); } catch { current = []; }
  const next = mode === 'replace' ? images : [...current, ...images];

  execute("UPDATE faults SET images = ?, updated_at = datetime('now') WHERE id = ?", [JSON.stringify(next), req.params.id]);
  execute(
    'INSERT INTO activities (id, type, message, related_id, related_type, user_id) VALUES (?, ?, ?, ?, ?, ?)',
    [uuid(), 'comment', `${images.length} preuve(s) visuelle(s) ajoutée(s) à "${existing.title}"`, req.params.id, 'fault', req.auth?.sub || null]
  );

  res.json({ id: req.params.id, images: next });
});

router.post('/:id/comments', (req: Request, res: Response) => {
  const { user_id, content } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });

  const id = uuid();
  execute(
    'INSERT INTO fault_comments (id, fault_id, user_id, content) VALUES (?, ?, ?, ?)',
    [id, req.params.id, user_id || req.auth?.sub || null, content]
  );

  const comment = queryOne(
    'SELECT fc.*, u.name as user_name FROM fault_comments fc LEFT JOIN users u ON fc.user_id = u.id WHERE fc.id = ?',
    [id]
  );
  res.status(201).json(comment);
});

export default router;
