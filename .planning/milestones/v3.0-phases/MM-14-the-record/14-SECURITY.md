# Phase 14 — Security

ASVS level 1, block on `high`.

| Check | Result |
|---|---|
| Authentication | `GET /api/history` is not `public`; an unauthenticated request is 401 through the shared `route()` guard |
| Authorisation | History is read-only and readable by every role, like the work order list. It exposes job titles, machine names and owner names — no password hashes, no emails |
| Injection | Every value travels as a `?` parameter. The only interpolated fragments are fixed `where` clauses and a `LIMIT` built from a constant |
| XSS | `history.js` escapes through `esc()` / `strong()` / `soft()` from `app.js`; the machine name shown in the dialog comes from `textContent`, never from HTML |
| DoS | The row query is capped at `MAX_ROWS = 500`; the count is one aggregate |
| Information leak | A malformed date names the field and the format, nothing about the schema or the file |

No new endpoint writes anything, so there is no new write surface and no new CSRF
exposure.

## One thing to watch in phase 15

The CSV export will reuse `history-query.js`. When it does, the export must stay behind
the same authentication guard — an export is a data egress path, and it is the one route
in this app that hands a whole table to the caller in one response.
