// One total everywhere: a reviewed final total plus stages recorded since that
// review. Until there is a review, sum the stage durations. A legacy manually
// recorded total is kept as the baseline, not added to the old stages twice.
export function effectiveHours(w = 'w') {
  const stages = `(SELECT SUM(s.hours) FROM work_order_updates s WHERE s.work_order_id = ${w}.id)`;
  return `MAX(0, ROUND((CASE WHEN ${w}.labour_hours IS NULL THEN ${stages}
    ELSE ${w}.labour_hours + COALESCE(${stages}, 0) - COALESCE(${w}.labour_stage_baseline, 0) END), 6))`;
}
