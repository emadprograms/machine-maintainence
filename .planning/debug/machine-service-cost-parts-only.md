# Debug: service cost must be parts only

Date: 2026-11-05. Status: fixed.

## Corrected requirement
Service hours remain separate. Work-order cost is the sum of recorded parts costs only. A machine's total service cost is the sum of those work-order costs across every job, including open and closed; there is no hourly rate and no labour cost. The time-zone setting remains intact.

## Root cause
The previous implementation incorrectly interpreted the original request as parts plus service hours multiplied by a configurable rate. That assumption affected work-order and machine totals, monthly reports, charts, print, settings, exports and tests. The formula was implemented consistently, but was the wrong business rule.

## Fix
- A shared SQL expression defines each work-order cost as its recorded parts total, rounded to cents. Machine and monthly totals sum those same job costs, avoiding double counting and matching the amounts shown on the work-order table. All job statuses count toward each machine; the monthly report still includes only jobs closed in that month. Service hours, stock transactions, stored parts prices and historical reviewed hours are unchanged.
- Removed hourly-rate and labour-cost controls, calculations and labels from Settings, work orders, reports, dashboard, CSV and print. Settings remains available for the saved workshop time zone. Existing legacy hourly-rate rows are retained untouched in SQLite but are never read into a cost; the settings API no longer exposes or accepts an hourly-rate setting.
- Added an explicit parts-only cost-basis marker to machine, job, report, trend and print responses. Updated browser views reject missing/old markers instead of displaying labour-inclusive totals from an older running backend. When a machine total is missing but the job endpoint explicitly supplies parts-only costs, the fallback still sums the job totals. If the cost basis cannot be verified, the user sees an unavailable/restart message instead of an incorrect cost. Report CSV download and print are blocked when the backend is incompatible.

## Verification
- Integration: four work orders on one machine, including open and closed jobs and hours-only work, sum their parts-only job costs. A pre-existing rate of 999 has no effect and remains stored. Stage edits update totals and preserve stock reconciliation; closed-date/time-zone filtering and persistence continue to work. A fractional-price case confirms each job's displayed cost is rounded before machine, report and CSV totals are summed.
- Real Chromium desktop/mobile: four job costs 5.00 + 9.50 + 0.00 + 6.50 = machine total 21.00 with 10 service hours; report/graph/print show parts only, no rate controls; corrected and deleted stages update machine totals; time zone persists; technician permissions hold. Simulated old-server responses do not display or print labour-inclusive costs; verified job-cost fallback still works.
- Real Chromium machine-history, role, timeline, sorting and mobile regression passed. Unit/UI suites cover missing, invalid and legacy cost-basis data, report/dashboard safeguards and print compatibility.
- 687 smoke checks passed; offline audit reported OFFLINE-SAFE. No historical hours, parts, costs or settings rows were rewritten.
