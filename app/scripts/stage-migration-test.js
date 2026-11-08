// Upgrade a pre-stage-cost database and verify the migration is idempotent.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { effectiveHours } from '../hours.js';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'mm-stage-migrate-'));
const file = join(dir, 'maintain.db');
const boot = () => {
  const { MM_DB, ...environment } = process.env;
  const result = spawnSync(process.execPath, ['--no-warnings=ExperimentalWarning', '-e', "import('./db.js').then(m => m.close())"],
    { cwd: root, env: { ...environment, MM_DATA: dir }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
};
try {
  boot();
  let db = new DatabaseSync(file);
  db.exec(`PRAGMA foreign_keys = ON;
    INSERT INTO equipment (id, name) VALUES (1, 'Existing machine');
    INSERT INTO parts (id, name, qty, unit_price) VALUES (1, 'Existing part', 4, 4.5);
    INSERT INTO work_orders (id, equipment_id, title, status, labour_hours, code) VALUES (1, 1, 'Existing job', 'done', 7, 'WO-2026-0001');
    INSERT INTO work_order_updates (id, work_order_id, stage, message, hours, author) VALUES (1, 1, 1, 'Old stage', 2, 'Admin');
    INSERT INTO work_order_parts (work_order_id, part_id, qty, cost_total) VALUES (1, 1, 2, 9);
    INSERT INTO work_orders (id, equipment_id, title, status, code) VALUES (2, 1, 'Unfinalized job', 'in_progress', 'WO-2026-0002');
    INSERT INTO work_order_updates (work_order_id, stage, message, hours, author) VALUES (2, 1, 'First', 0.1, 'Admin'), (2, 2, 'Second', 0.2, 'Admin');
    DROP TABLE work_update_parts;
    ALTER TABLE work_order_parts DROP COLUMN cost_total;
    ALTER TABLE work_orders DROP COLUMN labour_stage_baseline;
    ALTER TABLE work_order_updates DROP COLUMN machine_running;`);
  db.close();
  boot();
  db = new DatabaseSync(file);
  assert.equal(db.prepare('SELECT labour_stage_baseline FROM work_orders').get().labour_stage_baseline, 2);
  assert.equal(db.prepare('SELECT cost_total FROM work_order_parts').get().cost_total, 9);
  assert.equal(db.prepare(`SELECT ${effectiveHours()} AS hours FROM work_orders w WHERE w.id = 1`).get().hours, 7);
  assert.equal(db.prepare(`SELECT ${effectiveHours()} AS hours FROM work_orders w WHERE w.id = 2`).get().hours, 0.3);
  db.exec(`UPDATE parts SET unit_price = 20;
    INSERT INTO work_order_updates (work_order_id, stage, message, hours, author) VALUES (1, 2, 'New stage', 0.5, 'Admin');`);
  db.close();
  boot(); // Never re-baseline or recalculate historical cost on restart.
  db = new DatabaseSync(file);
  assert.equal(db.prepare('SELECT labour_stage_baseline FROM work_orders').get().labour_stage_baseline, 2);
  assert.equal(db.prepare('SELECT cost_total FROM work_order_parts').get().cost_total, 9);
  assert.equal(db.prepare(`SELECT ${effectiveHours()} AS hours FROM work_orders w WHERE w.id = 1`).get().hours, 7.5);
  db.close();
  console.log('Stage hours and cost migration passed');
} finally { rmSync(dir, { recursive: true, force: true }); }
