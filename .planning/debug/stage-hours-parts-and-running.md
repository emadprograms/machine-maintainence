# Debug: live hours, staged parts and machine-running state

Date: 2026-11-05. Status: fixed.

## Request and decisions

Stage descriptions and durations remain required; spare parts are optional. Hours
must update on the work order and as an all-jobs machine total. A stage may include
one or more inventory parts with quantity and an editable actual unit cost, initially
suggested from the catalog; saving consumes the stock. “Is the machine running now?”
is optional and an unanswered question must leave the current setting unchanged.

## Cause and fix

The prior stage feature wrote durations only to `work_order_updates`; the work list
and reports read the separate final `labour_hours`, so live hours and labour cost did
not move. Parts could only be added in the close dialog, and the cost query used the
current catalog price. The stage dialog had no way to revise its stopping flag.

`hours.js` provides a single effective-hours expression for jobs, machines and the
closed-job monthly report. Before review it sums stages; once a final total is recorded,
only stages added since that baseline are added. Reopening and re-closing preserve
reviewed totals without double-counting. The close dialog refreshes stage history and
lets the user review the total. The machine table has a sortable all-job Total hours.

A stage transaction writes the update, optional photos, actual priced part usage,
stock decrements, assignee and any explicit running answer together. It rolls back on
invalid inputs or insufficient stock. Parts and actual prices are visible in stage
history and feed job and closed-report cost; catalog edits do not rewrite them. The
machine answer changes only this ticket's `stops_machine` flag: another stopping job
or retired service state still takes precedence. An unavailable parts lookup can be
retried, but never blocks saving an update without parts.

Startup migrations capture historical part costs at the then-current catalog price
(zero for no recorded price) and treat existing recorded final hours as authoritative,
with the already-existing stages as their baseline. The migrations are atomic and
idempotent; they do not try to guess historic actual prices.

## Verification

- 606 smoke checks, including a real technician saving multiple priced parts,
  stock decrement and rollback, invalid input, another stopping job, actual-cost
  snapshots, closure, reopening, reports and cascading deletion.
- Dedicated migration test upgrades a simulated prior database, verifies old totals
  and costs are preserved, and confirms subsequent restart doesn't re-baseline.
- DOM interaction tests cover optional part loading and retry, price edits, multiple
  parts, machine answers, failed lookup without parts, and refreshed close totals.
- Chromium covered two stages, actual part prices, live work-order and machine hours,
  running status, manual final-hour review, reopen and a further stage, plus a narrow
  mobile layout. Previous stage/photo and assignee flows also passed.
- Mutations to the stage-hour expression, actual-cost recording, stock deduction,
  machine answer, client part submission and closing baseline were detected.
