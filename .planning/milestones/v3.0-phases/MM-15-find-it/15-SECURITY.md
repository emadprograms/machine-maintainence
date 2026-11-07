# Phase 15 — Security

ASVS level 1, block on `high`.

| Check | Result |
|---|---|
| Authentication | `/api/equipment?q=` and `/api/export/history.csv` are both behind the shared `route()` guard; neither is `public` |
| Injection | The search value is a bound `?` parameter like every other value. Wildcards are escaped before binding, so the escaping cannot be bypassed by input |
| DoS via search | Each search adds at most three LIKE clauses over tables this app sizes in the hundreds, with `busy_timeout` set. The history row query stays capped at 500 for the screen; the export is unbounded by design and is worth watching if a shop ever reaches six figures of closed work |
| Data egress | `history.csv` hands over every job title, machine name and owner name in the database. It is authenticated and role-agnostic, exactly like the work-order list it mirrors — the same data the screen already shows, so it widens nothing |
| XSS | The search text is echoed into empty-state sentences that go through `emptyRow()` and `esc()`, and into `"…"` quoting in `history.js` through `esc()` |

## Note for phase 16

The report export will be the fourth file endpoint. It must repeat this pattern:
authenticated, built from the same filter function as the screen, and no hand-assembled
query string on the client.
