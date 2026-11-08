// Photographs of machines, kept as files beside the database.
//
// Three rules, and all three are about not trusting the browser:
//
//   1. The type is decided by the first bytes of the file, never by the
//      Content-Type header and never by the extension in a filename.
//   2. The name is chosen here, with a random component. The client's filename is
//      not stored, so a name like ../../auth.js cannot exist.
//   3. The size is capped while reading, in http.js, before anything is buffered.
//
// Files live in <data>/photos rather than inside maintain.db: a workshop's backup
// is copied by hand, and a database that carries 200 photographs is a database
// nobody can email.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DATA_DIR } from './db.js';

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;   // 2 MB: a phone photo, resized

const DIR = join(DATA_DIR, 'photos');
mkdirSync(DIR, { recursive: true });

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** What the bytes actually are, or null. This is the only type check that matters. */
export function sniff(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { type: 'image/jpeg', ext: 'jpg' };
  }
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG)) {
    return { type: 'image/png', ext: 'png' };
  }
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF'
      && bytes.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { type: 'image/webp', ext: 'webp' };
  }
  return null;
}

const typeOf = (name) => (name.endsWith('.png') ? 'image/png'
  : name.endsWith('.webp') ? 'image/webp' : 'image/jpeg');

/** A filename this module made up. Never the one the client sent. */
const freshName = (ext) => `${Date.now()}-${randomUUID()}.${ext}`;

/** Store the bytes. Returns { name, type } or { error }. */
export function savePhoto(bytes) {
  const kind = sniff(bytes);
  if (!kind) return { error: 'That file is not a JPEG, PNG or WebP image' };
  const name = freshName(kind.ext);
  try { writeFileSync(join(DIR, name), bytes, { mode: 0o600 }); }
  catch (error) { removePhoto(name); throw error; }
  return { name, type: kind.type };
}

/** The bytes of a stored photograph, or null. The name is re-checked here so a
 *  value from the database can never become a path. */
export function readPhoto(name) {
  if (!name || !/^[\w.-]+$/.test(name) || name.includes('..')) return null;
  const file = join(DIR, name);
  return existsSync(file) ? readFileSync(file) : null;
}

export const photoType = typeOf;

/** Delete a stored file. Missing is fine; other failures must not be silent. */
export function removePhoto(name) {
  if (!name || !/^[\w.-]+$/.test(name) || name.includes('..')) return false;
  try { rmSync(join(DIR, name), { force: true }); return true; }
  catch (error) { console.error(`Could not remove photo ${name}: ${error.message}`); return false; }
}
