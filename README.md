# Machine Maintenance

A small, offline web app for keeping a maintenance record of industrial machines:
what they are, what work has been reported against them, what is due next, what is in
the spare-parts store — and, since v3.0, what the work is costing and how that is trending.
A machine's state follows the latest explicit work-order report, stage update or closing confirmation.
Closing requires confirmation that the machine is running; a closing note is optional. Admins can correct or delete only the latest stage, including
its photos, videos, attached job report, time and spare parts. Machines can record a model and serial number. Once a stage exists, the original report is locked;
the chronological timeline includes the original report, photo previews, stages and closure. Machine history links each numbered job to that timeline; work orders have sortable last-activity timestamps. The Reports section generates work-order, machine service, monthly and spare-parts reports that can be printed or saved as PDFs. Spare-part records can hold photos, videos and receipt documents. Deleting a machine — which removes its work orders and everything else — asks you to type its name; anybody
can add a machine and report a fault. A retired machine leaves the everyday list — the machine filter offers in service, down,
retired or everything — stops being offered when new work is started, and stops generating
maintenance reminders, without losing anything it has.

It runs on one Windows machine on a network with no internet access. There is no
installer, no database server and no build step: Node.js runs the files in this
repository directly.

## Run it

```bat
cd app
start.bat
```

Then open <http://localhost:3000>. `app/README.md` is the full guide — how the data
is stored, how to back it up and restore it, what to do if the password is lost, and how
to add a field or a table yourself.

## Where things are

| Path | What it is |
|---|---|
| `app/` | **The application.** Plain JavaScript, no dependencies, no build. `app/server.js` starts it; `app/routes/` holds the endpoints. |
| `app/README.md` | The guide for whoever runs or modifies it. Start here. |
| `.planning/` | The project record: milestone specs, phase plans, verification and security reports |
| `.planning/milestones/` | Shipped milestones, archived: requirements, roadmap, review findings, UAT evidence |
| `LOCAL-AGENT-VERIFY-PROMPT.md` | A pending task: verify the data-persistence fix on the real Windows machine |
| `LICENSE` | MIT |

## Tests

```bat
cd app
node --no-warnings=ExperimentalWarning scripts/smoke-test.js
node --no-warnings=ExperimentalWarning scripts/audit-offline.js
node --no-warnings=ExperimentalWarning scripts/media-test.js
node --no-warnings=ExperimentalWarning scripts/reports-attachments-test.js
```

The first starts its own server on a throwaway database and checks hundreds of behaviours; the
second proves the app reaches nothing outside the machine. All must pass before a change
is finished, and every assertion is expected to fail when the defect it guards is
reintroduced — see `.planning/RETROSPECTIVE.md`.

## History

This repository began as a hackathon project: a React/TypeScript frontend, an Express
backend writing its whole database to disk on every request, a Netlify function, and
some 55 MB of stock photographs in three copies. It was reviewed
(`.planning/milestones/v1.0-CODE-REVIEW.md`), and replaced by the small application in
`app/` across five milestones — v1.0 the core, v1.1 operable, v2.0 presentable,
v3.0 the record and v4.0 stage correction.

The old application was removed from the working tree in November 2026. It survives in
git history up to commit `4971ea3`, and upstream at
[`Ilop08/SIAI`](https://github.com/Ilop08/SIAI). The review that drove the rewrite is
kept because every design decision in `PROJECT.md` answers one of its findings.
