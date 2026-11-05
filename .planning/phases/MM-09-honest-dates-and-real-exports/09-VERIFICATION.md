---
phase: MM-09-honest-dates-and-real-exports
verified: 2026-11-05T11:20:00Z
status: passed
score: 9/9 must-haves verified
covered_files:
  - .planning/phases/MM-09-honest-dates-and-real-exports/09-01-PLAN.md
  - .planning/phases/MM-09-honest-dates-and-real-exports/09-01-SUMMARY.md
  - .planning/phases/MM-09-honest-dates-and-real-exports/09-02-PLAN.md
  - .planning/phases/MM-09-honest-dates-and-real-exports/09-02-SUMMARY.md
  - starter/public/app.js
  - starter/public/index.html
  - starter/scripts/smoke-test.js
  - starter/server.js
covered_digest: "v4:sha256:11e9c6ac1e61dc601d7631b8d1b02bc98da5477ed454bdff276cc68770654225"
behavior_unverified: 0
---

# Phase 9: Honest dates and real exports Verification Report

**Phase Goal:** A date the user supplies is the date that gets stored, and the
workshop can take its work orders and parts out of the app as a file that opens
correctly in a spreadsheet.
**Verified:** 2026-11-05
**Status:** passed

*Auditors are not installed in this environment (`agents_installed: false`), so
the audit was run inline against live probes and the smoke suite, not delegated.*

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A completion date sent to the server is the date stored as `last_done` | ✓ VERIFIED | smoke "a completion date sent by the caller is the date stored" → `on: 2026-01-15`, `last_done: 2026-01-15`. This is the assertion that fails against the v1.0 code. |
| 2 | That date, not today, drives the next due date | ✓ VERIFIED | smoke "the completion date drives `next_due`, not today" → `2026-01-25` = sent date + 10-day interval |
| 3 | A malformed or impossible date is refused, naming the field | ✓ VERIFIED | 5 refusals: `2026-02-30`, `2026-13-01`, `15/01/2026`, `2026-1-5`, `tomorrow` — all 400 |
| 4 | A refused date changes nothing | ✓ VERIFIED | smoke "a refused date leaves `last_done` untouched" / "…`next_due` untouched", comparing against the pre-refusal values |
| 5 | A future completion date is refused | ✓ VERIFIED | smoke "a future completion date is refused with 400" + "…leaves `last_done` untouched" |
| 6 | Work orders and parts download as CSV with a header row | ✓ VERIFIED | live probe: `content-type: text/csv; charset=utf-8`, `content-disposition: attachment; filename="work-orders.csv"` |
| 7 | A field containing a comma, quote or newline does not shift columns | ✓ VERIFIED | smoke "a field containing a comma and a quote is quoted…" and "a quoted field is read back as one value by a real parser"; the parsed file has an equal column count on every row |
| 8 | The export honours the same filters as the on-screen list | ✓ VERIFIED | smoke "a filtered export contains only the filtered rows" (`?status=done`) and "the filter is applied to the list too, not just the file" |
| 9 | The file opens in Excel without an import step and without executing a cell | ✓ VERIFIED | BOM present (`charCodeAt(0) === 0xFEFF`, confirmed on the wire as bytes `357 273 277`), CRLF only, formula-leading cells prefixed with `'` |

### Plan must-haves

| Plan | Must-have | Status |
|------|-----------|--------|
| 9-01 | A supplied completion date is stored as `last_done` and drives `next_due` | ✓ |
| 9-01 | A malformed date returns 400 naming the field, never silently using today | ✓ |
| 9-01 | A future completion date is refused | ✓ |
| 9-01 | A date earlier than the schedule's `last_done` is refused | ✓ |
| 9-01 | `req.body` is actually populated, so the next handler does not repeat the bug | ✓ — `route()` assigns it for methods that carry a body; the whole suite depends on bodies after this change |
| 9-02 | CSV with a header row, opening in Excel | ✓ |
| 9-02 | A comma/quote/newline does not shift columns | ✓ |
| 9-02 | The export honours the on-screen filters | ✓ |
| 9-02 | UTF-8 BOM | ✓ |

### Required behaviour tested beyond the plans

| Check | Why it exists | Result |
|-------|---------------|--------|
| `created_at` and `closed_at` share one format | Found while probing: `closed_at` was a JS ISO string beside SQLite's stamp, so a CSV column interleaved | ✓ fixed, asserted |
| Filter applied on the list route as well as the export | Found while building the buttons: `?status=` was ignored by the list, so the screen and the file disagreed | ✓ fixed, asserted |
| Every button calls a function that exists | The class of bug a headless check found; now guarded statically | ✓ asserted |
| Every element looked up by id exists | Guards against a renamed control | ✓ asserted |
| Offline audit | Standing constraint | ✓ `OFFLINE-SAFE` |
| Migration on a pre-phase-9 database | `ensureColumn` is the only migration mechanism | ✓ additive, legacy row preserved |

## Test integrity

The suite grew **85 → 118 checks**, all passing under an empty `PATH` (proving
no shell-outs). Every assertion added in this phase was shown to fail with its
bug reintroduced:

| Bug reintroduced | Failing assertions |
|---|---|
| `base = today` (the v1.0 bug) | 2 |
| Lenient date parsing | 3 |
| Validation of future/past dates removed | 3 |
| CSV quoting removed | 4 |
| BOM removed | 3 |
| Formula prefix removed | 1 |
| `closed_at` restored to ISO | 1 |
| Export ignoring filters | route threw (caught by the server-start check) |
| A button wired to a missing function | 1 |
| A lookup of a missing id | 1 |
| Export buttons removed | 1 |

Two assertions in this phase were initially *wrong* and were fixed rather than
worked around:
- a naive `split(',')` agreed with a naive writer and reported a false failure —
  replaced with a real RFC 4180 parser;
- the phase-1 persistence checks hardcoded row counts of 1, so adding a work
  order in this phase broke them for the wrong reason — replaced with a snapshot
  taken immediately before the kill.

## UI verification

The page was driven end-to-end in a headless DOM (`jsdom`, installed outside the
repository so the zero-dependency rule holds) against a live server: **16/16
checks passed** — sign-in, work orders rendering, the status filter changing the
list, both export URLs following their own page's filter, the parts low-stock
filter narrowing the list, the PM date field defaulting to today, Mark done
storing the chosen day, the next due date following it, and a refused date
surfacing as a message while the schedule stayed unchanged.

Because that harness needs a dependency the project cannot carry, the subset
that catches the realistic failure — a control wired to nothing — is now a
permanent static check in the smoke suite.

## Deviations

1. **The fix moved to `route()`.** The plan targeted the PM handler; probing
   showed no handler could read a body at all. Fixing it at the call site would
   have left the next handler to rediscover it.
2. **Filter controls were added.** CSV-03 asks the export to preserve a filter
   that did not exist in the UI. Adding the export without them would have made
   the requirement untestable and unobservable.
3. **`closed_at` format changed.** Out of the plan's scope, but discovered by the
   plan's own deliverable (a mixed-format CSV column).

## Not verified

- Opening the exported file in real Excel. The bytes are asserted (BOM, CRLF,
  quoting, prefix) but no spreadsheet application exists in this environment.
- Concurrent exports while another user writes. Accepted as AR-9-01.
- The suite on Windows. Line endings in the shipped source are LF with `*.bat`
  pinned to CRLF by `.gitattributes`; the CSV's CRLF is built from `\r\n`
  escapes so a checkout cannot corrupt it.
