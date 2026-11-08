// Older running servers can return machine hours without the newer machine cost.
// Never turn missing data into a real zero; reconstruct it from the same unfiltered
// job costs, or leave it unavailable if those data are incomplete.
export function numericCost(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
export function needsMachineCosts(rows) {
  return rows.some((machine) => numericCost(machine.total_service_cost) === null);
}
export function fillMissingMachineCosts(rows, jobs) {
  if (!Array.isArray(jobs)) throw new Error('Job costs are unavailable');
  const cents = new Map();
  for (const job of jobs) {
    const machineId = Number(job.equipment_id), cost = numericCost(job.cost);
    if (!Number.isSafeInteger(machineId) || machineId <= 0 || cost === null) throw new Error('Job costs are incomplete');
    cents.set(machineId, (cents.get(machineId) || 0) + Math.round(cost * 100));
  }
  return rows.map((m) => numericCost(m.total_service_cost) !== null ? m
    : { ...m, total_service_cost: (cents.get(Number(m.id)) || 0) / 100 });
}
