// A prior installation has no state-event table. Upgrade must preserve the
// existing derived state, be idempotent, and continue to honor retirement.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'mm-state-migrate-'));
const file = join(dir, 'maintain.db');
const boot = () => {
  const { MM_DB, ...environment } = process.env;
  const r = spawnSync(process.execPath, ['--no-warnings=ExperimentalWarning', '-e', "import('./db.js').then(m => m.close())"],
    { cwd: root, env: { ...environment, MM_DATA: dir }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
};
try {
  boot();
  let db = new DatabaseSync(file);
  db.exec(`INSERT INTO equipment (id,name,status) VALUES (1,'Down machine','active'), (2,'Running machine','active'), (3,'Retired','retired');
    INSERT INTO work_orders (id,equipment_id,title,status,stops_machine,code) VALUES
      (1,1,'Old fault','open',1,'WO-2026-1001'), (2,2,'Routine','open',0,'WO-2026-1002');
    INSERT INTO work_order_updates (id,work_order_id,stage,message,hours,author,machine_running) VALUES
      (1,1,1,'Old running answer',1,'Old tech',1), (2,2,1,'Old unanswered',1,'Old tech',NULL);
    DROP TABLE machine_state_events;`);
  db.close();
  boot();
  db = new DatabaseSync(file);
  assert.deepEqual(db.prepare("SELECT equipment_id,running FROM machine_state_events WHERE source='migration' ORDER BY equipment_id").all()
    .map((r) => [r.equipment_id, r.running]), [[1, 0], [2, 1], [3, 1]]);
  assert.deepEqual(db.prepare("SELECT update_id,running FROM machine_state_events WHERE source='stage' ORDER BY id").all()
    .map((r) => [r.update_id, r.running]), [[1, 1], [2, null]]);
  assert.ok(db.prepare("SELECT MIN(id) AS n FROM machine_state_events WHERE source='migration'").get().n
    > db.prepare("SELECT MAX(id) AS n FROM machine_state_events WHERE source='stage'").get().n);
  db.exec("INSERT INTO machine_state_events (equipment_id,running,source) VALUES (1,1,'stage')");
  db.close();
  boot();
  db = new DatabaseSync(file);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM machine_state_events').get().n, 6);
  assert.equal(db.prepare('SELECT running FROM machine_state_events WHERE equipment_id=1 ORDER BY id DESC LIMIT 1').get().running, 1);
  assert.equal(db.prepare('SELECT status FROM equipment WHERE id=3').get().status, 'retired');
  // Simulate the intermediate non-null event schema and ensure its ids survive
  // conversion, including unique indexes and subsequent restarts.
  db.exec(`DELETE FROM machine_state_events WHERE running IS NULL;
    ALTER TABLE machine_state_events RENAME TO old_events;
    DROP INDEX machine_state_events_latest; DROP INDEX machine_state_events_stage;
    CREATE TABLE machine_state_events (id INTEGER PRIMARY KEY AUTOINCREMENT, equipment_id INTEGER NOT NULL,
      work_order_id INTEGER, update_id INTEGER, running INTEGER NOT NULL, source TEXT NOT NULL, created_at TEXT NOT NULL);
    INSERT INTO machine_state_events SELECT * FROM old_events; DROP TABLE old_events;
    CREATE INDEX machine_state_events_latest ON machine_state_events(equipment_id, id DESC);
    CREATE UNIQUE INDEX machine_state_events_stage ON machine_state_events(update_id) WHERE update_id IS NOT NULL;`);
  const ids = db.prepare('SELECT id FROM machine_state_events ORDER BY id').all().map((r) => r.id);
  db.close(); boot();
  db = new DatabaseSync(file);
  assert.equal(db.prepare('PRAGMA table_info(machine_state_events)').all().find((r) => r.name === 'running').notnull, 0);
  assert.deepEqual(db.prepare('SELECT id FROM machine_state_events ORDER BY id').all().map((r) => r.id), ids);
  db.exec("INSERT INTO machine_state_events (equipment_id,running,source) VALUES (1,NULL,'stage')");
  db.close(); boot();
  console.log('Machine state migration passed');
} finally { rmSync(dir, { recursive: true, force: true }); }
