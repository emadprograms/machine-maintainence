# Phase 16 — Security

ASVS level 1, block on `high`.

| Check | Result |
|---|---|
| Authorisation | `PUT /api/settings` is admin-only (403 for a technician, asserted). `GET /api/report` and both exports are authenticated and readable by every role, like the lists they mirror |
| Injection | Every value is a bound parameter. The only interpolation is the shared `IN_MONTH` fragment and fixed column lists in `sendCsv` |
| Input validation | `labour_hours` must be finite, ≥ 0 and ≤ 10000; `hourly_rate` must be finite and ≥ 0; `month` must match `YYYY-MM` with a month 1–12. Each answers with a sentence |
| XSS | `report.js` renders machines through `strong()`; the error state goes through `esc()` |
| Data egress | `report.csv` reveals costs and job counts. Same audience as the Report screen itself; it adds no data the screen does not already show |
| Numeric safety | `round2()` prevents floating-point noise reaching a file; `Number.isFinite` gates every input so `NaN` cannot be stored in the rate |

## Note

`hourly_rate` is stored as text in the settings table and converted on read. `Number()`
of a stored non-number yields `NaN`, and `hourlyRate()` falls back to `0` rather than
propagating `NaN` into every cost in the database. That fallback is the difference
between a wrong number and a broken screen.
