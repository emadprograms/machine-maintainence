import { Router, Request, Response } from 'express';
import { queryAll, queryOne, execute } from '../database.js';
import { v4 as uuid } from 'uuid';
import { hashPassword } from '../lib/auth.js';
import { auditFromReq } from '../lib/audit.js';
import { requireAdmin } from '../middleware/authGuard.js';

const router = Router();
router.use(requireAdmin);

function isOnline(lastSeen?: string | null): boolean {
  if (!lastSeen) return false;
  const diff = Date.now() - new Date(lastSeen + 'Z').getTime();
  return diff < 5 * 60 * 1000;
}

// ─── Dashboard / activity ───────────────────────────────────────────────────

router.get('/dashboard', (_req: Request, res: Response) => {
  const companies = (queryOne('SELECT COUNT(*) as c FROM companies') as any)?.c || 0;
  const equipment = (queryOne('SELECT COUNT(*) as c FROM equipment') as any)?.c || 0;
  const activeFaults = (queryOne("SELECT COUNT(*) as c FROM faults WHERE status != 'closed'") as any)?.c || 0;
  const criticalFaults = (queryOne("SELECT COUNT(*) as c FROM faults WHERE priority = 'critical' AND status != 'closed'") as any)?.c || 0;
  const pendingParts = (queryOne("SELECT COUNT(*) as c FROM spare_parts WHERE status IN ('pending','ordered')") as any)?.c || 0;
  const closed = (queryOne("SELECT COUNT(*) as c FROM faults WHERE status = 'closed'") as any)?.c || 0;
  const total = (queryOne('SELECT COUNT(*) as c FROM faults') as any)?.c || 1;
  const resolutionRate = Math.round((closed / total) * 100);

  const onlineUsers = queryAll(`
    SELECT id, name, email, role, last_seen_at FROM users
    WHERE last_seen_at >= datetime('now', '-5 minutes') AND status = 'active'
    ORDER BY last_seen_at DESC
  `).map(u => ({ ...u, online: true }));

  const activity = queryAll(`
    SELECT a.*, u.name as user_name, u.email as user_email
    FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id
    ORDER BY a.created_at DESC LIMIT 30
  `);

  const alerts = queryAll(`
    SELECT f.id, f.title, f.priority, f.status, f.created_at, f.assigned_to,
      e.name as equipment_name, c.name as company_name
    FROM faults f
    LEFT JOIN equipment e ON f.equipment_id = e.id
    LEFT JOIN companies c ON e.company_id = c.id
    WHERE f.status != 'closed' AND (
      (f.priority = 'critical' AND f.assigned_to IS NULL)
      OR (f.assigned_to IS NULL AND f.created_at <= datetime('now', '-2 hours'))
      OR EXISTS (SELECT 1 FROM equipment eq WHERE eq.id = f.equipment_id AND eq.health_score <= 20)
    )
    ORDER BY f.priority DESC, f.created_at ASC LIMIT 10
  `);

  const hourlyActivity = queryAll(`
    SELECT strftime('%H', created_at) as hour, COUNT(*) as count
    FROM audit_logs WHERE created_at >= datetime('now', '-24 hours')
    GROUP BY hour ORDER BY hour
  `);

  const byCompany = queryAll(`
    SELECT c.id, c.name,
      (SELECT COUNT(*) FROM equipment e WHERE e.company_id = c.id) as equipment_count,
      (SELECT COUNT(*) FROM faults f JOIN equipment e ON f.equipment_id = e.id WHERE e.company_id = c.id AND f.status != 'closed') as active_faults
    FROM companies c ORDER BY c.name
  `);

  res.json({
    kpis: { companies, equipment, activeFaults, criticalFaults, pendingParts, resolutionRate },
    onlineUsers,
    activity,
    alerts,
    hourlyActivity,
    byCompany,
  });
});

router.get('/activity', (_req: Request, res: Response) => {
  const activity = queryAll(`
    SELECT a.*, u.name as user_name, u.email as user_email
    FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id
    ORDER BY a.created_at DESC LIMIT 50
  `);
  res.json(activity);
});

router.get('/online-users', (_req: Request, res: Response) => {
  const users = queryAll(`
    SELECT id, name, email, role, last_seen_at, avatar
    FROM users WHERE last_seen_at >= datetime('now', '-5 minutes') AND status = 'active'
    ORDER BY last_seen_at DESC
  `);
  res.json(users);
});

// ─── Users ────────────────────────────────────────────────────────────────────

router.get('/users', (req: Request, res: Response) => {
  const { role, status, company_id, q } = req.query;
  let sql = `
    SELECT u.id, u.name, u.email, u.role, u.status, u.company_id, u.last_login_at, u.last_seen_at, u.created_at, u.approved,
      c.name as company_name
    FROM users u LEFT JOIN companies c ON u.company_id = c.id WHERE 1=1
  `;
  const params: string[] = [];
  if (role) { sql += ' AND u.role = ?'; params.push(String(role)); }
  if (status) { sql += ' AND u.status = ?'; params.push(String(status)); }
  if (company_id) { sql += ' AND u.company_id = ?'; params.push(String(company_id)); }
  if (q) { sql += ' AND (u.name LIKE ? OR u.email LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  sql += ' ORDER BY u.created_at DESC';
  const users = queryAll(sql, params).map(u => ({ ...u, online: isOnline(u.last_seen_at) }));
  res.json(users);
});

router.get('/users/pending', (_req: Request, res: Response) => {
  const pending = queryAll(`
    SELECT u.*, c.name as company_name FROM users u
    LEFT JOIN companies c ON u.company_id = c.id
    WHERE u.approved = 0 OR u.status = 'pending'
    ORDER BY u.created_at DESC
  `);
  res.json(pending);
});

router.post('/users', (req: Request, res: Response) => {
  const { name, email, password, role, company_id } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
  const id = uuid();
  execute(
    'INSERT INTO users (id, name, email, role, password, company_id, status, approved, first_login) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, email.toLowerCase(), role || 'technician', hashPassword(password), company_id || null, 'active', 1, role === 'client' ? 1 : 0]
  );
  auditFromReq(req, 'create_user', 'user', id, { email, role });
  res.status(201).json(queryOne('SELECT id, name, email, role, status, company_id FROM users WHERE id = ?', [id]));
});

router.put('/users/:id/role', (req: Request, res: Response) => {
  const { role } = req.body;
  const valid = ['admin', 'manager', 'technician', 'client'];
  if (!valid.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  const before = queryOne('SELECT role FROM users WHERE id = ?', [req.params.id]) as any;
  if (!before) return res.status(404).json({ error: 'User not found' });
  execute('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
  auditFromReq(req, 'update_user_role', 'user', req.params.id, { from: before.role, to: role });
  res.json({ ok: true });
});

router.put('/users/:id/status', (req: Request, res: Response) => {
  const { status } = req.body;
  if (!['active', 'suspended', 'pending'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  execute('UPDATE users SET status = ? WHERE id = ?', [status, req.params.id]);
  auditFromReq(req, 'suspend_user', 'user', req.params.id, { status });
  res.json({ ok: true });
});

router.put('/users/:id/approve', (req: Request, res: Response) => {
  execute("UPDATE users SET approved = 1, status = 'active' WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

router.delete('/users/:id', (req: Request, res: Response) => {
  if (req.params.id === req.auth?.sub) return res.status(400).json({ error: 'Cannot delete yourself' });
  execute('DELETE FROM users WHERE id = ?', [req.params.id]);
  auditFromReq(req, 'suspend_user', 'user', req.params.id, { deleted: true });
  res.json({ ok: true });
});

router.get('/users/:id/activity', (req: Request, res: Response) => {
  const logs = queryAll(
    'SELECT * FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
    [req.params.id]
  );
  res.json(logs);
});

router.post('/users/:id/reset-password', (req: Request, res: Response) => {
  const tempPassword = req.body.password || `reset-${uuid().slice(0, 8)}`;
  execute('UPDATE users SET password = ? WHERE id = ?', [hashPassword(tempPassword), req.params.id]);
  res.json({ tempPassword });
});

// ─── Companies ────────────────────────────────────────────────────────────────

router.get('/companies', (_req: Request, res: Response) => {
  const companies = queryAll(`
    SELECT c.*,
      (SELECT COUNT(*) FROM equipment e WHERE e.company_id = c.id) as equipment_count,
      (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id) as user_count,
      (SELECT COUNT(*) FROM faults f JOIN equipment e ON f.equipment_id = e.id WHERE e.company_id = c.id AND f.status != 'closed') as active_faults
    FROM companies c ORDER BY c.name
  `);
  res.json(companies);
});

router.post('/companies', (req: Request, res: Response) => {
  const { name, sector, country } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const id = uuid();
  execute('INSERT INTO companies (id, name, sector, country) VALUES (?, ?, ?, ?)', [id, name, sector || null, country || 'France']);
  auditFromReq(req, 'create_company', 'company', id, { name });
  res.status(201).json(queryOne('SELECT * FROM companies WHERE id = ?', [id]));
});

router.put('/companies/:id', (req: Request, res: Response) => {
  const { name, sector, country } = req.body;
  execute('UPDATE companies SET name = COALESCE(?, name), sector = COALESCE(?, sector), country = COALESCE(?, country) WHERE id = ?',
    [name, sector, country, req.params.id]);
  auditFromReq(req, 'update_company', 'company', req.params.id, { name, sector, country });
  res.json(queryOne('SELECT * FROM companies WHERE id = ?', [req.params.id]));
});

router.get('/companies/:id/stats', (req: Request, res: Response) => {
  const id = req.params.id;
  const equipment = queryAll('SELECT * FROM equipment WHERE company_id = ?', [id]);
  const faults = queryAll(`
    SELECT f.*, e.name as equipment_name FROM faults f
    JOIN equipment e ON f.equipment_id = e.id WHERE e.company_id = ?
    ORDER BY f.created_at DESC
  `, [id]);
  const users = queryAll('SELECT id, name, email, role FROM users WHERE company_id = ?', [id]);
  const partsCost = queryOne(`
    SELECT COALESCE(SUM(sp.unit_price * sp.quantity), 0) as total FROM spare_parts sp
    JOIN faults f ON sp.fault_id = f.id JOIN equipment e ON f.equipment_id = e.id WHERE e.company_id = ?
  `, [id]) as any;
  res.json({ equipment, faults, users, partsCost: partsCost?.total || 0 });
});

// ─── Breakdowns supervision ───────────────────────────────────────────────────

router.get('/breakdowns', (req: Request, res: Response) => {
  const { company_id, priority, status, assigned_to } = req.query;
  let sql = `
    SELECT f.*, e.name as equipment_name, e.location, e.company_id,
      c.name as company_name, u.name as assigned_name, r.name as reporter_name
    FROM faults f
    LEFT JOIN equipment e ON f.equipment_id = e.id
    LEFT JOIN companies c ON e.company_id = c.id
    LEFT JOIN users u ON f.assigned_to = u.id
    LEFT JOIN users r ON f.reported_by = r.id WHERE 1=1
  `;
  const params: string[] = [];
  if (company_id) { sql += ' AND e.company_id = ?'; params.push(String(company_id)); }
  if (priority) { sql += ' AND f.priority = ?'; params.push(String(priority)); }
  if (status) { sql += ' AND f.status = ?'; params.push(String(status)); }
  if (assigned_to === 'none') { sql += ' AND f.assigned_to IS NULL'; }
  else if (assigned_to) { sql += ' AND f.assigned_to = ?'; params.push(String(assigned_to)); }
  sql += ' ORDER BY CASE f.priority WHEN "critical" THEN 0 WHEN "high" THEN 1 WHEN "medium" THEN 2 ELSE 3 END, f.created_at DESC';
  res.json(queryAll(sql, params));
});

router.patch('/breakdowns/:id/assign', (req: Request, res: Response) => {
  const { technician_id } = req.body;
  execute("UPDATE faults SET assigned_to = ?, updated_at = datetime('now') WHERE id = ?", [technician_id || null, req.params.id]);
  auditFromReq(req, 'assign_breakdown', 'fault', req.params.id, { technician_id });
  res.json({ ok: true });
});

// ─── Audit ────────────────────────────────────────────────────────────────────

router.get('/audit', (req: Request, res: Response) => {
  const { user_id, action, from, to } = req.query;
  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params: string[] = [];
  if (user_id) { sql += ' AND user_id = ?'; params.push(String(user_id)); }
  if (action) { sql += ' AND action = ?'; params.push(String(action)); }
  if (from) { sql += ' AND created_at >= ?'; params.push(String(from)); }
  if (to) { sql += ' AND created_at <= ?'; params.push(String(to)); }
  sql += ' ORDER BY created_at DESC LIMIT 200';
  res.json(queryAll(sql, params));
});

// ─── Settings ─────────────────────────────────────────────────────────────────

router.get('/settings', (_req: Request, res: Response) => {
  const rows = queryAll('SELECT key, value FROM system_settings');
  const settings: Record<string, unknown> = {};
  for (const r of rows) {
    try { settings[r.key] = JSON.parse(r.value); } catch { settings[r.key] = r.value; }
  }
  res.json({
    ...settings,
    services: { mongodb: false, database: 'sqlite', gemini: false, status: 'ok' },
  });
});

router.put('/settings', (req: Request, res: Response) => {
  for (const [key, value] of Object.entries(req.body)) {
    if (key === 'services') continue;
    const val = typeof value === 'string' ? value : JSON.stringify(value);
    execute('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)', [key, val]);
  }
  res.json({ ok: true });
});

export default router;
