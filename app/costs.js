// A job's service cost is only its recorded parts, rounded once per job.
// Machine and monthly totals add these same job amounts; hours remain separate.
export function workOrderCost(alias = 'w') {
  return `ROUND((SELECT COALESCE(SUM(cost_total), 0) FROM work_order_parts WHERE work_order_id = ${alias}.id), 2)`;
}
