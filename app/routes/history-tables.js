import { route, send, sendCsv } from '../http.js';
import { historyTable } from '../history-tables.js';
import { partsHistory } from '../parts-history.js';

const columns = [
  { key: 'kind', label: 'Type' }, { key: 'equipment_name', label: 'Machine' },
  { key: 'category', label: 'Category' }, { key: 'code', label: 'Work order' },
  { key: 'title', label: 'Job / maintenance' }, { key: 'status', label: 'Status' },
  { key: 'owner', label: 'Assigned / recorded by' }, { key: 'opened_day', label: 'Reported' }, { key: 'start_day', label: 'Job start' },
  { key: 'end_day', label: 'Job close / completion' }, { key: 'resolution', label: 'What was done' },
  { key: 'hours', label: 'Service hours' }, { key: 'cost', label: 'Parts-only cost' },
  { key: 'source', label: 'Record source' },
];
const partColumns = [
  {key:'event_day',label:'Usage date'}, {key:'part_name',label:'Part'}, {key:'reference',label:'Reference'},
  {key:'equipment_name',label:'Machine'}, {key:'category',label:'Category'}, {key:'code',label:'Work order'},
  {key:'title',label:'Job'}, {key:'stage',label:'Stage'}, {key:'qty',label:'Quantity'},
  {key:'unit_price',label:'Actual unit cost'}, {key:'cost',label:'Parts cost'}, {key:'source',label:'Record source'},
];
const maintenanceColumns = [
  {key:'equipment_name',label:'Machine'}, {key:'category',label:'Category'}, {key:'title',label:'Task'},
  {key:'end_day',label:'Completed'}, {key:'owner',label:'Recorded by'}, {key:'source',label:'Record source'},
];
const history = query => query.view === 'parts' ? partsHistory(query) : historyTable(query);
export default {
  'GET /api/history-table': route(async (req, res) => {
    const result = history(req.query);
    if (result.error) return send(res, 400, { error: result.error });
    send(res, 200, result);
  }),
  'GET /api/export/history-table.csv': route(async (req, res) => {
    const result = history(req.query);
    if (result.error) return send(res, 400, { error: result.error });
    const selectedColumns = result.view === 'parts' ? partColumns : result.view === 'maintenance' ? maintenanceColumns : columns;
    const rows = result.view === 'parts' || result.view === 'maintenance' ? result.rows.map(row => ({ ...row, source: row.source === 'legacy' ? 'Last known' : row.source === 'undated' ? 'Undated job usage' : row.source === 'stage' ? 'Stage usage' : 'Recorded' })) : result.rows;
    sendCsv(res, `${result.view}-history.csv`, rows, selectedColumns);
  }),
};
