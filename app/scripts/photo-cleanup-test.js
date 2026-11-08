// Exercise real filesystem failures without relying on OS-specific permissions.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const dir = fs.mkdtempSync(join(tmpdir(), 'mm-photo-cleanup-'));
process.env.MM_DATA = dir;
delete process.env.MM_DB;
const originalWrite = fs.writeFileSync, originalRemove = fs.rmSync, originalError = console.error;
let db;
try {
  const photos = await import('../photos.js');
  db = await import('../db.js');
  const photoDir = join(dir, 'photos');
  fs.writeFileSync = (...args) => { originalWrite(...args); throw new Error('simulated disk full'); };
  syncBuiltinESMExports();
  assert.throws(() => photos.savePhoto(Buffer.from('89504e470d0a1a0a', 'hex')), /simulated disk full/);
  assert.deepEqual(fs.readdirSync(photoDir), [], 'partial file must be removed on failed write');
  fs.writeFileSync = originalWrite;
  syncBuiltinESMExports();
  const saved = photos.savePhoto(Buffer.from('89504e470d0a1a0a', 'hex'));
  const messages = [];
  console.error = (message) => messages.push(message);
  fs.rmSync = () => { throw new Error('simulated permission error'); };
  syncBuiltinESMExports();
  assert.equal(photos.removePhoto(saved.name), false);
  assert.match(messages[0], /Could not remove photo.*permission error/);
  assert.ok(fs.existsSync(join(photoDir, saved.name)));
  fs.rmSync = originalRemove;
  syncBuiltinESMExports();
  assert.equal(photos.removePhoto(saved.name), true);
  assert.equal(fs.existsSync(join(photoDir, saved.name)), false);
  console.log('Photo cleanup failure handling passed');
} finally {
  fs.writeFileSync = originalWrite; fs.rmSync = originalRemove; console.error = originalError;
  syncBuiltinESMExports();
  db?.close();
  fs.rmSync(dir, { recursive: true, force: true });
}
