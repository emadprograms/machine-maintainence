import { route, send } from '../http.js';
import { stageUpload, discardUpload } from '../uploads.js';
export default {
  'POST /api/uploads': route(async (req, res) => {
    const kind = req.query.kind;
    if (!['media', 'report'].includes(kind)) return send(res, 400, { error: 'Choose media or report' });
    send(res, 201, await stageUpload(req, kind));
  }, { raw: true }),
  'DELETE /api/uploads/:id': route(async (req, res) => {
    discardUpload(req.params.id, Number(req.user.sub)); send(res, 200, { ok: true });
  }),
};
