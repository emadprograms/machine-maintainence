# Machine Maintenance (lean starter)

A small offline web app for machines, work orders, recurring maintenance and spare parts.
Plain JavaScript, one HTML page, SQLite via Node's built-in `node:sqlite`.
**No `npm install`. No build step. No internet.**

---

## Run it

**Windows:** double-click `start.bat`.
**Anything else:** `node --no-warnings=ExperimentalWarning server.js`

The first run prints an admin password **once**:

```
  Created the first account:
    email:    admin@local
    password: r7JHZ-croEo-mKQFU
```

Write it down. Then open <http://localhost:3000>.

To set the password yourself on first run:

```bat
set MM_ADMIN_PASSWORD=my-password
start.bat
```

### Requirements

Node.js **22 or newer** (it ships `node:sqlite`). Nothing else.
Check with `node --version`.

> `node:sqlite` is still marked experimental in Node 22, which is why every command
> passes `--no-warnings=ExperimentalWarning`. That flag only hides a notice; the
> feature works. It is the one thing to re-check when you upgrade Node.

---

## What is in the folder

| File | What it does | Lines |
|---|---|---|
| `server.js` | Starts up, decides which route a request is, serves the UI pages | 122 |
| `routes/` | **One file per screen group** — see below | 30–199 each |
| `http.js` | `send`, `readBody`, `route()` — how a request becomes an answer | 135 |
| `values.js` | Turns what a browser sends into what the database may store | 85 |
| `who.js` | Who is asking: the session cookie, the user behind it | 35 |
| `db.js` | Database connection, tables, migrations, checkpointing, backup | 453 |
| `filters.js` | Every WHERE clause: search and filters, shared with the exports | 148 |
| `hours.js` / `part-usage.js` | Shared live-hour calculation and atomic part consumption | 8 / 45 |
| `report.js` / `report-types.js` | Monthly completed work, machine service and spare-parts reports | — |
| `trend.js` | The last six months, for the dashboard charts | 47 |
| `auth.js` | Password hashing, login tokens, password generation | 56 |
| `status.js` | Latest explicit machine-state report and the separate retirement rule | 85 |
| `codes.js` | Work order numbers: one series per year, `WO-2026-0001` | 24 |
| `photos.js` / `media.js` | Legacy photo support and streamed media/report storage, validation and downloads | — |
| `reset-password.js` | The way back in when a password is forgotten | 58 |
| `sessions.js` | Sign-ins as rows, so a restart keeps you signed in | 46 |
| `login-log.js` | Records failed sign-ins without blocking anyone | 51 |
| `settings.js` / `dates.js` / `public/time-zone.js` | Workshop time zone; date parsing and DST-aware display | — |
| `public/index.html` | The whole UI shell: every screen and form | 594 |
| `public/app.css` | The main stylesheet — was a `<style>` block until the page reached 600 lines | 406 |
| `public/app.js` | Fetches data and draws the screens that are small enough to keep here | 482 |
| `public/shell.js` · `dashboard.js` · `history.js` · `report.js` · `charts.js` · `machines.js` · `work.js` | One module per screen group; `charts.js` draws the bars, `work.js` holds the fault list and work-order dialogs | 126 · 136 · 188 · 103 · 101 · 304 · 357 |
| `public/sort.js` | The ordering rule for a table — numbers written as text, blanks last, ties kept — kept apart so the suite can run it on rows instead of reading it | 50 |
| `public/tables.js` | Everything every table does the same way: the heading click, the arrow and `aria-sort`, and the three-dot row menu | 121 |
| `public/parts.js` | The spare parts screen: its filter, its table, its editing dialog and its CSV | 155 |
| `public/stage-parts.js` | Optional staged part picker and draft consumption | 136 |
| `public/work-updates.js` | Responsive stage timeline, state switch and latest-stage editor | 226 |
| `public/stage-gallery.js` / `stage-experience.css` | Stage timeline, responsive editor styling and in-app photo previews | — |
| `public/print-job.*` / `print-report.*` | Standalone, print-ready local work-order and reports pages | — |
| `public/report-hub.js` / `public/part-attachments.js` | Report selection and streamed spare-part attachment controls | — |
| `work-lock.js` | Locks the original report when stages exist | — |
| `stage-photos.js` | Stage photo validation and storage | 20 |
| `scripts/smoke-test.js` | Starts a throwaway server and checks hundreds of behaviours | 3,645 |
| `scripts/work-ui-test.js` | Exercises work-order UI interactions with a DOM and API double, invoked by the smoke suite | 611 |
| `scripts/shell-ui-test.js` | Checks sidebar controls, keyboard, preference and failure handling | 45 |
| `scripts/print-ui-test.js` / `stage-gallery-test.js` | Test print rendering, errors, previews and cleanup | — |
| `scripts/stage-migration-test.js` | Tests upgrading existing stage hours and part costs | 51 |
| `scripts/machine-state-migration-test.js` | Tests the state-event migration and idempotence | 62 |
| `scripts/photo-cleanup-test.js` | Tests failed writes and photo-cleanup errors | 40 |
| `scripts/audit-offline.js` | Proves nothing reaches the internet | 156 |
| `start.bat` / `backup.bat` | Windows launchers | — |

The route files, one per screen group:

| File | Routes | Lines |
|---|---|---|
| `routes/auth.js` | login, logout, me | 50 |
| `routes/record.js` | history, history.csv | 45 |
| `routes/equipment.js` | machines: list, create, edit, retire, delete, photograph | 130 |
| `routes/work-orders.js` | work orders, numbers, the photo of the fault, start and close rules, work-orders.csv | 198 |
| `routes/job-print.js` | authenticated, complete one-job print snapshot | 33 |
| `routes/work-updates.js` | stage timeline, time, parts, machine state and photos | 73 |
| `routes/stage-admin.js` | admin-only latest-stage edit/delete and reconciliation | 114 |
| `routes/parts.js` | spare parts, stock on a job, parts.csv | 132 |
| `routes/pm.js` | recurring maintenance | 77 |
| `routes/dashboard.js` | the landing screen's four answers and its six-month trend | 76 |
| `routes/admin.js` | users, assignable people, backup | 84 |
| `routes/report.js` | workshop time zone, the month, report.csv | — |

Total application code: **about 6,364 lines**, and about 4,702 of tests. No application file is past the
~600-line mark this project uses as a signal to split, and the test suite now checks that
rather than trusting anyone to remember it.

---

## How to change things

Everything follows the same three-step shape. Find the three files below and you can
change anything.

### `db.js` — what is stored
Table definitions, in order, from top to bottom. Each is a `CREATE TABLE IF NOT EXISTS`.

### `server.js` and `routes/` — the API
`server.js` starts the program and nothing else. Every endpoint lives in `routes/`, in the
file named after its screen: `routes/parts.js` holds the spare-parts endpoints, and so on.
Each file exports one object keyed by `'METHOD /path'`, and `server.js` joins them together.

Adding an endpoint means opening the file for that screen and adding one entry:

```js
'POST /api/parts/:id/count': route(async (req, res) => { ... }),
```

`req.user` is already filled in by the time your code runs — you don't write auth checks.
`route()` answers a thrown error with a sentence instead of closing the server, and it
rejects a malformed body before your handler sees it.

### `public/app.js` — the screen
One function per page (`loadWork`, `loadParts`, ...) that calls `api('/equipment')` and
writes HTML into a table. Screens big enough to have their own file — `machines.js`,
`history.js` — use the same helpers, so there is one `api()` and one `badge()`.

### `public/app.css` — how it looks
One stylesheet, no framework and no CDN. It moved out of `index.html` when the machine
photograph pushed that page past 600 lines.

---

### The screens

`Dashboard` · `Due soon` · `Machines` · `Work orders` · `History` · `Report` · `Maintenance` ·
`Spare parts` · `Admins & Technicians` (admins) · `Backup` (admins)

`Admins & Technicians` has no public sign-up counterpart: accounts exist only if an admin
creates them. The screen is named for the two roles it holds — the table, the route and the
stored `role` values keep the word *user*, because everything else already speaks it.

* **Every list has a search box** that works with the filters beside it, and the CSV
  download next to it produces exactly the rows on screen.
* **Everything about one machine sits behind three dots** at the end of its row —
  edit, history, retire or restore, and delete — each with an icon instead of four
  buttons repeated on every row.
* **Deleting is a dialog, not a `confirm()`.** It counts what will go ("3 work orders and 1
  maintenance task"), says the history and the photograph go too, and the button stays
  disabled until the sentence *delete machine &lt;name&gt;* is typed; the same check runs again
  before the request is sent. The server cascades: deleting a machine really does delete its
  work orders, their parts, its maintenance schedules and its photograph.
* **The machine table shows what a machine is**: a photograph, its name, barcode,
  manufacturer, category, location and state — one column each, in that order. The empty
  table spans exactly the columns its header names, and the suite checks that rather than
  trusting anyone to count.
* **Every list has a named filter, and each one opens on everything.** Machines
  (all / in service / down / retired), work orders (any status / open / in progress /
  done), spare parts (all / at or below the reorder level / out of stock), maintenance
  (all / due within 7 days / overdue), users (all / active / disabled / administrators),
  due soon (within N days) and the report (a month). Spare parts had a **checkbox** that
  could only ever say one thing, and maintenance and users had no filter at all. Every
  filter carries an `aria-label`, every one states its "everything" answer as selected,
  and the CSV download next to a list builds its query from the same function as the
  table — so the file is the list you are looking at, never a different one.
* **Every table sorts by any heading that holds a value.** Machines, work orders,
  history, one machine's history, spare parts, maintenance, due soon, users and the
  report all behave the same way: one click on a heading orders that column ascending,
  the same heading again turns it round, and an arrow in a fixed slot beside it says
  which way. Nothing is sorted until someone asks, the order survives a search, a filter
  change and a save, and a click redraws from the list already in memory — no request.
  Where the alphabet is the wrong order the column says so: priority runs high → low,
  status runs open → done, and a barcode sorts as a number rather than as digits.
* **Every row's actions are behind three dots.** Machines, work orders, spare parts,
  maintenance, due soon and users: one menu per row, the destructive item red, and the
  button names the row it belongs to for anyone using a screen reader. A table of twenty
  rows used to look like a toolbar.
* **The machine table's photograph column is not sortable, and that is the rule
  everywhere.** A heading is offered only where the column holds a value — there is no
  sensible order for a picture, and none for a three-dot menu. A blank cell goes last
  whichever way the sort runs, so sorting Barcode descending does not hand back a
  screenful of machines that have no barcode.
* **The machine list has four views, and opens on everything.** The filter in the Machines
  toolbar offers *All machines* (the default), *In service*, *Down right now* and *Retired*;
  the search box narrows whichever view is chosen. It opened on *In service* until
  261106-erb, which made a retired machine look like a machine that had been deleted — the
  one you are asking about is usually the one that stopped. `GET /api/equipment?service=`
  picks the stored state and `&status=down` adds the derived one; a view the select cannot
  name falls back to *All machines*, not to the old default.
* **A retired machine is out of the way, not out of sight.** It keeps its record, history and
  photographs; in the full list its row is dimmed and its badge says *Retired*, so it is
  findable and reopenable without competing with the machines that are running. It is never
  offered in the dropdowns that start new
  work (report a job, add maintenance). Its maintenance stops being a reminder too: parked schedules leave *Due soon*,
  the Maintenance screen and the dashboard card, and come back when the machine does. The API
  asks for this explicitly with `?service=active` (on the machine list, `/api/pm` and
  `/api/pm/due`); with no parameter each list is everything, as it always was.
* **New machine asks for everything Edit does.** Name, barcode, manufacturer, category,
  location, notes and a photograph, in one dialog: it asked for four fields until
  261106-erd while the editor asked for seven, so a machine could only be fully described
  by creating it and immediately editing it again — and `POST /api/equipment` had accepted
  the manufacturer and the notes all along. The photograph is uploaded straight after the
  machine is created, because the route needs an id; if it fails the machine is saved and
  the message says so. The suite compares the two dialogs by the labels they show, so a
  field added to one and not the other is a failure rather than a surprise.
* **A spare part is corrected in a dialog, like everything else.** Edit on its row opens
  the whole record — name, reference, supplier, stock, unit price and reorder level — and one
  Save writes all of it, so emptying the supplier or the price really empties it. It used to
  turn the row into five inputs, which left the *supplier* with no editor at all: the create
  form had asked for it since parts existed, and the one field you cannot correct is the one
  you notice. The row is a row again, with Edit and Delete on it.
* **A machine can be corrected — by an administrator.** Edit on its row opens what the
  record holds: name, barcode, manufacturer, model, serial number, category, location, notes and media.
  A technician sees History on every row but not Edit, Retire or Delete; the server refuses
  those requests too, so the hidden button is not the protection.
* **The latest explicit answer says whether the machine is running.** The report form
  defaults to the selected machine's currently recorded state, and the stage dialog has
  a red *Out of service* / green *Running* switch. A later report or update supersedes an
  older one, even on a different work order. Closing requires a fresh confirmation that
  the machine is running, which is saved as the newest state event. Saving an unrelated work-order edit does not create a new state report.
  Retirement is a separate administrative state and takes precedence. On upgrade, the
  previous displayed state is preserved as a migration baseline; the app cannot reconstruct
  missing pre-upgrade state history. A correction to a stage changes that stage's historical
  answer, not a newer report from another job.
* **Before work starts, editing a work order opens a dialog with the whole record on it.** Problem, assigned person,
  priority, who reported it, what was seen, whether it stops the machine, and the
  photograph — replace it or remove it. It used to be a row of inputs inside the table that
  could change four things and nothing else, with the answer to *does this stop the machine*
  squeezed into a cell. The dialog is filled from the row that was clicked rather than from a
  second request, and one Save writes everything. There is **one** *Assigned to* field: with the list
  of people it is a choice, without it the same control shows the one true answer, is disabled
  and says why — and the save leaves ownership out entirely, because sending nothing must
  never mean *unassign*. Once a stage exists, the original report and its fault photo are
  locked in the UI and API; add a stage to document further work instead. If all stages are
  permanently deleted, the report becomes editable again. Closing, reopening and correcting
  the latest stage still work.
* **A work order needs a problem, but assignment is optional at creation.** Select a
  person in *Assigned to* or leave it blank; either way it starts as open. Starting an
  unassigned job asks who should do it; starting any job requires a Stage 1 update.
  The start dialog shows the existing assignee, if any, and allows choosing a different
  person. People and updates load independently, with an explanation and Retry if either
  lookup fails. The server saves the first stage, assignment and status together and prevents clearing
  the assignee while a job is in progress. Existing unassigned in-progress jobs can be
  assigned during a stage update; they must be assigned if reopened and started again. Both administrators and
  technicians can use the limited names list.
  The machine picker loads independently of the assignee list, shows when no machines
  are in service, and offers Retry when its lookup fails or the list is empty.
* **A work order keeps its stage-by-stage time log.** Starting asks for a written
  Stage 1 update, time spent and optionally up to five photos or videos and one PDF or Word job report. An in-progress
  ticket can receive Stage 2, Stage 3 and so on, or be closed after any stage. Empty history,
  loading errors and a server needing restart are distinguished. Each stage keeps its author,
  timestamp in the workshop time zone, duration, photos, machine state and optional parts. Add as many parts as
  needed (up to 50 input lines); the actual unit cost starts with the catalog price and is
  editable. The parts table combines quantities for the same part and actual unit cost;
  different prices stay separate. On narrow screens, scroll the table sideways to reach
  all columns. Saving deducts stock and records costs atomically. In the update dialog, *Previous
  updates* opens the timeline, while *Spare parts* and *Photos* expand when needed; their
  summaries show selected items even when collapsed. The action bar and validation errors
  remain visible while the form scrolls. *View updates* opens an oldest-first timeline
  with the original report, fault photo, each stage, and the final closure. Thumbnails open
  a larger preview, and both existing and newly selected photos can be previewed during correction.
* **An admin can correct or delete only the latest stage.** Open *View updates*, then use the
  pencil beside the latest stage, including on a closed job. Correct its description, time, machine
  state, photos or parts, or confirm *Delete stage* to permanently remove it and its photos.
  Removed quantities return to stock and new quantities are deducted in one transaction;
  insufficient stock rejects the correction without partial changes. Older stages are not
  editable or deletable, and technicians cannot bypass this restriction through the API.
  Deleting the only stage of an in-progress job returns that job to open. Photo files are
  removed after the database commit; a storage failure is logged and the admin is warned to
  remove the named leftover files manually. Backups made before deletion are not affected.
* **Print or save a complete work order as a PDF.** In **Reports**, choose *Work order* and select the job. A fresh local print view includes the original report, machine details, closure,
  totals, all stages, actual-cost parts and fault/stage photos. The browser opens its print
  dialog; select a printer or *Save as PDF*. A missing photo is explicitly marked unavailable.
* **Hours and costs stay live, separately.** The work-order cost is its recorded
  parts costs only. Total service cost on a machine is the sum of its work-order costs,
  including open and closed jobs; there is no hourly rate or labour cost. Hours remain
  a separate service-time total. Stage corrections and deletions update both recorded
  parts costs and stock. Each job cost is rounded to cents before adding job totals.
  Historical reviewed hours remain preserved without double-counting. Existing part-use
  costs were captured at the catalog price on upgrade (zero if no price was recorded);
  later catalog price changes do not rewrite them. Missing or incompatible cost data is
  shown as unavailable rather than as zero; restart the server after updating. Copy the
  data/photos folder with the database when moving or backing up.
* **Every work order has a number.** `WO-2026-0001`, one series per year, given by the
  server when the ticket is created and never reused or renumbered: the id is for the
  database, the number is for the whiteboard, the phone call with the vendor and the printed
  sheet. It shows under the problem on the list, beside the job in History, at the top of the
  close dialog, and as its own column in both exports. Jobs that predate the column are
  numbered on upgrade, oldest first, per year.
* **A machine can have a photograph.** JPEG, PNG, WebP, MP4, MOV or WebM, stored as a file in
  `photos/` beside the database. The type is decided by the first bytes of the file, not by
  the name or the header the browser sent, and the filename is chosen by the server.
* **A fault report says what was seen, who saw it and what it looked like.** Notes, a
  free-text name and a photograph of the fault, all optional, alongside the machine,
  the problem and the priority. The photograph is bytes to `/api/work-orders/:id/photo`
  using the same streamed upload and sniffed-type rule as a machine's media; the
  difference is deliberate — **any signed-in person may attach or remove one**, because
  the technician who finds the fault is exactly who needs to photograph it. Deleting a
  machine still takes its jobs and their photographs with it.
* **Closing confirms the machine is running.** The close dialog uses the same red/green
  machine-status switch as stage updates, initialized from the latest state, and an optional closing note;
  the close button is disabled when out of service, with a reason on hover or keyboard focus; it does not ask for labour, parts or a checker.
  The server refuses closure without an explicit running confirmation, or for a retired
  machine. Closure records a fresh running state atomically. Reopening retains historical
  details and clears the closed date; a later close requires a new running confirmation.
  Historical resolution, verification and reviewed-hour records remain readable.
* **Work-order actions are ordered and labelled with icons.** View updates, Add update,
  any applicable editing action, and finally Close job. Printing is in Reports. Open jobs use Add update
  to start the first stage; closed jobs can be reopened.
* **Machine details are easier to understand.** The total service hours heading describes
  maintenance labour; the row action is Edit machine details. Remove an existing photo
  using the minus on its preview; undo is available before saving.

* **Last activity** on the Work orders table shows the latest surviving report,
  stage creation/correction or closure with date and time, and sorts in either direction.
  A job with no stages falls back to its report time.
* **Workshop time zone.** Open *Settings* in the top bar. Administrators can save an IANA
  time zone such as `Asia/Bahrain`; technicians can view it. UTC is the default for an
  existing installation. The setting is saved with the database and is used workshop-wide,
  including timeline and print timestamps, CSV exports, history date ranges, report months,
  dashboard trends and maintenance "today"/due calculations. Daylight saving is applied
  using the time-zone rules built into the local runtime, with no network request. Other
  sessions pick up changes when they next load data or navigate. Stored timestamps stay UTC;
  maintenance dates entered as calendar days are never shifted.
* **History** lists finished work, newest first, narrowable to a date range — "what did
  we close in October".
* **Reports** is the generation hub for a work-order printout, monthly completed work,
  an individual machine’s all-time service history, and current spare-parts inventory.
  Machine reports count every work order as one service event, show counts by status,
  service hours and recorded parts-only costs. Monthly reports count closed jobs in the
  selected month. Inventory value excludes items with no unit price. Machine and inventory
  filters apply to the on-screen report, its CSV and print/PDF. No sales or labour costs are
  inferred. Work-order reports are available for open and completed jobs.
* **The Dashboard draws two charts** — jobs closed per month and what each month cost,
  recorded parts only — for the last six months. They are drawn as SVG in the page: no
  charting library, no request to anything outside the machine.

### Worked example: add a "Serial number" field to machines

**1. `db.js` — add the column.**
Find the `equipment` table and add one line:

```sql
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  serial_number TEXT                      -- ← add this line
```

Existing databases won't get a new column from `CREATE TABLE IF NOT EXISTS`, so also add
one line below, next to the other `ensureColumn(...)` calls:

```js
ensureColumn('equipment', 'serial_number', 'TEXT');
```

**2. `server.js` — save and return it.**
In `'POST /api/equipment'`, add `serial_number` to the column list and one `?`:

```js
const r = run(`INSERT INTO equipment (name, asset_tag, category, location, status, notes, serial_number)
               VALUES (?,?,?,?,?,?,?)`,
  b.name.trim(), b.asset_tag || null, b.category || null, b.location || null,
  b.status || 'active', b.notes || null, b.serial_number || null);   // ← added
```

**3. `public/index.html` — add an input.**
In the "Add a machine" card, add one field:

```html
<input id="e-serial" placeholder="Serial number" />
```

**4. `public/app.js` — send it and show it.**

```js
// in addEquipment(), inside the body:
serial_number: $('#e-serial').value,

// in loadEquipment(), inside the row:
<td>${esc(e.serial_number || '—')}</td>
```

Also add a `<th>Serial</th>` to that table's header in `index.html` so the columns line up.

Restart the server. Done — four small edits, all in plain JavaScript.

---

### Worked example: add a new table (e.g. "sites")

**1. `db.js`** — after the other tables:

```sql
CREATE TABLE IF NOT EXISTS sites (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT
);
```

**2. `server.js`** — two entries in `api`:

```js
'GET /api/sites':  route(async (_req, res) => send(res, 200, all('SELECT * FROM sites ORDER BY name'))),
'POST /api/sites': route(async (req, res) => {
  const b = await readBody(req);
  if (!b?.name?.trim()) return send(res, 400, { error: 'Name is required' });
  const r = run('INSERT INTO sites (name, address) VALUES (?,?)', b.name.trim(), b.address || null);
  send(res, 201, get('SELECT * FROM sites WHERE id = ?', r.lastInsertRowid));
}),
```

**3. `public/index.html`** — copy any `<section data-page="...">` block and change its ids.

**4. `public/app.js`** — add `{ key: 'sites', label: 'Sites' }` to `PAGES`, a `loadSites()`
function, and `sites: loadSites` to the `loaders` object in `showPage`.

---

## How the database behaves (and why it is safe)

* SQLite in **WAL mode**: each save is committed to a small side file and committed atomically.
  A power cut cannot leave a half-written database the way it can when the whole file is
  rewritten on every request.
* **Nothing is written when you only view pages.** Opening a list does not touch the disk.
* **A photograph is a file, not a blob.** The row keeps a filename the server chose, the
  bytes live in `photos/`, and deleting the machine or replacing its picture deletes the
  old file. Uploads stream to disk without a 2 MB limit; monitor available disk space.
  Stage updates accept up to five photos/videos and one PDF, DOC or DOCX job report.
  Each spare-part catalog record supports up to 20 photos, videos or PDF/Word documents,
  including receipts. Open Edit part to add, view or remove them. Attachments are removed
  when the part is deleted; a part already used on a job cannot be deleted.
  Temporary uploads are private to the uploading user and expire after 24 hours.
* Every change is a real transaction. If a step fails, the earlier steps are undone — for
  example, using 99 of a part with only 3 in stock leaves the stock exactly as it was.
* `maintain.db` is your data, and `photos/` holds machine, fault, stage and spare-part media and documents beside it. Copy
  the folder to back up; delete it to start over.
  `secret.txt` is the per-install signing key — keep it, or everyone is logged out.
* **The side file is merged back after every save.** WAL mode normally leaves recent
  writes in `maintain.db-wal` until something closes the database, which meant a copy of
  `maintain.db` on its own could be an empty database — the owner's was 4 KB with 78 KB
  sitting beside it. Every write now checkpoints, so `maintain.db` alone is always a
  complete, copyable file. That is why the backup instructions below are safe.

### Where your data lives

Not inside the app folder any more.

* **Windows:** `%LOCALAPPDATA%\MachineMaintenance`
* **Linux / macOS:** `data/` inside this folder, as before
* Override either with `MM_DATA=/path/to/folder`, or `MM_DB=/path/to/file.db`
  (everything else is then kept beside that file).

The app prints the full path on startup. It used to keep everything in `data/` next to
`start.bat`, which is *inside the git working copy* — and `data/` is git-ignored, so one
`git clean -fdx` or a fresh clone deleted the database with no warning. On the owner's
machine that folder was also a Parallels shared folder, and **SQLite does not support WAL
over a network filesystem**. Both problems are gone now that the data lives outside the
app.

Upgrading from v2.0 needs nothing: on first start the app finds `data/maintain.db`, copies
it (with `-wal`, `-shm` and `secret.txt`) to the new location, and says so. The old folder
is left untouched.

The folder holds four things:

| | |
|---|---|
| `maintain.db` | every record |
| `secret.txt` | the signing key: keep it, or everyone is signed out |
| `backup-*.db` | snapshots taken by the Backup button |
| `photos/` | machine, fault, stage and spare-part media and documents, one file each |

That last one is why "copy the folder" is the instruction rather than "copy the database":
the Backup button snapshots `maintain.db`, and a photograph is a file beside it. Restoring
on the same machine is unaffected — the files are still there. Moving to another machine
means copying `photos/` too.

### Back up

* Button on the **Backup** tab (admins only), or
* `backup.bat`, or
* Windows Task Scheduler → daily → `backup.bat`.

Each run writes `backup-YYYY-MM-DD-HH-MM-SS.db` beside the database, a complete
standalone file.

Even so, the honest answer to "what is a backup?" is **a copy in a different place**.
A backup sitting in the same folder as the database is not one.

### Restore

Stop the server, replace `maintain.db` with a backup file, start the server.
(Delete `maintain.db-wal` and `maintain.db-shm` first if they exist.)

### If you lose the password

You cannot be locked out any more. Two ways back in, both run with the app stopped:

1. `first-password.txt` beside the database holds the password from the very first start.
   It is deleted as soon as you change that password in **Admins & Technicians**.
2. Otherwise, open a command prompt in this folder and run:

   ```
   node reset-password.js
   ```

   It prints a new password for `admin@local`, or takes `--password` to set one you
   choose, or `--email` for a different account. Nothing is deleted; open sessions are
   signed out.

---

## Copy it to another machine

1. Install Node.js 22+ once (from a USB stick on an offline machine).
2. Copy the whole folder, including `data/`.
3. Double-click `start.bat`.

There is nothing to compile and no `node_modules`. The only binary in the folder is
Node itself, which is installed on the machine, not in the repository.

---

## Run the tests

```bat
node --no-warnings=ExperimentalWarning scripts/smoke-test.js
```

It starts its own server on port 3999 with a throwaway database, checks 687 behaviours —
a `kill -9` restart, a lone copy of `maintain.db` opening with the data in it, search
composing with every filter, a month's costs adding up — then cleans up. You should see
`687 passed, 0 failed`.

Three of those checks are about the tests themselves, because a suite that stops asking is
the failure nobody notices:

* **every endpoint is named somewhere in the suite** — read from `routes/`, so a route added
  tomorrow and never exercised shows up as a failure rather than as silence;
* **every dialog has a heading and no button is blank**, which is what a screen reader is
  otherwise left to announce as "dialog, button";
* the two pure helpers every screen leans on — `parseDay()` and `likeParam()` — are asked
  directly, in a child process with its own database, because their edge cases (`2026-02-30`,
  a search for `100%`) never appear on a screen.

It runs on Windows and Linux and uses no shell commands — an earlier version relied on
`grep`, which broke on Windows. That bug is why this now scans files in plain JavaScript.

```bat
node --no-warnings=ExperimentalWarning scripts/audit-offline.js
```

This one proves the offline claim: it scans the shipped files for any external URL, starts
the server, loads every page asset and API endpoint, and checks there are no dependencies or
native modules. You should see `OFFLINE-SAFE`.

---

## Security notes (read once)

* Passwords are hashed with **scrypt** and a random salt — never stored in plain text.
* The signing key is generated on first run and stored in `data/secret.txt`. There is no
  secret in the source code, so a copy of this repository cannot be used to forge a login.
* The session lives in an **HttpOnly cookie**, so browser scripts cannot read it.
* Signing out removes the session on the server; an old cookie will not work again.
* There is **no public sign-up**. Accounts are created by an admin.
* **Editing a machine is admin-only**: its record, its photograph, retiring it and deleting
  it. A technician can add a machine and report a job on it — that is how a fault gets
  written down — but the routes refuse a `PUT` from anyone else, so hiding the button is a
  courtesy, not the protection.
* **Stage correction is admin-only and latest-only**, enforced by the server as well as the UI.
* **A machine's state is not typeable.** `PUT /api/equipment/:id` accepts `active` or
  `retired` and answers 400 to `down`, pointing at the work order instead.
* **An uploaded photograph is checked by its bytes.** JPEG/PNG/WebP is decided from the
  file's first bytes, not from its name or the `Content-Type` header, and the stored name is
  generated by the server.
* The server listens on `0.0.0.0:3000`, which means other PCs on the workshop network can
  reach it. If you only want this PC, change `HOST` to `'127.0.0.1'` in `server.js`.

### Known limitations

* No HTTPS. Fine on a trusted local network; do not expose it to the internet.
* No password reset by email (there is no email). Use `node reset-password.js` instead —
  see **If you lose the password** above.
* A restored backup signs everybody out, because sessions are rows in the database.
* **No complete audit log** — stage edits record the latest editor and edit time, but a
  comprehensive before-and-after history across all records is not provided.
* **Concurrent edits are generally last-write-wins.** The server rechecks the latest-stage
  restriction during the transaction, but there is no general edit-conflict resolution.

---

## Where this came from

Built as a lean replacement for `Ilop08/SIAI`, reviewed in
`../.planning/milestones/v1.0-CODE-REVIEW.md`. That project's code has been removed from
this repository — `app/` is the whole application now; the review and the old
repository (up to commit `4971ea3`) are where it came from.
Kept from that project: the scrypt password approach, the `ensureColumn` migration idea,
the colour palette. Replaced: `sql.js` (which rewrote the whole database on every request)
with `node:sqlite`; React/TypeScript with one HTML page; and the fake calendar that invented
maintenance dates with a real `pm_schedule` table.
