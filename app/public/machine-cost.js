// Older servers may include labour in their costs. Trust only an explicit
// parts-only basis, and never turn missing or incompatible data into zero.
export function numericCost(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
export function needsMachineCosts(rows) {
  return rows.some((machine) => machine.cost_basis !== 'parts' || numericCost(machine.total_service_cost) === null);
}
export function fillMissingMachineCosts(rows, jobs) {
  if (!Array.isArray(jobs)) throw new Error('Job costs are unavailable');
  const cents = new Map();
  for (const job of jobs) {
    const machineId = Number(job.equipment_id), cost = numericCost(job.cost);
    if (job.cost_basis !== 'parts' || !Number.isSafeInteger(machineId) || machineId <= 0 || cost === null)
      throw new Error('Parts-only job costs are unavailable');
    cents.set(machineId, (cents.get(machineId) || 0) + Math.round(cost * 100));
  }
  return rows.map((m) => m.cost_basis === 'parts' && numericCost(m.total_service_cost) !== null ? m
    : { ...m, cost_basis: 'parts', total_service_cost: (cents.get(Number(m.id)) || 0) / 100 });
}
export function clearUntrustedMachineCosts(rows) {
  return rows.map((m) => m.cost_basis === 'parts' && numericCost(m.total_service_cost) !== null ? m
    : { ...m, total_service_cost: null });
}
