# Phase 15 — Verification

**Suite:** 226 checks, 0 failures under `PATH=/nonexistent`.

## Requirements

| ID | Requirement | Where it is proven |
|---|---|---|
| FIND-01 | Free-text search over work orders and machines, partial and case-insensitive | `search finds a job by a word in its title`, `search finds jobs through the machine they belong to`, `search ignores case`, `machines can be found by asset tag`, `machines can be found by where they are` |
| FIND-02 | Search composes with the existing filters | `search composes with the status filter`, `search composes with the history screen`, `search and a date range narrow together` |
| FIND-03 | The file is built from the same filter as the screen | `the work-order export applies the same search as the screen` — compares the row count with the screen's and asserts the non-matching title is *absent* from the file |
| FIND-04 | "Nothing matched" reads differently from "nothing here" | `a search with no hits says so instead of showing an empty list` — all three sentences must exist in the client |

## Mutations

| Defect | Result |
|---|---|
| `likeParam()` stops escaping `%` | 1 failure: 4 rows matched a wildcard search |
| Work-order search clause removed | 6 failures, including the export |
| Export ignores `q`, screen obeys it | 1 failure: **4 csv rows vs 1 on screen** |

Each mutation was run alone. The first and second interact (removing the search clause
makes the wildcard assertion pass for the wrong reason), so they were never applied
together.

## Judgement calls

* The history export has **no row limit** (`historySql(filter, 1_000_000)`). The screen
  shows the most recent 500 and says so; a file should contain everything that matches.
* The history total query joins `equipment` because the search matches a machine's name.
  A total counted over a narrower set than the rows is the same class of bug as a file
  that disagrees with its screen.

## Not verified

Typing in a real browser. The debounce, the empty-state wording and the query builders
are covered by static assertions and by the endpoint behaviour they call; no browser
exists in this environment.
