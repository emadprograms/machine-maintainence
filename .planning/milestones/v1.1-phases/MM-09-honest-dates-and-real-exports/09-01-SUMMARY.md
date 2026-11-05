---
phase: 9
plan: 1
name: Mark done honours the date
status: complete
one-liner: A completion date is stored, validated, or refused; req.body was assigned at the source
tasks: 4
files_modified: [starter/server.js, starter/public/app.js, starter/scripts/smoke-test.js]
requirements: [PM-01, PM-02, PM-03]
commits: [90e0aa2]
---

# Plan 9-01: Mark done honours the date

**Tasks:** 4
**Status:** Complete

## What was wrong

`POST /api/pm/:id/done` read `req.body?.on`, but `req.body` was never
assigned anywhere in the server. Every handler that read a body got
`undefined`. The PM route's fallback then produced today's date, so a
request carrying `on: "2026-01-15"` answered **HTTP 200** and wrote today —
correct-looking, silently wrong. This is the class of bug that survives a
green test suite, because the status code was never the thing at fault.

## What was built

**Task 1 — the root cause, not the symptom.** `readBody()` now caches its
promise on `req._body`, and `route()` awaits it once and assigns `req.body`
for methods that actually carry a body (`POST PUT PATCH DELETE`). A GET's
stream is already at EOF, so attaching listeners would hang the request;
the set is the guard, not an optimisation. Fixing this at the one call site
would have left the next handler to rediscover it.

**Task 2 — strict parsing.** `parseDay(raw)` requires `^\d{4}-\d{2}-\d{2}$`
and round-trips the value through `Date` and back, so `2026-02-30` is
refused rather than rolling into March 2 the way `new Date()` alone would
allow. Returns `{value}` or `{error}`.

**Task 3 — the route enforces the calendar.** A future date is refused; a
date earlier than the schedule's existing `last_done` is refused; an absent
value still means today, because that default is honest. Refusals return
400 naming the problem, and the response carries `next_due`.

**Task 4 — assertions that prove the value is used.** The old test asserted
the status code, which passed against the broken code. The new ones assert
that `last_done` equals the date sent and that `next_due` equals that date
plus the interval, plus a matching assertion that a refused date leaves
both fields untouched.

## UI

The Mark done column gained a date field defaulting to today, and
`pmDone()` sends its value. Before this, the page had no way to express
"it was done last Tuesday" at all.

## Proof the tests bite

Each bug was reintroduced and the suite re-run:

| Bug reintroduced | Result |
|---|---|
| `base = today` (the original v1.0 bug) | 2 failures, naming `last_done=2026-11-05` |
| lenient parsing, no calendar round-trip | `2026-02-30` accepted, 3 failures |
| validation skipped for future and past dates | refusals gone, 3 failures |

## Deviation from the plan

The plan did not call for touching `req.body` globally; it assumed the PM
route's read was the bug. Probing showed no handler could read a body at
all, so the fix moved to `route()`. Recorded here because it widens the
blast radius: every POST/PUT/PATCH/DELETE now carries `req.body`, and the
existing 85 checks confirmed nothing depended on it being `undefined`.
