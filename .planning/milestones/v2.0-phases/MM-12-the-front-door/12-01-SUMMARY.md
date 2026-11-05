---
phase: 12
plan: 1
name: The dashboard endpoint
status: complete
one-liner: One /api/dashboard returning four counts, capped lists, and the screen each owns
tasks: 2
files_modified: [starter/server.js, starter/scripts/smoke-test.js]
requirements: [DASH-01, DASH-02, DASH-04]
commits: [8dfcc9a]
---

# Plan 12-01: The dashboard endpoint

**Tasks:** 2
**Status:** Complete

## What was built

`GET /api/dashboard` behind the session gate, returning four sections — each
`{ count, items, href }`:

| Section | Source | Filter |
|---|---|---|
| `work_orders` | `workOrderFilter({})` + `status <> 'done'` | ordered by priority, then age |
| `due_soon` | same 7-day window and date arithmetic as `/api/pm/due` | 7 days |
| `low_stock` | same predicate as the parts list | `qty <= reorder_level` |
| `machines` | equipment | `status = 'down'` |

Items are capped at 5; `count` is the true total.

## Decisions

**One endpoint.** Four existing list calls would have added no server code, but
the count would then live in the browser, where nothing tests it. Recorded in full
in `12-CONTEXT.md`.

**`count` and `items` are separate facts.** Capping the count would make the card
say 5 when 40 parts are low. Verified by seeding seven low-stock parts: count 7,
items 5.

## Verification

Live server: empty database gives four zeros with empty lists; the seeded database
gives 3/2/7/1, all lists capped, and the work-order count agrees with
`GET /api/work-orders`.

Assertions added to the suite (17 new checks). Nine mutations run; **three
survived and the assertions were rewritten**:

| Mutation | First result | Fix |
|---|---|---|
| Remove `status <> 'done'` | **survived** — every seeded order was open, so the count was right by accident | close one work order and assert the count drops by exactly one |
| Delete two `escapeHtml` calls | **survived** — the check counted calls with a loose threshold | name each user-controlled field |
| Point a card at another real screen | **survived** — "points at a real screen" was the whole assertion | assert each section's exact href |

All three now fail when reintroduced.
