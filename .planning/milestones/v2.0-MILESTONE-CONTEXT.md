# Milestone v2.0 — Context

Captured from discussion, 2026-11-05.

## The request

Give the app a sidebar carrying Due soon, Machines, Work orders, Maintenance,
Spare parts, Users and Backup, update the UI of those pages, and put a
**dashboard** before Due soon showing all the important information.

## Decisions taken

| Question | Answer | Consequence |
|---|---|---|
| What does the dashboard show? | Counts **plus** the top items in each so you can act without navigating | Four summary cards, each with its count and its shortest useful list |
| Does the sidebar collapse? | Yes — full labels by default, a toggle to an icon rail | Two visual states to build and test, not three |
| Who lands on the dashboard? | Everyone signed in, technicians included | The dashboard must be role-aware: a technician must not see user or backup counts |
| One milestone or split? | One milestone, all of it | Sidebar, dashboard and six page updates are all v2.0 |

## Why v2.0 and not v1.2

v1.0 and v1.1 were both about *what the app can do*. This is about *how it
presents what it knows* — a new shell, a new landing page, and a rewritten
presentation layer across six screens. That is a major-version change by the
project's own convention, not an increment.

## What this does not change

- **No new business rules.** Every screen shows and edits the same data through
  the same endpoints. If a page update needs a new endpoint it must say so in
  its plan; the default is to reuse what exists.
- **The constraints stand.** Plain JavaScript, no framework, no CDN, no
  `node_modules`, runs offline, works on Windows, readable by a beginner.
- **The smoke suite grows, never shrinks.** Every new screen and every new
  interactive control gets assertions, and each assertion is proved to fail
  before it is trusted.

## The one genuine tension

The project's core value is that *a beginner can read every file in one
sitting*. A sidebar, a dashboard and six polished pages is the largest
presentation change so far, and `public/app.js` is already 424 lines. The phase
plans must keep the browser code splittable — a dashboard module and a shell
module rather than another 300 lines appended to one file.

## Open question deferred to the plan

Does the dashboard call one `/api/dashboard` endpoint, or reuse the four
existing list endpoints? Reuse adds no server code and reuses tested queries;
a single endpoint is one round trip and one place to change. The phase plan
must decide and record why, rather than leaving the client to invent a fifth
way of asking for the same data.
