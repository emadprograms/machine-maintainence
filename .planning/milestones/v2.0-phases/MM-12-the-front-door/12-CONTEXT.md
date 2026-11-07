# Phase 12 — The front door: context

## What exists

Signing in lands on "Due soon", which answers one question: which maintenance is
due in the next N days. The other three numbers that describe a workshop — open
work orders, parts at or below reorder level, machines marked down — are on three
other screens, each requiring a visit and a count by eye.

## Requirements

- **DASH-01** — counts for open work orders, maintenance due soon, low-stock parts, machines down
- **DASH-02** — each summary shows the few items needing action, not just a number
- **DASH-03** — each summary links through to the screen holding the full list
- **DASH-04** — role-aware; a technician sees no user or backup information
- **DASH-05** — an empty state is honest: "nothing open" ≠ "could not load"

## The decision this phase had to make

**One `/api/dashboard` endpoint, not four existing list calls.**

Reusing `/api/equipment`, `/api/work-orders`, `/api/parts`, `/api/pm/due` would
add no server code. It was rejected for three reasons:

1. **The client would compute the answers.** "How many work orders are open" is a
   fact about the database. Deriving it by fetching every work order and counting
   in JavaScript makes the truth live in a place that cannot be tested here — the
   smoke suite has no DOM. An endpoint makes the same fact assertable over HTTP.
2. **Payload.** Four list fetches to render four numbers and eight rows.
3. **A fifth way to ask.** The client would need to know each endpoint's shape and
   its filters. One endpoint is one contract.

The endpoint reuses what exists rather than re-deriving it: `workOrderFilter` for
the open-work-order count, the same `p.qty <= p.reorder_level` predicate the parts
list uses, and the same `date(next_due)` arithmetic as `/api/pm/due`. Where a
query is duplicated it is because the list route's shape does not fit a summary —
and the plan says which and why.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Endpoint shape | One object with four keys, each `{count, items, href}` | The client renders four cards; the server should not make it assemble them |
| "Due soon" window | 7 days, the first option in the Due soon selector | Two definitions of "soon" in one app is how they disagree |
| Item cap | 5 per card | Enough to act on; the card links to the full list |
| Who sees what | Technicians get all four operational cards; no user or backup card exists on the dashboard at all | Simpler than hiding one: there is nothing to hide |
| Empty state | The server returns `count: 0` and an empty list; the client words it | The server should not write UI copy |

## What must not change

The four screens keep their own routes and behaviour. The dashboard reads; it
never becomes the only way to reach something.

## Migration

None.
