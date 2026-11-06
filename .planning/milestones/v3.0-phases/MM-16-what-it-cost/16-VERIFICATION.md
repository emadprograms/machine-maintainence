# Phase 16 — Verification

**Suite:** 240 checks, 0 failures under `PATH=/nonexistent`.

## Requirements

| ID | Requirement | Where it is proven |
|---|---|---|
| COST-01 | Labour hours are recorded; nonsense is refused | `negative hours are refused in words` (400, "cannot be negative"), `hours that are not a number are refused` (400, "must be a number"), `hours are stored and come back` (2.5 round-trips) |
| COST-02 | A job costs its parts plus its hours at the rate | `a job costs parts plus hours at the configured rate` — 2.5 h at 40 plus 2 × 12.50 of parts must equal exactly 125 |
| COST-03 | A month's report | `the report answers for a month`, `the report counts the jobs, hours, parts and labour at the rate` (checks the arithmetic identity, not just the presence of fields), `the report names the machines that took the most work`, `a month that is not YYYY-MM is a readable 400`, `a month with nothing in it is zeroes, not an error` |
| COST-04 | The report exports, matching the screen | `the report exports with a total row that matches the screen` — parses the CSV, finds the "All machines" row and compares jobs and parts cost against the API |

## Mutations

| Defect | Result |
|---|---|
| Negative hours accepted; the rate's admin check removed | 2 failures, both named |
| The list's cost ignores the configured rate | `cost 25, expected 125` |

A third mutation was discarded as unfaithful: replacing the bound rate with a literal
changed the parameter count, so the server errored instead of computing a wrong cost.
A mutation that breaks the plumbing proves nothing about the arithmetic.

## Why the cost assertion uses exact numbers

`Number(costed.cost) === 125` fails on any change to the arithmetic, the rate lookup or
the parts multiplication. An assertion of the form "cost is greater than zero" would pass
for every one of those defects, and did pass during an early draft.

## Not verified

The Report screen in a browser; `<input type="month">` behaviour on Windows keyboard
input; and money formatting in a locale that uses a comma as the decimal separator —
`toFixed(2)` is deliberately locale-independent, which is right for a file and arguable
for a screen.
