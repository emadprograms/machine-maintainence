// Stream uploads and downloads without buffering large photos or videos in RAM.
// Files have server-generated names and stay beside the existing photo files.
import { createWriteStream, createReadStream, openSync, readSync, closeSync, renameSync, statSync, rmSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DATA_DIR } from './db.js';
import { sniff } from './photos.js';

const dir = join(DATA_DIR, 'photos');
const TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4',
  mov: 'video/quicktime', webm: 'video/webm', pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword' };
export function mediaType(name) { return TYPES[String(name || '').split('.').pop().toLowerCase()] || 'application/octet-stream'; }
export function isVideo(name) { return mediaType(name).startsWith('video/'); }
function kindOf(bytes, kind) {
  if (kind === 'media') {
    const image = sniff(bytes); if (image) return image;
    if (bytes.length >= 12 && bytes.toString('ascii', 4, 8) === 'ftyp') {
      const mov = bytes.toString('ascii', 8, 12) === 'qt  ';
      return { ext: mov ? 'mov' : 'mp4', type: mov ? TYPES.mov : TYPES.mp4 };
    }
    if (bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return { ext: 'webm', type: TYPES.webm };
    return null;
  }
  if (kind === 'report') {
    if (bytes.subarray(0, 5).toString('ascii') === '%PDF-') return { ext: 'pdf', type: TYPES.pdf };
    if (bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) return { ext: 'docx', type: TYPES.docx };
    if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex'))) return { ext: 'doc', type: TYPES.doc };
  }
  return null;
}
export function safeOriginalName(value, fallback) {
  let name; try { name = decodeURIComponent(String(value || '')); } catch { name = ''; }
  name = name.replace(/[\\/]/g, '_').replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 180);
  return name || fallback;
}
export async function saveStream(req, kind = 'media') {
  const temp = join(dir, `.upload-${randomUUID()}`); let final;
  try {
    await pipeline(req, createWriteStream(temp, { flags: 'wx', mode: 0o600 }));
    const fd = openSync(temp, 'r'), header = Buffer.alloc(32); let n;
    try { n = readSync(fd, header, 0, header.length, 0); } finally { closeSync(fd); }
    const type = kindOf(header.subarray(0, n), kind);
    if (!type) throw new Error(kind === 'report' ? 'Choose a PDF, DOC or DOCX report' : 'Choose a JPEG, PNG, WebP, MP4, MOV or WebM file');
    const name = `${Date.now()}-${randomUUID()}.${type.ext}`;
    final = join(dir, name); renameSync(temp, final);
    return { name, type: type.type };
  } catch (error) { rmSync(temp, { force: true }); if (final) rmSync(final, { force: true }); throw error; }
}
export function sendFile(req, res, name, { downloadName } = {}) {
  if (!name || !/^[\w.-]+$/.test(name) || name.includes('..')) return false;
  const path = join(dir, name); let size;
  try { size = statSync(path).size; } catch { return false; }
  const headers = { 'content-type': mediaType(name), 'x-content-type-options': 'nosniff',
    'cache-control': 'private, max-age=60', 'accept-ranges': 'bytes' };
  if (downloadName) headers['content-disposition'] = `attachment; filename="report.${name.split('.').pop()}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`;
  let start = 0, end = size - 1, status = 200;
  if (req.headers.range && size) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (!match || (!match[1] && !match[2])) { res.writeHead(416, { 'content-range': `bytes */${size}` }); res.end(); return true; }
    if (!match[1]) { const suffix = Number(match[2]); start = Math.max(0, size - suffix); }
    else { start = Number(match[1]); if (match[2]) end = Math.min(Number(match[2]), end); }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) {
      res.writeHead(416, { 'content-range': `bytes */${size}` }); res.end(); return true;
    }
    status = 206; headers['content-range'] = `bytes ${start}-${end}/${size}`;
  }
  headers['content-length'] = size ? end - start + 1 : 0;
  res.writeHead(status, headers);
  if (!size) res.end(); else { const stream = createReadStream(path, { start, end }); stream.on('error', () => res.destroy()); stream.pipe(res); }
  return true;
}
