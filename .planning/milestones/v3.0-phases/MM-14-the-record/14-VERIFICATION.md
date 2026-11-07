# Phase 14 — Verification

**Suite:** 215 checks, 0 failures, run under `PATH=/nonexistent` so no Unix tool is
assumed.

## Requirements

| ID | Requirement | Where it is proven |
|---|---|---|
| HIST-01 | A machine shows its own history, open jobs included | `a machine lists every job against it, open ones included` — builds a machine with one open and one closed job, expects 2 rows, and checks the row carries the machine name and dates |
| HIST-02 | Completed jobs across all machines, newest first | `the History screen shows closed jobs only` — `?status=done` returns exactly the closed job |
| HIST-03 | A date range narrows the list; a bad date is a message | five assertions: range excluding → `total 0`; range including → `total 1`; `from=yesterday` → 400 naming the format; `from=2026-02-30` → 400 "not a real calendar date"; reversed range → 400 |
| HIST-04 | Empty machine, empty range and failure read differently | `an empty machine, an empty range and a failed load read differently` — all three sentences must exist in `history.js` |

## Mutations — each defect reintroduced, each caught

| Defect | Assertion that failed |
|---|---|
| The date range is ignored (`if (false)`) | `a range that excludes the job returns nothing…` — returned the job with `total 1` |
| History is forced to closed-only | `a machine lists every job against it, open ones included` — got 1 row instead of 2 |

Both were applied together and both failed, so neither masked the other.

## Judgement calls recorded

* `total` is a separate `COUNT(*)`, not `rows.length`, because the list is capped at
  500. Returning the capped length would report a smaller past than exists.
* The History screen asks for `status=done`: a job still running belongs on the work
  orders screen, where it can be acted on. That is a client decision, so the endpoint
  stays general — which is what phase 15's export will need.

## Not verified

The screen in a real browser. There is none in this environment; the DOM wiring is
covered by the static checks (every handler exists, every looked-up id exists), which is
the same bar the rest of the client is held to.
