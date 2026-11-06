# Phase 14 — Validation

Ran end to end against the real server on a throw-away database, not only through the
suite.

| Call | Result |
|---|---|
| `GET /api/history?equipment_id=1` | 2 rows, the open job included, newest first |
| `GET /api/history?status=done` | only the closed job |
| `?from=2020-01-01&to=2020-12-31` | `total 0` — the range excludes it |
| `?from=not-a-date` | `400 {"error":"From must be a date written as YYYY-MM-DD"}` |
| `?from=2026-02-30` | `400 {"error":"From is not a real calendar date"}` |
| `?from=2026-12-01&to=2026-01-01` | `400 {"error":"The start of the range is after its end"}` |
| `?equipment_id=999999` | `200 {"rows":[],"total":0,"shown":0}` |

## A mistake worth recording

The first validation attempt closed a work order with `PUT` and silently changed
nothing — the route is `PATCH`. The 404 was sent to `/dev/null` by the probe, so the
only symptom was a "done" query returning zero rows. Had the assertion been written
from that probe rather than from reading the response, it would have been written
against a misunderstanding. The suite's version of the test checks the PATCH response
implicitly by asserting the closed job appears.

## Browser

Not available in this environment. The screen was checked only through the static
assertions (handlers exist, ids exist, three empty states present) and through the
endpoint responses above.
