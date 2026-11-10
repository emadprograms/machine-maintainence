# Phase 15 — Validation

Run through the suite against a real server on a throw-away database. The interesting
results are the ones that constrain what the code may do:

| Call | Result |
|---|---|
| `GET /api/work-orders?q=hose` | 1 row, the job whose title contains it |
| `?q=HYDRAULIC` | the same row — LIKE is case-insensitive for ASCII |
| `?q=Searchable` | 2 rows — both jobs on "Searchable Press", matched through the machine |
| `?q=%` | **0 rows** — the wildcard is escaped, so it searched for a literal percent |
| `?q=hose&status=done` | 0 rows — the hose job is still open, so the two filters composed |
| `GET /api/equipment?q=SRCH-77` | 1 row, found by asset tag |
| `GET /api/equipment?q=Bay 9` | 1 row, found by location |
| `GET /api/history?status=done&q=flywheel` | 1 row |
| `…&from=2020-01-01&to=2020-12-31` | 0 rows — search and range narrow together |
| `GET /api/export/work-orders.csv?q=hose` | 2 lines: the header and the one matching job |

## The check that matters

`the work-order export applies the same search as the screen` compares a file against a
list rather than against a hard-coded expectation, and asserts the *absence* of the
non-matching title. A test that only asserted "the CSV contains the right row" would
pass while the file also contained everything else — which is precisely the
"file does not match the screen" bug this app has been careful about since v1.1.

## Browser

None available. The search boxes' wiring is covered by the static checks (every handler
exists, every looked-up id exists) and the debounce is a five-line helper.
