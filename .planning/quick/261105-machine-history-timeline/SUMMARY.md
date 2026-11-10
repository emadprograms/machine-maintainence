# Machine history and work-order activity — completed

- Added icons to edit, history, retire/restore and delete machine menu actions; admin permissions and red deletion are unchanged.
- Machine history includes a sortable work-order number. Clicking any job row or keyboard-activating its numbered link opens that job's fresh timeline, including report and photos, stages and closure. It is independent of work-order filters; fetch errors remain in the history dialog and can be retried.
- Work-order Last activity (UTC) displays the latest surviving report, stage creation/correction or closure and sorts by the full timestamp. An unstaged job uses report time; no data migration is needed.
- Shared timeline and photo dialogs were moved outside the hidden Work orders section so they are visible from Machines.
- Verification: 685 smoke checks, OFFLINE-SAFE, standalone UI tests, and desktop/mobile Chromium covering both sort directions, open and closed jobs, filtered navigation, admin/technician permissions, timeline photos, failed fetches, and menu placement.
