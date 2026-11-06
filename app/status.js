// What state a machine is in — computed from its work orders, never typed in.
//
// Until 261106-eqs `equipment.status` was a field on an edit form, which meant two
// ways to be wrong at once: a machine whose job says "being replaced" could still
// read *down* weeks later because nobody went back, and a machine with a live
// high-priority fault read *running* because whoever reported it did not think to
// edit a second screen. The screen a fitter looks at was wrong in both directions.
//
// So the rule lives here, in one place, and every screen asks it:
//
//   retired  an admin withdrew the machine from service. Not a repair, so it stays
//            a manual decision, and it outranks everything — a retired machine is
//            not "down", it has left the workshop.
//   down     otherwise, if any work order is unfinished and is high priority or
//            already in progress. A high-priority open fault means it cannot be
//            trusted to run; an in-progress job means somebody is working on it
//            right now.
//   active   otherwise.
//
// The stored column now records only the first of those. `down` is never written.

import { all } from './db.js';

/** The states an administrator may set. Everything else is a consequence. */
export const SERVICE_STATES = ['active', 'retired'];

/**
 * What "in service" means to a query. One definition, because three screens now
 * ask it — the machine list, the maintenance list and the dashboard's due-soon
 * card — and a retired machine must not appear on any of them.
 */
export const IN_SERVICE_SQL = "e.status <> 'retired'";
export const RETIRED_SQL = "e.status = 'retired'";

/** Every unfinished job, worst first, so the reason shown is the most serious one. */
function openJobsByMachine() {
  const jobs = all(`
    SELECT w.id, w.equipment_id, w.title, w.priority, w.status
    FROM work_orders w
    WHERE w.status <> 'done'
    ORDER BY CASE w.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, w.id`);
  const byMachine = new Map();
  for (const job of jobs) {
    const key = Number(job.equipment_id);
    if (!byMachine.has(key)) byMachine.set(key, []);
    byMachine.get(key).push(job);
  }
  return byMachine;
}

/** The job that decides the machine's state, or null if none does. */
const decidingJob = (jobs) =>
  jobs.find((j) => j.priority === 'high' || j.status === 'in_progress') ?? null;

/**
 * Attach `status`, `status_reason`, `service_status` and `open_jobs` to each
 * machine. `service_status` is what the column says (active/retired); `status` is
 * what the workshop should be shown.
 */
export function withStatus(machines) {
  const jobs = openJobsByMachine();
  return machines.map((machine) => {
    const mine = jobs.get(Number(machine.id)) ?? [];
    const service = machine.status === 'retired' ? 'retired' : 'active';
    const culprit = decidingJob(mine);
    if (service === 'retired') {
      return { ...machine, status: 'retired', service_status: 'retired',
        status_reason: 'Withdrawn from service', open_jobs: mine.length };
    }
    return {
      ...machine,
      status: culprit ? 'down' : 'active',
      service_status: service,
      status_reason: culprit
        ? `${culprit.title} (${culprit.priority}, ${String(culprit.status).replace('_', ' ')})`
        : null,
      open_jobs: mine.length,
    };
  });
}

/** The machines the dashboard card should count — the same rule, not a second one. */
export function downMachines() {
  return withStatus(all('SELECT * FROM equipment ORDER BY name'))
    .filter((m) => m.status === 'down');
}
