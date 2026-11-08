// Latest explicit machine-state report wins, independently of work-order closure.
// Retirement is a separate administrative decision and always takes precedence.
// Legacy machines receive a baseline during migration so their state is preserved.

import { all, run } from './db.js';

// SQL expression for the same operating state, used by work-order lists.
export const machineRunningSql = (equipmentId) => `COALESCE((SELECT running FROM machine_state_events
  WHERE equipment_id = ${equipmentId} AND running IS NOT NULL ORDER BY id DESC LIMIT 1),
  CASE WHEN EXISTS (SELECT 1 FROM work_orders sw WHERE sw.equipment_id = ${equipmentId}
    AND sw.status <> 'done' AND sw.stops_machine = 1) THEN 0 ELSE 1 END)`;

export function recordMachineState(equipmentId, jobId, updateId, running, source) {
  run('INSERT INTO machine_state_events (equipment_id, work_order_id, update_id, running, source) VALUES (?,?,?,?,?)',
    equipmentId, jobId, updateId, running === null ? null : (running ? 1 : 0), source);
}

/** The states an administrator may set. Everything else is a consequence. */
export const SERVICE_STATES = ['active', 'retired'];

/**
 * What "in service" means to a query. One definition, because three screens now
 * ask it — the machine list, the maintenance list and the dashboard's due-soon
 * card — and a retired machine must not appear on any of them.
 */
export const IN_SERVICE_SQL = "e.status <> 'retired'";
export const RETIRED_SQL = "e.status = 'retired'";

/** Legacy fallback and count of unfinished jobs last noted as stopping a machine. */
function openJobsByMachine() {
  const jobs = all(`
    SELECT w.id, w.code, w.equipment_id, w.title, w.priority, w.status
    FROM work_orders w
    WHERE w.status <> 'done' AND w.stops_machine = 1
    ORDER BY w.id`);
  const byMachine = new Map();
  for (const job of jobs) {
    const key = Number(job.equipment_id);
    if (!byMachine.has(key)) byMachine.set(key, []);
    byMachine.get(key).push(job);
  }
  return byMachine;
}

/** A useful legacy reason when no explicit state event exists. */
const decidingJob = (jobs) => jobs[0] ?? null;

/**
 * Attach `status`, `status_reason`, `service_status` and `open_jobs` to each
 * machine. `service_status` is what the column says (active/retired); `status` is
 * what the workshop should be shown.
 */
export function withStatus(machines) {
  const jobs = openJobsByMachine();
  const events = new Map(all(`SELECT s.*, w.code, w.title FROM machine_state_events s
    LEFT JOIN work_orders w ON w.id = s.work_order_id
    WHERE s.running IS NOT NULL AND s.id = (SELECT MAX(n.id) FROM machine_state_events n WHERE n.equipment_id = s.equipment_id AND n.running IS NOT NULL)`)
    .map((s) => [Number(s.equipment_id), s]));
  return machines.map((machine) => {
    const mine = jobs.get(Number(machine.id)) ?? [];
    const service = machine.status === 'retired' ? 'retired' : 'active';
    const culprit = decidingJob(mine);
    const latest = events.get(Number(machine.id));
    const running = latest ? Boolean(latest.running) : !culprit;
    if (service === 'retired') {
      return { ...machine, status: 'retired', service_status: 'retired',
        status_reason: 'Withdrawn from service', open_jobs: mine.length };
    }
    return {
      ...machine,
      status: running ? 'active' : 'down',
      service_status: service,
      status_reason: running ? null : latest?.title
        ? `${latest.code ? `${latest.code} ` : ''}${latest.title}`
        : culprit ? `${culprit.code ? `${culprit.code} ` : ''}${culprit.title}` : 'Last reported out of service',
      open_jobs: mine.length,
    };
  });
}

/** The machines the dashboard card should count — the same rule, not a second one. */
export function downMachines() {
  return withStatus(all('SELECT * FROM equipment ORDER BY name'))
    .filter((m) => m.status === 'down');
}
