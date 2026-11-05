import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { hashPassword, isHashed } from './lib/auth.js';
import { loadImageCatalog } from './lib/imageCatalog.js';
import { backendDistDir } from './lib/paths.js';

const isServerless = Boolean(
  process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME,
);
const defaultDbPath = isServerless
  ? '/tmp/maintainx.db'
  : path.join(backendDistDir(), '..', 'maintainx.db');
const dbPath = process.env.MAINTAINX_DB_PATH || defaultDbPath;
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

function locateSqlJsWasm(file: string): string {
  const candidates = [
    path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file),
    path.join('/var/task', 'node_modules', 'sql.js', 'dist', file),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return `https://sql.js.org/dist/${file}`;
}

let db: SqlJsDatabase;

export async function initDb(): Promise<SqlJsDatabase> {
  if (db) return db;

  const SQL = await initSqlJs(
    isServerless ? { locateFile: locateSqlJsWasm } : undefined,
  );

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'technician' CHECK(role IN ('admin','manager','technician')),
      password_hash TEXT NOT NULL DEFAULT '',
      avatar TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS equipment (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      location TEXT,
      technical_sheet TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','maintenance','retired')),
      health_score INTEGER DEFAULT 100 CHECK(health_score BETWEEN 0 AND 100),
      last_maintenance TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS faults (
      id TEXT PRIMARY KEY,
      equipment_id TEXT NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('low','medium','high','critical')),
      status TEXT DEFAULT 'submitted' CHECK(status IN ('submitted','analysis','inspection','validation','manufacturing','delivery','closed')),
      images TEXT DEFAULT '[]',
      reported_by TEXT REFERENCES users(id),
      assigned_to TEXT REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS spare_parts (
      id TEXT PRIMARY KEY,
      fault_id TEXT REFERENCES faults(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      reference TEXT,
      quantity INTEGER DEFAULT 1,
      unit_price REAL DEFAULT 0,
      supplier TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','ordered','received','installed','cancelled')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('fault_created','status_change','part_ordered','part_received','comment','maintenance_due','equipment_added')),
      message TEXT NOT NULL,
      related_id TEXT,
      related_type TEXT,
      user_id TEXT REFERENCES users(id),
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS fault_comments (
      id TEXT PRIMARY KEY,
      fault_id TEXT NOT NULL REFERENCES faults(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id),
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  runMigrations();

  saveDb();
  return db;
}

/** Idempotent schema migrations (sql.js has no IF NOT EXISTS for columns). */
function runMigrations(): void {
  ensureColumn('equipment', 'images', "TEXT DEFAULT '[]'");
  ensureColumn('equipment', 'company_id', 'TEXT');
  ensureColumn('users', 'password', "TEXT DEFAULT 'demo1234'");
  ensureColumn('users', 'company_id', 'TEXT');
  ensureColumn('users', 'status', "TEXT DEFAULT 'active'");
  ensureColumn('users', 'last_seen_at', 'TEXT');
  ensureColumn('users', 'last_login_at', 'TEXT');
  ensureColumn('users', 'first_login', 'INTEGER DEFAULT 1');
  ensureColumn('users', 'phone', 'TEXT');
  ensureColumn('users', 'approved', 'INTEGER DEFAULT 1');
  hashLegacyPasswords();
  migrateUserRoles();
  ensureCompaniesTable();
  ensureAuditLogsTable();
  ensureInterventionReportsTable();
  ensureSystemSettingsTable();
  ensureNotificationTargetsColumn();
  seedDefaultSettings();
  migrateDemoCompany();
  migrateMaintenanceDates();
  migrateExplicitImages();
}

function migrateDemoCompany(): void {
  const count = (queryOne('SELECT COUNT(*) as c FROM companies') as any)?.c || 0;
  if (count > 0) return;

  const companyId = uuid();
  execute('INSERT INTO companies (id, name, sector, country) VALUES (?, ?, ?, ?)',
    [companyId, 'TechCorp Industrie', 'Manufacturing', 'France']);
  execute('UPDATE equipment SET company_id = ? WHERE company_id IS NULL', [companyId]);

  const clientExists = queryOne("SELECT id FROM users WHERE email = 'client@techcorp.com'");
  if (!clientExists) {
    const id = uuid();
    execute(
      `INSERT INTO users (id, name, email, role, password, company_id, status, approved, first_login)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, 'Marie Client', 'client@techcorp.com', 'client', hashPassword('demo1234'), companyId, 'active', 1, 1]
    );
  }

  // Assign some faults to technicians
  const thomas = queryOne("SELECT id FROM users WHERE email = 'thomas@maintainx.com'") as any;
  if (thomas?.id) {
    execute("UPDATE faults SET assigned_to = ? WHERE assigned_to IS NULL AND priority IN ('critical','high')", [thomas.id]);
  }
}

function migrateMaintenanceDates(): void {
  const rows = queryAll('SELECT id, last_maintenance FROM equipment WHERE last_maintenance IS NULL');
  let offset = 0;
  for (const row of rows as any[]) {
    execute("UPDATE equipment SET last_maintenance = date('now', ?) WHERE id = ?", [`-${offset * 14} days`, row.id]);
    offset++;
  }
}

function migrateExplicitImages(): void {
  const catalog = loadImageCatalog();
  const current = (queryOne("SELECT value FROM system_settings WHERE key = 'image_catalog_version'") as { value?: string } | undefined)?.value;
  if (current === String(catalog.version)) return;

  for (const [name, urls] of Object.entries(catalog.equipmentByName)) {
    execute('UPDATE equipment SET images = ? WHERE name = ?', [JSON.stringify(urls), name]);
  }

  const equipmentRows = queryAll('SELECT id, name, category FROM equipment');
  for (const row of equipmentRows as { id: string; name: string; category: string }[]) {
    if (catalog.equipmentByName[row.name]) continue;
    const urls = catalog.categoryFallback[row.category] || catalog.defaultEquipment;
    execute('UPDATE equipment SET images = ? WHERE id = ?', [JSON.stringify(urls), row.id]);
  }

  const faults = queryAll(`
    SELECT f.id, f.title, f.description, f.priority, e.name AS equipment_name, e.category AS equipment_category
    FROM faults f JOIN equipment e ON e.id = f.equipment_id
  `);
  for (const f of faults as { id: string; title: string; description: string; priority: string; equipment_name: string; equipment_category: string }[]) {
    const haystack = `${f.title} ${f.description} ${f.equipment_name} ${f.equipment_category}`.toLowerCase();
    let urls: string[] | null = null;
    for (const rule of catalog.faultPatterns) {
      if (new RegExp(rule.match, 'i').test(haystack)) {
        urls = rule.images;
        break;
      }
    }
    if (!urls) urls = catalog.faultPriorityFallback[f.priority] || catalog.faultPriorityFallback.medium;
    execute('UPDATE faults SET images = ? WHERE id = ?', [JSON.stringify(urls), f.id]);
  }

  execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('image_catalog_version', ?)", [String(catalog.version)]);
}

function migrateUserRoles(): void {
  const row = queryOne("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'") as { sql?: string } | undefined;
  if (row?.sql?.includes("'client'")) return;

  db.run('PRAGMA foreign_keys = OFF');
  db.run(`
    CREATE TABLE IF NOT EXISTS users_new (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'technician' CHECK(role IN ('admin','manager','technician','client')),
      avatar TEXT,
      password TEXT,
      company_id TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','suspended','pending')),
      last_seen_at TEXT,
      last_login_at TEXT,
      first_login INTEGER DEFAULT 1,
      phone TEXT,
      approved INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    INSERT INTO users_new (id, name, email, role, avatar, password, company_id, status, last_seen_at, last_login_at, first_login, phone, approved, created_at)
    SELECT id, name, email, role, avatar, password,
      company_id, COALESCE(status, 'active'),
      last_seen_at, last_login_at, COALESCE(first_login, 1), phone, COALESCE(approved, 1), created_at
    FROM users
  `);
  db.run('DROP TABLE users');
  db.run('ALTER TABLE users_new RENAME TO users');
  db.run('PRAGMA foreign_keys = ON');
}

function ensureCompaniesTable(): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sector TEXT,
      country TEXT DEFAULT 'France',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

function ensureAuditLogsTable(): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_email TEXT,
      user_role TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      ip TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC)');
}

function ensureInterventionReportsTable(): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS intervention_reports (
      id TEXT PRIMARY KEY,
      fault_id TEXT NOT NULL UNIQUE REFERENCES faults(id) ON DELETE CASCADE,
      technician_id TEXT REFERENCES users(id),
      hours_spent REAL DEFAULT 0,
      actions_taken TEXT,
      parts_used TEXT DEFAULT '[]',
      estimated_cost REAL DEFAULT 0,
      recommendations TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

function ensureSystemSettingsTable(): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
}

function ensureNotificationTargetsColumn(): void {
  ensureColumn('activities', 'target_user_id', 'TEXT');
  ensureColumn('activities', 'target_role', 'TEXT');
}

function seedDefaultSettings(): void {
  const defaults: Record<string, string> = {
    risk_score_alert: '80',
    unassigned_hours_alert: '2',
    maintenance_mode: 'false',
    equipment_categories: JSON.stringify(['Presses', 'Convoyeurs', 'Robots', 'Compresseurs', 'Centrifugeuses', 'Fours', 'Pompes']),
  };
  for (const [key, value] of Object.entries(defaults)) {
    const exists = queryOne('SELECT key FROM system_settings WHERE key = ?', [key]);
    if (!exists) execute('INSERT INTO system_settings (key, value) VALUES (?, ?)', [key, value]);
  }
}

/** Replace any plaintext password with a scrypt hash (idempotent). */
function hashLegacyPasswords(): void {
  const stmt = db.prepare('SELECT id, password FROM users');
  const rows: { id: string; password: string }[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as { id: string; password: string });
  }
  stmt.free();
  for (const row of rows) {
    if (!isHashed(row.password)) {
      db.run('UPDATE users SET password = ? WHERE id = ?', [hashPassword(row.password || 'demo1234'), row.id]);
    }
  }
}

function ensureColumn(table: string, column: string, definition: string): void {
  const stmt = db.prepare(`PRAGMA table_info(${table})`);
  const columns: string[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as { name?: string };
    if (row.name) columns.push(row.name);
  }
  stmt.free();
  if (!columns.includes(column)) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function saveDb(): void {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

export function getDb(): SqlJsDatabase {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

function queryAll(sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function queryOne(sql: string, params: any[] = []): any | undefined {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : undefined;
}

function execute(sql: string, params: any[] = []): void {
  if (params.length > 0) {
    db.run(sql, params);
  } else {
    db.run(sql);
  }
  saveDb();
}

export { queryAll, queryOne, execute };
export default { initDb, getDb, saveDb, queryAll, queryOne, execute };
