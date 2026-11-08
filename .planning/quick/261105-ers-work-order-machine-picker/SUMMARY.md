# Work-order machine picker

Date: 2026-11-05

The creation form waited for both machines and assignable people before enabling
machines. The independent people request could therefore block the machine picker.
Machines now load independently, and the picker is enabled as soon as they arrive.
A failed lookup or empty in-service list is explained with an in-place Retry button.
The machine screen no longer overwrites this picker, and older form responses cannot
replace newer choices. Retired machines remain excluded as before.

Verification: work UI interaction tests exercise delayed people, two selectable
machines, no machines, retry, and stale responses; 558 smoke checks pass. Three
mutations (disabled picker, missing retry, stale responses) were caught. An isolated,
real Chromium run signed in, created a work order for the second machine while the
people request was held open, then exercised a failed machine lookup/retry and an
empty machine list. The offline audit was run separately from the smoke test.
