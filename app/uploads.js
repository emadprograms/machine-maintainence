// Temporary uploads are owned by the authenticated user until a stage commits.
import { randomUUID } from 'node:crypto';
import { all, get, run } from './db.js';
import { removePhoto } from './photos.js';
import { saveStream, safeOriginalName } from './media.js';

export function cleanExpiredUploads() {
  for (const row of all("SELECT id, filename FROM pending_uploads WHERE created_at < datetime('now', '-1 day')")) {
    if (removePhoto(row.filename)) run('DELETE FROM pending_uploads WHERE id = ?', row.id);
  }
}
export async function stageUpload(req, kind) {
  cleanExpiredUploads();
  const saved = await saveStream(req, kind), token = randomUUID();
  const name = safeOriginalName(req.headers['x-upload-name'], `attachment.${saved.name.split('.').pop()}`);
  try { run('INSERT INTO pending_uploads (id,user_id,filename,kind,original_name) VALUES (?,?,?,?,?)', token, Number(req.user.sub), saved.name, kind, name); }
  catch (error) { removePhoto(saved.name); throw error; }
  return { id: token, name, type: saved.type };
}
export function ownedUploads(ids, userId, kind) {
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length) throw new Error('Invalid attachments');
  return ids.map((token) => {
    if (typeof token !== 'string' || !/^[\da-f-]{36}$/i.test(token)) throw new Error('Invalid attachment');
    const row = get("SELECT * FROM pending_uploads WHERE id = ? AND user_id = ? AND kind = ? AND created_at >= datetime('now', '-1 day')", token, userId, kind);
    if (!row) throw new Error('Attachment expired or belongs to another user');
    return row;
  });
}
export function consumeUploads(rows) { for (const row of rows) run('DELETE FROM pending_uploads WHERE id = ?', row.id); }
export function discardUpload(token, userId) {
  const row = get('SELECT * FROM pending_uploads WHERE id = ? AND user_id = ?', token, userId);
  if (row && removePhoto(row.filename)) run('DELETE FROM pending_uploads WHERE id = ?', token);
}
