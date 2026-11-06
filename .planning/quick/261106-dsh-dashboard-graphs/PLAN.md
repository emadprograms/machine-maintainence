# Quick task 261106-dsh — graphs on the dashboard

**Requested:** "I want to see graphs on the dashboard too."

## The question a graph has to answer
The four cards answer "what needs doing today". They cannot say whether the workshop is
getting busier or more expensive, because one number has no direction. The graphs answer
that, and nothing else.

## Shape
Two charts under the cards: **jobs closed per month** and **what each month cost**
(parts under labour, stacked), six months, newest on the right.

## Constraints that decide the implementation
* No charting library and no CDN — the app ships nothing and fetches nothing. The bars are
  SVG built by hand, like the sidebar icons.
* The numbers come from the server, and specifically from `report.js` — the same function
  behind the Report screen. A bar must not be a second opinion about the owner's money.
* `public/charts.js` builds strings and touches no DOM, so the smoke test can import it in
  Node and check geometry and escaping. A browser is the one thing this project cannot test.
