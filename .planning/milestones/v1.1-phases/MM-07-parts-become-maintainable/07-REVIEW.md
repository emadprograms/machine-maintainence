---
phase: 7
status: findings
depth: standard
files_reviewed: 5
critical: 0
warning: 1
info: 2
reviewed: 2026-11-05
---

# Phase 7 — Code Review

Scope: the five files phase 7 changed — `starter/server.js`, `starter/db.js`,
`starter/public/app.js`, `starter/public/index.html`, `starter/scripts/smoke-test.js`.

> Reviewer note: `agents_installed: false` in this environment, so the `gsd-code-reviewer`
> agent could not be spawned. This pass was performed inline against the diff, and every
> finding below was reproduced against a running server before being recorded.

## Findings

### WR-7-01 — Malformed JSON leaked a raw `TypeError` (fixed)

**Severity:** warning · **File:** `starter/server.js` · **Status:** fixed in this phase

`readBody()` resolved `null` when the body failed to parse, and handlers then dereferenced it.
`PUT /api/parts/1` with `{bad json` returned:

```
400 {"error":"Cannot read properties of null (reading 'name')"}
```

Reproduced live before the fix. The impact is a confusing message, not a crash, because
`route()`'s catch-all turned it into a 400 — but it is the same bug family v1.0 fixed when
it stopped leaking SQL text, and it affected **every** route that reads a body, not just
the new one.

Fixed centrally rather than per handler: `readBody` now rejects with a `BadBody` error and
`route()` maps it to `400 { error: 'The request body is not valid JSON' }`. Verified against
`PUT /api/parts/:id` and `POST /api/equipment` (a handler this phase never touched).

### IN-7-01 — `onclick` interpolation of a part name

**Severity:** info · **File:** `starter/public/app.js` · **Status:** fixed during implementation

The first version of the delete button interpolated the part name into an inline `onclick`
with hand-rolled quote escaping. A part named `O'Brien` would have broken the attribute.
Replaced by passing only the row id and looking the name up in the cached list.

### IN-7-02 — `reorder_level` has no upper bound

**Severity:** info · **File:** `starter/db.js`, `starter/server.js` · **Status:** accepted

`qty` is capped at 1,000,000 by `stockValue()`, but the same helper validates `reorder_level`,
so it inherits the cap. The `CREATE TABLE` column declares no CHECK constraint, unlike
`pm_schedule.interval_days`. Accepted: the API is the only writer, it validates, and adding a
CHECK would require a table rebuild (SQLite cannot `ALTER TABLE ... ADD CONSTRAINT`), which is
more risk than the constraint is worth at this scale.

## Verified clean

- **Injection:** every part write uses bound parameters; no string concatenation reaches SQL.
- **Mass assignment:** `PUT` enumerates its accepted fields; `id` comes only from the URL.
- **Partial updates:** `??`/`undefined` fallbacks proven by an assertion that a rename leaves
  stock untouched.
- **The in-use guard:** returns 400 naming the job, and an assertion checks the message
  contains neither `FOREIGN KEY` nor `constraint`.
- **Migration:** `ensureColumn` proven against a hand-built pre-phase-7 database file, including
  an existing row (kept its `qty`, gained `reorder_level` default 5) and idempotency on a
  second start.
- **Escaping:** `esc()` covers all rendered part fields; the one unescaped site was the
  `onclick` above and it is gone.

## Test quality check

The two malformed-JSON assertions were validated by reintroducing the bug: the pair went
`FAIL` with the exact TypeError, then green again once restored. A new assertion that passes
both before and after a fix would be worthless, and this one was checked.
