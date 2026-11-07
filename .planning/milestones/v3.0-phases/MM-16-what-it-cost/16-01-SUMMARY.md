---
phase: 16
plan: 01
status: complete
checks: 240
---

# What shipped

* **Labour hours per job** — optional, editable inline, refused when negative or not a
  number, and shown as `—` when never recorded.
* **A cost per job**, computed on the server as `hours × rate + parts used`, shown in the
  work-order list beside the hours.
* **An hourly rate as a setting** (`GET`/`PUT /api/settings`, admin only) with a field on
  the Report screen. No redeploy to change what an hour costs.
* **The Report screen** — pick a month, see jobs closed, hours, parts, labour and total,
  then the machines that took the most work.
* **`GET /api/export/report.csv`** — one row per machine plus an "All machines" total,
  built from the same `monthReport()` the screen uses.

# Two mistakes worth recording

1. `node --check` passed while the module failed to compile: a second top-level
   `const listed`. It only surfaced at runtime as `Identifier 'listed' has already been
   declared`. `--check` is not a substitute for running the suite.
2. The first cost mutation replaced `* ?` with `* 0`, which changed the number of bound
   parameters and made every work-order request fail — the suite crashed at an earlier
   phase instead of failing the assertion meant to catch it. The faithful mutation was to
   pass `0` as the rate and leave the binding intact, which produced the intended
   failure: *cost 25, expected 125*.

# Carried forward

`server.js` is now 814 lines, well past the ~600-line signal. The route table should be
split by domain before the next feature; recorded in `PROJECT.md` and `README.md`.
