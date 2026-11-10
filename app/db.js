import { randomUUID } from "node:crypto";
// Database layer. The whole file is ~180 lines.
// Node's built-in SQLite: no npm package, no native compile, real transactions.
import { DatabaseSync } from 'node:sqlite';
import { zoneDate } from './public/time-zone.js';
import {
  mkdirSync, existsSync, readFileSync, writeFileSync, copyFileSync, rmSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

// ------------------------------------------------------ where the data lives
// Until v2.1 this was always <app>/data. The owner's installation taught us why
// that is unsafe: the folder sits inside a git working tree that ignores it, so
// one `git clean -fdx` or a fresh clone silently removes the database, and theirs
// further lived on a Parallels shared folder, where SQLite does not support WAL.
// The database now lives outside the app, in the user's own AppData.
const oldDir = join(root, 'data');

function chooseDataDir() {
  if (process.env.MM_DATA) return process.env.MM_DATA;
  // MM_DB already names a file, so keep the secret, backups and log beside it.
  // This also keeps the test suite pointed at <app>/data, as it always was.
  if (process.env.MM_DB) return dirname(process.env.MM_DB);
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');
    return join(base, 'MachineMaintenance');
  }
  return oldDir;
}

export const DATA_DIR = chooseDataDir();
mkdirSync(DATA_DIR, { recursive: true });

export const DB_PATH = process.env.MM_DB || join(DATA_DIR, 'maintain.db');

// Copied, never moved: if anything goes wrong the old folder is still intact.
/** The database and the files that belong with it must travel together. */
export function copyDataFiles(fromDir, toDir) {
  const copied = [];
  for (const name of ['maintain.db', 'maintain.db-wal', 'maintain.db-shm', 'secret.txt']) {
    const from = join(fromDir, name);
    if (!existsSync(from)) continue;
    copyFileSync(from, join(toDir, name));
    copied.push(name);
  }
  return copied;
}

// Someone upgrading from v2.0 has their database in the old place. Bring it
// along, so upgrading does not look like the data loss this change prevents.
function adoptOldData() {
  // Only when this file chose the new default itself. MM_DB or MM_DATA is a
  // decision the caller has already made and must not be second-guessed.
  if (process.env.MM_DB || process.env.MM_DATA) return;
  if (DATA_DIR === oldDir || existsSync(DB_PATH)) return;
  if (!existsSync(join(oldDir, 'maintain.db'))) return;
  copyDataFiles(oldDir, DATA_DIR);
  console.log(`  adopted the existing database from ${oldDir}`);
  console.log(`  it now lives in ${DATA_DIR}`);
  console.log('  the old copy is still there and can be deleted once you are happy');
}
adoptOldData();

const db = new DatabaseSync(DB_PATH);
// Evaluate a stored UTC timestamp in the workshop calendar (DST-aware).
db.function('workshop_day', (stamp, zone) => zoneDate(stamp, zone));

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
  closed_at    TEXT,
  -- Who owns the job. No REFERENCES clause: SQLite cannot add one via ALTER
  -- TABLE ADD COLUMN, so the app validates the id instead (see server.js).
  -- Users are never deleted, only disabled, so an id cannot dangle.
  assigned_to  INTEGER
);

-- Stages are an append-only timeline, separate from the final labour total.
CREATE TABLE IF NOT EXISTS work_order_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  stage INTEGER NOT NULL,
  message TEXT NOT NULL,
  hours REAL NOT NULL CHECK (hours >= 0),
  author TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(work_order_id, stage)
);
CREATE TABLE IF NOT EXISTS work_update_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  update_id INTEGER NOT NULL REFERENCES work_order_updates(id) ON DELETE CASCADE,
  filename TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pending_uploads (
  id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
  filename TEXT NOT NULL, kind TEXT NOT NULL, original_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS work_update_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  update_id INTEGER NOT NULL UNIQUE REFERENCES work_order_updates(id) ON DELETE CASCADE,
  filename TEXT NOT NULL, original_name TEXT NOT NULL
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

CREATE TABLE IF NOT EXISTS part_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  filename TEXT NOT NULL, kind TEXT NOT NULL, original_name TEXT NOT NULL
);

-- Which parts went into which job (many-to-many).
CREATE TABLE IF NOT EXISTS work_order_parts (
  work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  part_id       INTEGER NOT NULL REFERENCES parts(id) ON DELETE RESTRICT,
  qty           INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (work_order_id, part_id)
);

-- Stage-specific consumption retains the actual price and which update used it.
CREATE TABLE IF NOT EXISTS work_update_parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  update_id INTEGER NOT NULL REFERENCES work_order_updates(id) ON DELETE CASCADE,
  part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE RESTRICT,
  part_name TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_price REAL NOT NULL CHECK (unit_price >= 0)
);
-- Group same-part, same-price stage lines without scanning the whole history.
CREATE INDEX IF NOT EXISTS idx_work_update_parts_group ON work_update_parts(update_id, part_id, unit_price);

-- The table the reviewed repo did not have: real repeating maintenance.
CREATE TABLE IF NOT EXISTS pm_schedule (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id  INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  task          TEXT NOT NULL,
  interval_days INTEGER NOT NULL CHECK (interval_days > 0),
  last_done     TEXT,
  next_due      TEXT NOT NULL
);

-- Sign-in sessions. These used to be a Map in memory, which forgot every
-- session on restart and put the owner back on the login screen every time.
-- Only a SHA-256 of the token is stored: a copy of this file is not a set of
-- usable sessions.
-- One row per setting. Putting workshop settings in a table
-- rather than in the source means changing it is not a code change.
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
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
// The machine's photograph is a file beside the database; this column remembers
// which file. Storing megabytes inside SQLite would make every backup and every
// copy of maintain.db carry them.
ensureColumn('equipment', 'photo', 'TEXT');
ensureColumn('equipment', 'model', 'TEXT');
ensureColumn('equipment', 'serial_number', 'TEXT');

// Since 261106-eqs the machine's *state* is computed from its work orders, and the
// column only records whether an admin withdrew it from service. Any row still
// saying 'down' was written by the old form, so it becomes 'active' and the work
// orders are asked instead. Idempotent: after the first upgrade there is nothing
// to change.
{
  const stale = db.prepare("SELECT COUNT(*) AS n FROM equipment WHERE status = 'down'").get();
  if (Number(stale.n) > 0) {
    db.exec("UPDATE equipment SET status = 'active' WHERE status = 'down'");
    console.log(`  migrated: ${stale.n} machine status(es) now follow their work orders`);
  }
}
// Fixed threshold of 5 became per-part in phase 7; the default keeps every
// existing part behaving exactly as it did before the upgrade.
ensureColumn('parts', 'reorder_level', 'INTEGER NOT NULL DEFAULT 5');
ensureColumn('work_orders', 'assigned_to', 'INTEGER');
ensureColumn('users', 'active', 'INTEGER NOT NULL DEFAULT 1');
ensureColumn('users', 'created_at', "TEXT");
// Time spent on a job. Nullable: a job nobody has costed is not a job that took
// zero hours, and the report says so by counting only what was recorded.
ensureColumn('work_orders', 'labour_hours', 'REAL');
// Upgrade existing totals once, atomically. Their stored final total already
// includes the old stages; only stages added after this baseline are extra.
if (!db.prepare('PRAGMA table_info(work_orders)').all().some((c) => c.name === 'labour_stage_baseline')) {
  db.exec(`BEGIN;
    ALTER TABLE work_orders ADD COLUMN labour_stage_baseline REAL;
    UPDATE work_orders SET labour_stage_baseline =
      (SELECT COALESCE(SUM(hours), 0) FROM work_order_updates WHERE work_order_id = work_orders.id)
      WHERE labour_hours IS NOT NULL;
    COMMIT;`);
}
// Freeze the cost of existing part usage at the catalog price on upgrade.
if (!db.prepare('PRAGMA table_info(work_order_parts)').all().some((c) => c.name === 'cost_total')) {
  db.exec(`BEGIN;
    ALTER TABLE work_order_parts ADD COLUMN cost_total REAL;
    UPDATE work_order_parts SET cost_total = qty * COALESCE((SELECT unit_price FROM parts WHERE id = part_id), 0);
    COMMIT;`);
}
ensureColumn('work_order_updates', 'machine_running', 'INTEGER');
ensureColumn('work_order_updates', 'prior_stops_machine', 'INTEGER');
ensureColumn('work_order_updates', 'edited_by', 'TEXT');
ensureColumn('work_order_updates', 'edited_at', 'TEXT');
// Who reported the fault, as typed. Free text rather than a user id: the person
// who finds the machine making a noise is often standing next to it, not signed
// in — and "Ada on the floor" is still the only lead six hours later.
ensureColumn('work_orders', 'reported_by', 'TEXT');
// A photograph of the fault. The same file-beside-the-database rule as a
// machine's photograph, and the same reason: maintain.db must stay small enough
// to copy onto a stick.
ensureColumn('work_orders', 'photo', 'TEXT');
// What was actually done. A closed job with no account of the repair is a row,
// not a history: six months later "Bearing noise — done" answers nothing.
ensureColumn('work_orders', 'resolution', 'TEXT');
// Who checked the repair. Free text for the same reason as reported_by: the
// person who signs it off on the floor may never sign in.
ensureColumn('work_orders', 'verified_by', 'TEXT');
// Does this job stop the machine? Until 261106-ere the answer was inferred from
// priority and status, which meant reporting a fault could take a running machine
// out of service on the strength of a dropdown nobody thought about. The ticket
// stores this job's last answer; the chronological state reports below decide
// the machine's overall state.
ensureColumn('work_orders', 'stops_machine', 'INTEGER NOT NULL DEFAULT 0');
// Preserve the old state on upgrade. A null event reserves a stage's original
// position without reporting a state, so a later correction cannot jump ahead
// of a newer report on another work order.
const stateTableExists = Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='machine_state_events'").get());
const stateTableSql = `CREATE TABLE machine_state_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  work_order_id INTEGER REFERENCES work_orders(id) ON DELETE CASCADE,
  update_id INTEGER REFERENCES work_order_updates(id) ON DELETE CASCADE,
  running INTEGER CHECK (running IN (0, 1)),
  source TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;
const stateIndexesSql = `CREATE INDEX machine_state_events_latest ON machine_state_events(equipment_id, id DESC);
  CREATE UNIQUE INDEX machine_state_events_stage ON machine_state_events(update_id) WHERE update_id IS NOT NULL;`;
if (!stateTableExists) {
  db.exec(`BEGIN;
    ${stateTableSql}
    ${stateIndexesSql}
    INSERT INTO machine_state_events (equipment_id, work_order_id, update_id, running, source)
      SELECT w.equipment_id, u.work_order_id, u.id, u.machine_running, 'stage'
      FROM work_order_updates u JOIN work_orders w ON w.id = u.work_order_id ORDER BY u.id;
    INSERT INTO machine_state_events (equipment_id, running, source)
      SELECT e.id, CASE WHEN EXISTS (SELECT 1 FROM work_orders w WHERE w.equipment_id=e.id
        AND w.status <> 'done' AND w.stops_machine=1) THEN 0 ELSE 1 END, 'migration' FROM equipment e;
    COMMIT;`);
} else if (db.prepare('PRAGMA table_info(machine_state_events)').all().find((c) => c.name === 'running').notnull) {
  // Migrate a non-null event table without losing its chronological ids.
  db.exec(`BEGIN;
    ALTER TABLE machine_state_events RENAME TO old_machine_state_events;
    DROP INDEX IF EXISTS machine_state_events_latest;
    DROP INDEX IF EXISTS machine_state_events_stage;
    ${stateTableSql}
    INSERT INTO machine_state_events SELECT * FROM old_machine_state_events;
    DROP TABLE old_machine_state_events;
    ${stateIndexesSql}
    COMMIT;`);
}

// A number to hang a conversation on: WO-2026-0001. The id is for the database,
// this is for the whiteboard, the phone call with the vendor and the printed sheet.
ensureColumn('work_orders', 'code', 'TEXT');

// Number the jobs that predate the column, oldest first, per year. Idempotent: a
// row that already has a code is left alone, so this runs once and never renumbers
// anything a person may have written down.
{
  const unnumbered = db.prepare('SELECT COUNT(*) AS n FROM work_orders WHERE code IS NULL').get();
  if (Number(unnumbered.n) > 0) {
    db.exec(`
      WITH numbered AS (
        SELECT id,
               substr(created_at, 1, 4) AS yr,
               ROW_NUMBER() OVER (PARTITION BY substr(created_at, 1, 4)
                                  ORDER BY created_at, id) AS rn
        FROM work_orders WHERE code IS NULL
      )
      UPDATE work_orders
         SET code = (SELECT printf('WO-%s-%04d', n.yr, n.rn) FROM numbered n
                      WHERE n.id = work_orders.id)
       WHERE code IS NULL`);
    console.log(`  migrated: numbered ${unnumbered.n} work order(s)`);
  }
}
// Two jobs cannot share a number. The column is added by ALTER, which cannot carry
// UNIQUE, so the promise is an index.
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_work_orders_code ON work_orders(code)');
// ensureColumn('work_orders', 'assigned_to', 'INTEGER');   <- example

// ---------------------------------------------------------------- helpers
export const all = (sql, ...params) => db.prepare(sql).all(...params);
export const get = (sql, ...params) => db.prepare(sql).get(...params);

// ------------------------------------------------------------ the file copy
// In WAL mode a write lands in maintain.db-wal and is only merged into
// maintain.db later. The owner's database was 4,096 bytes with 78,312 bytes
// sitting in the side file: copying maintain.db alone therefore copied an empty
// database, and nothing on shutdown ever merged it because there was no shutdown
// handler. Every write now merges the side file back, so maintain.db on its own
// is always a complete copy that can be touched, copied or zipped on its own.
const WRITES = /^\s*(insert|update|delete|replace)\b/i;
let openTransactions = 0;

export function checkpoint() {
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  } catch {
    // A reader can hold the file for a moment. Nothing is lost: the write is
    // already durable in the -wal, and the next write tries again.
  }
}

export const run = (sql, ...params) => {
  const result = db.prepare(sql).run(...params);
  if (openTransactions === 0 && WRITES.test(sql)) checkpoint();
  return result;
};

/** Multi-statement write that either fully happens or fully doesn't. */
export function transaction(fn) {
  db.exec('BEGIN');
  openTransactions++;
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally {
    openTransactions--;
    // A checkpoint cannot run inside a transaction, so do it once, at the end.
    if (openTransactions === 0) checkpoint();
  }
}

/** Merge the side file and close. Called on Ctrl+C, and by the tests. */
export function close() {
  checkpoint();
  db.close();
}

/** One-line backup. Run it from a scheduled task; ask for it before upgrades. */
export function backup() {
  // Milliseconds, not seconds: two clicks in the same second used to collide and
  // SQLite answers the second one with "output file already exists", which is the
  // database's sentence, not the user's.
  const stamp = new Date().toISOString().slice(0, 23).replace(/[:T.]/g, '-');
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

// ------------------------------------------------------- the first password
// The password for the first account is printed once, to a console window. If
// that window is closed, the password is gone and there is no way back in: the
// only route that changes a password needs an admin to already be signed in.
// That is what happened to the owner. So the same password is also written next
// to the database, and this file is deleted as soon as that account's password
// is changed. It exists only while the original password is still the live one.
const FIRST_PASSWORD = () => join(DATA_DIR, 'first-password.txt');

export function rememberFirstPassword(password) {
  const file = FIRST_PASSWORD();
  writeFileSync(file, [
    'Machine maintenance — the password for the first account.',
    '',
    '  email:    admin@local',
    `  password: ${password}`,
    '',
    'Sign in, open Users, and set a password you will remember. Changing the',
    'password deletes this file. If you lose it anyway, open a command prompt',
    'in the folder with start.bat, stop the app, and run:',
    '',
    '  node reset-password.js',
    '',
    'It prints a new password. Nothing in the database is deleted.',
    '',
  ].join('\n'), { mode: 0o600 });
  return file;
}

/** Called when admin@local's password changes: the note is stale, so drop it. */
export function forgetFirstPassword() {
  try {
    rmSync(FIRST_PASSWORD(), { force: true });
  } catch {
    // A file that cannot be removed must not stop a password change.
  }
}

export default db;
