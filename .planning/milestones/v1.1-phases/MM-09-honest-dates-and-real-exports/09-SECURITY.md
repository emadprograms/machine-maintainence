---
phase: "9"
slug: "honest-dates-and-real-exports"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-11-05"
---

# Phase 9 — Security

> Audited inline (no `gsd-security-auditor` agent installed); each threat probed against a
> running server on :3555 with a throwaway database. Gate: ASVS L1, block on `high`.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser → CSV file | Data leaves the application's control and lands in a spreadsheet, which executes things the app would not | Titles, supplier names, names, prices |
| Browser → API | Session cookie; exports are reads, so any signed-in user can download either file | Work orders, parts, owners |
| Query string → SQL | Filter values (`status`, `equipment_id`, `assigned_to`, `low`) now reach a WHERE clause | Filter values |
| Caller → date field | A date string is written into `last_done` and drives scheduling | Completion dates |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-9-01 | Injection (CSV formula) | `toCsv` / `csvCell` | **high** | mitigate | Any cell beginning `=`, `+`, `-` or `@` is prefixed with `'`, applied to every cell rather than a known-bad list | closed |
| T-9-02 | Injection (SQL) | `workOrderFilter`, `partsFilter` | **high** | mitigate | WHERE fragments are literals in the source; every caller-supplied value is a bound parameter. Probed with `'; DROP TABLE work_orders;--` → 200, table intact, list still readable | closed |
| T-9-03 | Broken access control | Export routes | **high** | mitigate | Both routes sit behind the session gate; anonymous requests get 401. Verified for both files | closed |
| T-9-04 | Data integrity | `POST /api/pm/:id/done` | medium | mitigate | Strict `YYYY-MM-DD` + calendar round-trip; future dates and dates before `last_done` refused with 400. A refused value leaves both stored fields unchanged (asserted) | closed |
| T-9-05 | Path traversal | Static file server | medium | mitigate | Export paths are matched by a route regex before the static fallback; `/api/export/../../etc/passwd` → 404 | closed |
| T-9-06 | Injection (response header) | `sendCsv` | medium | mitigate | The filename is a literal in the route, never derived from input, so no CR/LF can reach `content-disposition` | closed |
| T-9-07 | Information disclosure | Export contents | low | accept | A technician can export both lists, including unit prices and suppliers. They can already see both lists on screen; the file is the same data in another shape, so this adds no exposure. AR-9-02 | accepted |
| T-9-08 | Availability | CSV buffering | low | accept | The whole file is built in memory before sending. At workshop data volumes the file is kilobytes; there is no pagination path that could produce a large one. AR-9-01 | accepted |
| T-9-09 | Input validation | `workOrderFilter` numeric params | low | accept | A non-numeric `equipment_id` becomes `0` via `Number()`, which matches no row and returns an empty list rather than an error. Correct outcome, poor error message. Recorded rather than silently fixed, since a 400 here buys nothing a user needs. AR-9-03 | accepted |

---

## Verified by

| Threat | Evidence |
|--------|----------|
| T-9-01 | Live probe with `=cmd\|'/c calc'!A1`, `@SUM(1+1)`, `+HYPERLINK(...)`, `-2+3` in a supplier field — every exported cell came back prefixed; a script scanning for unprefixed formula-leading cells found **none**. Smoke: "a value a spreadsheet would execute is neutralised". Note the third payload was *also* quoted, because it contains commas and quotes — both defences applied, which is the point of not relying on quoting alone. |
| T-9-02 | `status=' OR '1'='1` → `[]`; `status=x'; DROP TABLE work_orders;--` → 200 and the table still lists. Bound parameters throughout. |
| T-9-03 | `anon wo-export 401`, `anon parts-export 401` |
| T-9-04 | Smoke: 5 malformed values → 400; future → 400; pre-`last_done` → 400; "a refused date leaves `last_done` untouched" |
| T-9-05 | `/api/export/../../etc/passwd` → 404 |
| T-9-06 | `content-disposition: attachment; filename="work-orders.csv"` — literal |

---

## Accepted Risks

**AR-9-01 — CSV is built in memory.** `sendCsv` computes `content-length` and
sends the buffer. Streaming would avoid holding it, but nothing in this
application can produce a file large enough for that to matter, and a streamed
response cannot report a length. Revisit if the workshop ever exports a
multi-year history.

**AR-9-02 — Exports are not role-filtered.** Both CSV routes are available to any
signed-in user. This mirrors the lists exactly, so no privilege is gained. If
prices ever become admin-only on screen, the export must follow in the same
change.

**AR-9-03 — Numeric filters coerce instead of rejecting.** `Number('abc')` is
`NaN`, and `NaN` bound to `equipment_id = ?` matches nothing. The user sees an
empty table rather than a message. Accepted because the outcome is not wrong,
only unhelpful, and an error state adds a code path for a value no control on
the page can produce.

---

## Not covered

- Opening a malicious export in real Excel, LibreOffice or Sheets. The payloads
  are asserted as text with the prefix present, which is the contract; that each
  application honours the prefix is their behaviour, not this code's.
- Any attack requiring a compromised session cookie. That surface is unchanged
  since v1.0 and is phase 10's subject.
