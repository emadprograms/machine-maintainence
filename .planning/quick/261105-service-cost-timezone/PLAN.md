# Quick: machine service cost and workshop time zone

- Show sortable total service cost per machine across all jobs, using recorded parts plus effective labour at the current hourly rate, consistent with work-order costs. Clarify the rate assumption; keep stock and hour calculations unchanged.
- Add top-bar Settings for administrators to save a workshop-wide IANA time zone, with UTC as the backward-compatible default. Validate server-side and preserve the existing hourly-rate settings API.
- Keep stored instants in UTC; display them in the configured zone in lists, history, timelines, print and CSV. Apply the same local calendar to history filters, monthly reports/trends and maintenance today/due calculations, including daylight-saving transitions. Date-only maintenance fields remain calendar dates.
- Test persistence/restart, permissions, invalid zones, zone boundary and daylight saving, report/history/export agreement, machine cost updates and sorting, existing regression/offline and real desktop/mobile flows. Commit and push.
