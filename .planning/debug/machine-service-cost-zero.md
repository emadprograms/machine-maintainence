# Debug: machine service cost shown as zero

Date: 2026-11-05. Status: fixed.

## Report
Total service hours are correct, but total service cost shows zero on every machine.

## Evidence
- The machine SQL sums each job's effective hours at the saved hourly rate plus recorded part costs. A read-only execution against the current preview database, where the rate is 40, gave 326.50, 589.00, 369.50 and 617.00 for four machines. An unconditional arithmetic error was not reproduced with those data.
- Reproduced the exact symptom in Chromium: with nonzero work-order costs and correct machine hours, an equipment response from an older server without `total_service_cost` caused every machine to show 0.00. The renderer used `Number(e.total_service_cost || 0)`, treating absent data as a recorded zero. A running older Node backend can coexist with newly served static files until the server restarts. This reproduces the symptom but does not prove which deployment condition the user encountered.
- A separate, legitimate cause of zero labour cost is an unset hourly rate: its backward-compatible default is 0.00, and the only editor was on Report. Tests previously set a nonzero rate before asserting costs, so they did not expose this user-facing ambiguity.

## Fix
- Never convert missing, null or invalid machine cost into zero. If the machine response lacks the new total, reconstruct it from all unfiltered work-order cost totals; retain known machine totals, sum all statuses once, preserve actual zeroes and sort numerically. If job data is unavailable or incomplete, show an em dash and a visible restart/retry explanation instead of inventing a value. Ignore stale responses when a newer Machines load wins.
- Expose the hourly labour rate in top-bar Settings, editable by admins and visible read-only to technicians. Saving recalculates machine totals immediately, keeps the Report input synchronized and persists the rate. A visible Machines notice explains when a 0.00 rate excludes labour; recorded parts are still counted. Zero is a valid choice and no rate is invented. Time-zone-only and rate-only saves remain independent, including when two administrators edit different fields concurrently.
- Reject empty, boolean, invalid or negative rate updates atomically; allow decimal and zero rates. Handle an older server's rate-save response that does not contain a time zone.

## Verification
- Reproduction before fix: correct 2 and 0.2 hours, but both machine costs rendered 0.00 despite job totals of 20.00 and 2.00. The same Chromium reproduction after the fix shows 20.00 and 2.00.
- Machine-cost unit tests cover missing, null, invalid and real-zero values; multiple job statuses, cent arithmetic, no jobs, existing totals, input immutability and incomplete-job failure. Integration tests cover the initial zero rate with recorded parts, subsequent nonzero rate, live and corrected stage costs, invalid/atomic settings updates, rate/time-zone independence and persistence.
- Chromium desktop/mobile covered a zero-rate explanation, rate entry and immediate recalculation, Report synchronization, version-skew fallback, failed fallback with unavailable markers, old rate-save responses, concurrent settings edits, reload persistence and technician permissions. Previous time-zone desktop/mobile regression also passed.
- 687 smoke checks passed; offline audit reported OFFLINE-SAFE; work-order, gallery, print and sidebar UI suites passed.
