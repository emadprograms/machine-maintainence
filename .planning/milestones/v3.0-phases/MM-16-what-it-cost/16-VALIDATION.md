# Phase 16 — Validation

Run end to end against a real server on a throw-away database.

| Call | Result |
|---|---|
| `PATCH /api/work-orders/5 {"labour_hours": -2}` | `400 {"error":"Hours cannot be negative"}` |
| `PATCH … {"labour_hours": "ages"}` | `400 {"error":"Hours must be a number"}` |
| `PATCH … {"labour_hours": 2.5}` | `200`, `labour_hours: 2.5` |
| `PUT /api/settings {"hourly_rate": 40}` as a technician | `403 {"error":"Admins only"}` |
| `PUT /api/settings {"hourly_rate": -5}` | `400 {"error":"Hourly rate cannot be negative"}` |
| `GET /api/settings` | `{"hourly_rate":40}` |
| `GET /api/work-orders` | the closed job carries `cost: 125` — 2.5 h × 40 plus 2 × 12.50 |
| `GET /api/report?month=2026-11` | jobs, hours, parts 25, labour, total, and `Costed pump` among the machines |
| `GET /api/report?month=November` | `400 {"error":"Month must be written as YYYY-MM"}` |
| `GET /api/report?month=1990-01` | `200` with zeroes — an empty month is not an error |
| `GET /api/export/report.csv?month=2026-11` | one row per machine and an `All machines` total matching the API |

## Arithmetic checked, not assumed

The assertion for COST-02 uses an exact expected value (125) built from round numbers, so
any drift in the three inputs — hours, rate, parts quantity or price — changes it. During
an early draft the assertion was "cost is above zero", which would have passed with the
rate ignored entirely; the mutation confirms it now does not.

## Environment

Linux, Node 22.22.3, suite under `PATH=/nonexistent`. The Windows check of the earlier
persistence fix remains outstanding and is tracked in `.planning/STATE.md` as a pending
item — nothing in this phase depends on it, but the two have never been verified on the
same machine.
