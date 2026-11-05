---
phase: 9
plan: 2
name: CSV export
status: complete
one-liner: Work orders and parts export as RFC 4180 CSV that opens in Excel and matches the screen
tasks: 4
files_modified: [starter/server.js, starter/public/app.js, starter/public/index.html, starter/scripts/smoke-test.js]
requirements: [CSV-01, CSV-02, CSV-03, CSV-04]
commits: [90e0aa2]
---

# Plan 9-02: CSV export

**Tasks:** 4
**Status:** Complete

## What was built

**Task 1 — a writer worth trusting.** `toCsv(rows, columns)` follows
RFC 4180: CRLF line endings, every cell containing `,` `"` `\r` `\n` or
leading/trailing whitespace quoted, internal quotes doubled. Quoting is
applied by inspecting each value, not by a list of known-bad cases — the
branch that decides what is dangerous is the branch that eventually gets it
wrong.

Formula injection is handled separately from quoting: a cell beginning `=`,
`+`, `-` or `@` is prefixed with `'` so Excel and Sheets treat it as text.
Quoting alone does **not** stop a formula, which is the part that is easy
to get wrong.

**Task 2 — two routes, one filter.** `workOrderFilter()` and
`partsFilter()` build the WHERE clause and its bound parameters once. The
list routes and the export routes both call them. Two separate queries
that are supposed to agree is how "the file does not match the screen"
(CSV-03) ships; here the two cannot disagree without deleting a function.

The BOM is added by `sendCsv()`, not by `toCsv()`, so the writer stays a
pure string function and the tests can exercise it without stripping
encoding artefacts.

**Task 3 — buttons and filters.** Download buttons on the work-orders and
parts pages. Both use `window.location`, letting the browser handle the
`content-disposition` download instead of buffering the file in script.

Building the buttons exposed a real gap: neither page had a filter to
preserve. CSV-03 asks the export to honour the on-screen filter, which is
unobservable if no filter exists. So a status select and a low-stock
checkbox were added, and the list routes now read them too — `?status=`
and `?low=` were previously ignored on the list side, meaning the screen
showed everything while the export narrowed. Each export reads only its
own page's filter.

**Task 4 — assertions that parse.** The test suite gained a minimal RFC
4180 reader instead of splitting on commas. A naive split agrees with a
naive writer, so it cannot distinguish a correctly quoted file from a
broken one; the first version of this test did exactly that and reported a
failure that was the test's fault. Now the file is parsed and the columns
are compared by header name.

## A format bug found while probing

`closed_at` was written by JavaScript as `2026-11-05T09:42:16.085Z` while
`created_at` came from SQLite as `2026-11-05 09:42:16`. On screen nobody
noticed; in a spreadsheet column the two sort as text and interleave
nonsensically. Both now use one format (`nowStamp()`), and an assertion
checks the column.

## Proof the tests bite

| Bug reintroduced | Result |
|---|---|
| quoting removed | field with a comma splits the row, 4 failures |
| BOM removed | 3 failures, header reads `D,Machine,…` |
| formula prefix removed | 1 failure, `=1+1` exported raw |
| `closed_at` back to ISO | 1 failure naming the mixed format |

## Not covered

- A file over 1 MB is buffered in memory before sending. At workshop data
  volumes this is not reachable; note it rather than pretend otherwise.
- The export is a read, so a technician can download both files. That is
  consistent with them being able to see both lists on screen; no new data
  is exposed.
