// Part attachments are private authenticated media or downloaded documents.
import { send, route, id } from '../http.js';
import { all, get } from '../db.js';
import { isVideo, sendFile } from '../media.js';
export default {
  'GET /api/parts/:id/attachments': route(async (req, res) => {
    const part = id(req.params.id);
    if (!get('SELECT id FROM parts WHERE id = ?', part)) return send(res, 404, { error: 'Part not found' });
    const rows = all('SELECT id, filename, kind, original_name FROM part_attachments WHERE part_id = ? ORDER BY id', part);
    send(res, 200, rows.map((r) => ({ id: r.id, kind: r.kind, name: r.original_name, video: isVideo(r.filename) })));
  }),
  'GET /api/parts/:id/attachments/:attachmentId': route(async (req, res) => {
    const row = get('SELECT * FROM part_attachments WHERE part_id = ? AND id = ?', id(req.params.id), id(req.params.attachmentId));
    if (!row || !sendFile(req, res, row.filename, row.kind === 'report' ? { downloadName: row.original_name } : {}))
      return send(res, 404, { error: 'Attachment not found' });
  }),
};
