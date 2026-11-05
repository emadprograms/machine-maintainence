# Phase 9: Honest dates and real exports - Context

**Gathered:** 2026-11-05
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous — recommended answers recorded as accepted)

<domain>
## Phase Boundary

No endpoint may silently ignore an input, and the two lists a workshop actually puts in Excel can
be exported. Concretely: "mark done" honours a supplied completion date (or refuses it with a
reason), and work orders and parts download as CSV that opens directly in Excel.

Out of scope: import, PDF, scheduled/emailed reports, and charts.

</domain>

<decisions>
## Implementation Decisions

### The dropped date (PM-01/02/03)
- Root cause is not the PM handler: `req.body` is never assigned in `server.js`, so *any* handler
  reaching for it gets `undefined`. Fix the plumbing (`req.body = body`) rather than deleting the
  dead line, because the next feature would otherwise trip on the same trap.
- `on` is parsed as a strict `YYYY-MM-DD`. Anything else is 400 naming the field
  (`"on must be a date like 2026-11-05"`), never silently replaced by today.
- A date in the future is refused: completing maintenance that has not happened would push
  `next_due` past a cycle. A date before `last_done` is also refused — it would move the schedule
  backwards.
- The response returns `next_due` so a caller can see the roll-forward without a second request.

### CSV shape
- `GET /api/export/work-orders.csv` and `GET /api/export/parts.csv`.
- UTF-8 with a BOM, because Excel misreads accented characters from a BOM-less UTF-8 file. This
  is the "opens in Excel without a manual import step" requirement, and it is not optional.
- CRLF line endings, per RFC 4180. Quoting: wrap any field containing `,` `"` `\n` `\r` or leading/
  trailing space in double quotes, doubling internal quotes. Applied to **all** fields, not only
  the ones that look dangerous — the branch that decides is the branch that breaks.
- Header row uses the same human labels as the UI, so the file reads correctly on its own.
- Content-Type `text/csv; charset=utf-8` and `Content-Disposition: attachment; filename="..."`.

### Filters (CSV-03)
- The export honours `?status=` and `?equipment_id=` for work orders, and `?low=1` for parts.
- Same query builder used by the list route and the export, so "what you see" and "what you get"
  cannot drift — a separate export query is how that bug is usually born.
- The UI passes its current filter state into the download link.

### UI
- A "Download CSV" button on the Work orders and Spare parts screens.
- Implemented as a plain `window.location` to the export URL — no fetch, no blob juggling. The
  browser's own download handling is more reliable than a hand-rolled one and needs no code.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `route()` / `send()` / `readBody()` — the export routes need raw headers, so they use `res.writeHead`
  directly but still go through `route()` for the session check.
- `day()` helper trims a date to `YYYY-MM-DD`.
- The parts list and work-order list SQL are the sources the exports must mirror.
- `alert(e.message)` for surfacing a refused date.

### Established Patterns
- Validation returns `{ value } | { error }` (from phases 7 and 8).
- Errors are readable sentences, 400 with `{ error }`.

### Integration Points
- `starter/server.js` — `route()` at line 66; PM handler at line 367; work-order list at line 178.
- `starter/public/app.js` — `loadWork()` and `loadParts()`; `pmDone()` around line 200.
- `starter/public/index.html` — the two table headers.
- `starter/scripts/smoke-test.js` — PM block and the phase 7/8 blocks.

</code_context>

<specifics>
## Specific Ideas

- The regression assertion for PM-01 must prove the value is **used**, not merely that the call
  returns 200. v1.0 returned 200 while ignoring the parameter, which is exactly why the bug
  survived. So: send a date, assert `last_done` equals that date and `next_due` equals date+interval.
- CSV-04 gets a deliberate nasty fixture: a title containing a comma, a double quote and a newline
  all at once, then parse the output back and confirm the column count is unchanged.

</specifics>

<deferred>
## Deferred Ideas

- CSV import — learn the real column shape from exports first.
- Per-machine history export — a filter on the work-order export, not a new endpoint.
- Scheduled digest file for a Windows task — the due-soon page covers it; a file writer is v1.2.
- Excel-native .xlsx — CSV plus a BOM is what a workshop actually needs, and it needs no library.

</deferred>
