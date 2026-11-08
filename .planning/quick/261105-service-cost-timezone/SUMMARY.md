# Quick summary: service cost and workshop time zone

## Delivered
- Added a numerically sortable Total service cost column beside total service hours. The total includes all jobs, open and closed: each job's effective labour at the current hourly rate plus its recorded part costs, without double-counting reviewed/staged hours. Empty machines show 0.00. The current-rate assumption is explained on the Machines page.
- Added top-bar Settings. An administrator can save an IANA workshop time zone; technicians can view it. UTC remains the default for existing databases. Server validation, partial settings updates and persistence are covered; rate and time zone changes do not reset one another.
- Stored instants remain UTC; timelines, work-order activity, history, printable jobs and CSV timestamps use the selected zone. History date filters, monthly reports/trends and preventive-maintenance today/due calculations use its DST-aware calendar. Calendar-only maintenance dates are not converted as instants. Other sessions pick up changes on subsequent requests/navigation; browser time-zone incompatibility is reported rather than silently displayed as UTC.
- Updated app documentation and added an isolated automated zone/cost regression, also run by the main smoke suite.

## Verification
- Smoke suite: 686 passed, 0 failed; offline audit: OFFLINE-SAFE.
- Standalone tests: timezone/cost integration including UTC/month and DST boundaries, multi-job and edited-stage costs, permissions, invalid/atomic and partial updates, exports/print/history/report/PM agreement and restart; work-order, stage gallery, print and sidebar UI suites.
- Real Chromium desktop/mobile: numeric cost sorting; valid/invalid settings and technician read-only permissions; settings persistence on reload and server restart; other-session change; timezone-adjusted activity, timeline, history and print. Prior machine-history/roles/actions/mobile browser regression passed.
- Preview restarted on port 3000 using the existing preview database.
