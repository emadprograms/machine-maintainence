import { send, route, id, sendCsv } from '../http.js';
import { machineReport, inventoryReport } from '../report-types.js';
export default {
  'GET /api/reports/machine/:id': route(async (req, res) => {
    const report = machineReport(id(req.params.id), req.query.q);
    if (!report) return send(res, 404, { error: 'Machine not found' });
    send(res, 200, report);
  }),
  'GET /api/reports/parts': route(async (req, res) => send(res, 200, inventoryReport(req.query.q))),
  'GET /api/export/machine-report.csv': route(async (req, res) => {
    const report = machineReport(id(req.query.id), req.query.q);
    if (!report) return send(res, 404, { error: 'Machine not found' });
    const rows = report.jobs.map((j) => ({ machine: report.machine.name, ...j }));
    rows.push({ machine: 'Total', title: `${report.total_jobs} work orders`, hours: report.total_hours, cost: report.total_cost });
    sendCsv(res, `machine-report-${report.machine.id}.csv`, rows, [
      { key:'machine',label:'Machine' }, {key:'code',label:'Work order'}, {key:'title',label:'Problem'},
      {key:'status',label:'Status'}, {key:'created_at',label:'Reported (UTC)'}, {key:'closed_at',label:'Closed (UTC)'},
      {key:'hours',label:'Service hours'}, {key:'cost',label:'Parts-only service cost'}]);
  }),
  'GET /api/export/inventory-report.csv': route(async (req, res) => {
    const report = inventoryReport(req.query.q);
    const rows = report.parts.map((p) => ({ ...p, stock_value: p.unit_price == null ? null : Math.round(p.qty * p.unit_price * 100) / 100 }));
    sendCsv(res, 'inventory-report.csv', rows, [{key:'name',label:'Part'}, {key:'reference',label:'Reference'},
      {key:'supplier',label:'Supplier'}, {key:'qty',label:'Stock'}, {key:'reorder_level',label:'Reorder at'},
      {key:'unit_price',label:'Unit price'}, {key:'stock_value',label:'Stock value (blank if unknown)'}]);
  }),
};
