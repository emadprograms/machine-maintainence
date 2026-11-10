import { route, send, sendCsv } from '../http.js';
import { historyTable } from '../history-tables.js';

const columns = [
  { key: 'kind', label: 'Type' }, { key: 'equipment_name', label: 'Machine' },
  { key: 'category', label: 'Category' }, { key: 'code', label: 'Work order' },
  { key: 'title', label: 'Job / maintenance' }, { key: 'status', label: 'Status' },
  { key: 'owner', label: 'Assigned / recorded by' }, { key: 'opened_day', label: 'Reported' }, { key: 'start_day', label: 'Job start' },
  { key: 'end_day', label: 'Job close / completion' }, { key: 'resolution', label: 'What was done' },
  { key: 'hours', label: 'Service hours' }, { key: 'cost', label: 'Parts-only cost' },
  { key: 'source', label: 'Record source' },
];
export default {
  'GET /api/history-table': route(async (req, res) => {
    const result = historyTable(req.query);
    if (result.error) return send(res, 400, { error: result.error });
    send(res, 200, result);
  }),
  'GET /api/export/history-table.csv': route(async (req, res) => {
    const result = historyTable(req.query);
    if (result.error) return send(res, 400, { error: result.error });
    sendCsv(res, `${result.view}-history.csv`, result.rows, columns);
  }),
};
