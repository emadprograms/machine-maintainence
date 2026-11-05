import { Router, Request, Response } from 'express';
import { queryOne, execute } from '../database.js';
import { v4 as uuid } from 'uuid';
import { verifyPassword, hashPassword, signToken, verifyToken, TokenPayload } from '../lib/auth.js';
import { auditFromReq } from '../lib/audit.js';

const router = Router();

const SELF_SIGNUP_ROLES = ['technician', 'manager', 'client'];

function safeUserSelect() {
  return 'id, name, email, role, avatar, company_id, status, first_login, phone, approved, created_at, last_login_at';
}

router.post('/register', (req: Request, res: Response) => {
  const { name, email, password, role, company_id } = req.body as {
    name?: string; email?: string; password?: string; role?: string; company_id?: string;
  };

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nom, email et mot de passe requis' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Adresse e-mail invalide' });
  }

  const existing = queryOne('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
  if (existing) return res.status(409).json({ error: 'Un compte existe déjà avec cet email' });

  const safeRole = SELF_SIGNUP_ROLES.includes(String(role)) ? String(role) : 'technician';
  const isClient = safeRole === 'client';
  const id = uuid();
  execute(
    `INSERT INTO users (id, name, email, role, password, company_id, status, approved, first_login)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, String(name).trim(), normalizedEmail, safeRole, hashPassword(password),
      company_id || null,
      isClient ? 'pending' : 'active',
      isClient ? 0 : 1,
      isClient ? 1 : 0,
    ]
  );

  if (isClient) {
    return res.status(201).json({ message: 'Inscription en attente de validation par un administrateur' });
  }

  const user = queryOne(`SELECT ${safeUserSelect()} FROM users WHERE id = ?`, [id]) as any;
  const token = signToken({ sub: user.id, role: user.role, email: user.email });
  res.status(201).json({ user, token });
});

router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

  const user = queryOne('SELECT * FROM users WHERE email = ?', [String(email).trim().toLowerCase()]) as any;
  if (!user || !verifyPassword(password, user.password)) {
    return res.status(401).json({ error: 'Identifiants invalides' });
  }
  if (user.status === 'suspended') return res.status(403).json({ error: 'Compte suspendu' });
  if (user.approved === 0 || user.status === 'pending') {
    return res.status(403).json({ error: 'Compte en attente de validation administrateur' });
  }

  execute("UPDATE users SET last_login_at = datetime('now'), last_seen_at = datetime('now') WHERE id = ?", [user.id]);
  auditFromReq({ auth: { sub: user.id, email: user.email, role: user.role }, ip: req.ip, headers: req.headers }, 'login');

  const { password: _pw, ...safeUser } = user;
  const token = signToken({ sub: user.id, role: user.role, email: user.email });
  res.json({ user: safeUser, token });
});

router.get('/me', (req: Request, res: Response) => {
  const payload = getPayload(req);
  if (!payload) return res.status(401).json({ error: 'Session invalide ou expirée' });
  const user = queryOne(`SELECT ${safeUserSelect()} FROM users WHERE id = ?`, [payload.sub]);
  if (!user) return res.status(401).json({ error: 'Utilisateur introuvable' });
  res.json({ user });
});

router.put('/me', (req: Request, res: Response) => {
  const payload = getPayload(req);
  if (!payload) return res.status(401).json({ error: 'Session invalide' });
  const { name, phone } = req.body;
  execute('UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone) WHERE id = ?',
    [name, phone, payload.sub]);
  const user = queryOne(`SELECT ${safeUserSelect()} FROM users WHERE id = ?`, [payload.sub]);
  res.json({ user });
});

router.put('/me/password', (req: Request, res: Response) => {
  const payload = getPayload(req);
  if (!payload) return res.status(401).json({ error: 'Session invalide' });
  const { currentPassword, newPassword } = req.body;
  const user = queryOne('SELECT password FROM users WHERE id = ?', [payload.sub]) as any;
  if (!user || !verifyPassword(currentPassword, user.password)) {
    return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
  }
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: 'Nouveau mot de passe trop court (6 caractères min.)' });
  }
  execute('UPDATE users SET password = ? WHERE id = ?', [hashPassword(newPassword), payload.sub]);
  res.json({ ok: true });
});

router.put('/me/onboarding-done', (req: Request, res: Response) => {
  const payload = getPayload(req);
  if (!payload) return res.status(401).json({ error: 'Session invalide' });
  execute('UPDATE users SET first_login = 0 WHERE id = ?', [payload.sub]);
  res.json({ ok: true });
});

function getPayload(req: Request): TokenPayload | null {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : undefined;
  return verifyToken(token);
}

export default router;
