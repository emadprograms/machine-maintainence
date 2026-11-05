import { randomUUID } from "node:crypto";
// Database layer. The whole file is ~100 lines.
// Node's built-in SQLite: no npm package, no native compile, real transactions.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = join(root, 'data');
mkdirSync(DATA_DIR, { recursive: true });

export const DB_PATH = process.env.MM_DB || join(DATA_DIR, 'maintain.db');

const db = new DatabaseSync(DB_PATH);

// WAL = writes go to a small side file and are committed atomically.
// This is why we never rewrite the whole database on every request
// (the thing the reviewed repo did with sql.js).
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');   // FK + CHECK constraints are enforced
db.exec('PRAGMA busy_timeout = 5000'); // wait, don't fail, if a write is in progress

// ---------------------------------------------------------------- schema
// Add a table here. `IF NOT EXISTS` makes this safe to run on every start.
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin','tech')),
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS equipment (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  asset_tag  TEXT,
  category   TEXT,
  location   TEXT,
  status     TEXT NOT NULL DEFAULT 'active'
             CHECK (status IN ('active','down','retired')),
  notes      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS work_orders (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  notes        TEXT,
  priority     TEXT NOT NULL DEFAULT 'medium'
               CHECK (priority IN ('low','medium','high')),
  status       TEXT NOT NULL DEFAULT 'open'
               CHECK (status IN ('open','in_progress','done')),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at    TEXT
);

CREATE TABLE IF NOT EXISTS parts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  reference     TEXT,
  qty           INTEGER NOT NULL DEFAULT 0,
  unit_price    REAL,
  supplier      TEXT,
  reorder_level INTEGER NOT NULL DEFAULT 5
);

-- Which parts went into which job (many-to-many).
CREATE TABLE IF NOT EXISTS work_order_parts (
  work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  part_id       INTEGER NOT NULL REFERENCES parts(id) ON DELETE RESTRICT,
  qty           INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (work_order_id, part_id)
);

-- The table the reviewed repo did not have: real repeating maintenance.
CREATE TABLE IF NOT EXISTS pm_schedule (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id  INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  task          TEXT NOT NULL,
  interval_days INTEGER NOT NULL CHECK (interval_days > 0),
  last_done     TEXT,
  next_due      TEXT NOT NULL
);
`);

// --------------------------------------------------- adding a column later
// Taken from the reviewed repo (backend/src/database.ts:364): a small helper
// that adds a column only if it is missing, so old database files keep working.
// To add a field: put it in the CREATE TABLE above AND add one line here.
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`  migrated: added ${table}.${column}`);
  }
}

ensureColumn('equipment', 'manufacturer', 'TEXT');
// Fixed threshold of 5 became per-part in phase 7; the default keeps every
// existing part behaving exactly as it did before the upgrade.
ensureColumn('parts', 'reorder_level', 'INTEGER NOT NULL DEFAULT 5');
ensureColumn('users', 'active', 'INTEGER NOT NULL DEFAULT 1');
ensureColumn('users', 'created_at', "TEXT");
// ensureColumn('work_orders', 'assigned_to', 'INTEGER');   <- example

// ---------------------------------------------------------------- helpers
export const all = (sql, ...params) => db.prepare(sql).all(...params);
export const get = (sql, ...params) => db.prepare(sql).get(...params);
export const run = (sql, ...params) => db.prepare(sql).run(...params);

/** Multi-statement write that either fully happens or fully doesn't. */
export function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/** One-line backup. Run it from a scheduled task; ask for it before upgrades. */
export function backup() {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const target = join(DATA_DIR, `backup-${stamp}.db`);
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  return target;
}

/** A secret that is generated once and kept next to the data. */
export function machineSecret() {
  const file = join(DATA_DIR, 'secret.txt');
  if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  const secret = randomUUID() + randomUUID();
  writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

export default db;
