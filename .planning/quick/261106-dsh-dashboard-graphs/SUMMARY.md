# Quick task 261106-dsh — done

**New files:** `app/trend.js` (47), `app/public/charts.js` (101).
**Changed:** `routes/dashboard.js`, `public/dashboard.js`, `public/index.html` (styles).

* `GET /api/dashboard` now also returns `charts.trend` — six months, oldest first, each
  with jobs, hours, parts, labour and total, computed by `monthReport()` so a bar and the
  Report screen cannot disagree.
* `stackedBars()` draws a chart as an SVG string: round axis top, three gridlines, one
  `<title>` per bar so a screen reader and a hover both get the exact figure, and an
  `aria-label` summarising the whole series.
* Empty history shows a sentence, not six empty bars — a chart of zeroes reads as broken.

## Proof
12 new checks (250 → 262):
* six months, oldest first, the last one is the current month
* the last bar equals `GET /api/report?month=…` — total *and* job count
* one bar per value; the taller value draws the taller bar (1:4 → heights 1:4)
* a zero month draws no bar
* every label escaped (`<script>` in a month label comes out as `&lt;script&gt;`)
* the module fetches nothing and stays under 200 lines

Mutations, each failing its own assertion: months emitted newest-first (4 failures),
the bar's total computed from labour alone (1), escaping removed (1).

## Seen, not assumed
A demo database (12 closed jobs across six months, in `/tmp`, outside the repo) was served
on port 3000 and the endpoint checked end to end: with the rate at 40, October's bar reads
parts 59 + labour 360 = 419, and the chart's axis rounds 419 to 500.
