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
| `server.js` | Starts up, decides which route a request is, serves the one page | 116 |
| `routes/` | **One file per screen group** — see below | 40–135 each |
| `http.js` | `send`, `readBody`, `route()` — how a request becomes an answer | 106 |
| `values.js` | Turns what a browser sends into what the database may store | 85 |
| `who.js` | Who is asking: the session cookie, the user behind it | 26 |
| `db.js` | Database connection, tables, migrations, checkpointing, backup | 363 |
| `filters.js` | Every WHERE clause: search and filters, shared with the exports | 139 |
| `report.js` | One month of work, added up | 97 |
| `trend.js` | The last six months, for the dashboard charts | 47 |
| `auth.js` | Password hashing, login tokens, password generation | 56 |
| `status.js` | What state a machine is in, from the work orders that say they stop it; also what "in service" means to a query | 90 |
| `codes.js` | Work order numbers: one series per year, `WO-2026-0001` | 24 |
| `photos.js` | Photographs — of a machine or of a fault: type sniffed from the bytes, size capped | 71 |
| `reset-password.js` | The way back in when a password is forgotten | 58 |
| `sessions.js` | Sign-ins as rows, so a restart keeps you signed in | 46 |
| `login-log.js` | Records failed sign-ins without blocking anyone | 51 |
| `settings.js` / `dates.js` | The hourly rate; date parsing | 24 each |
| `public/index.html` | The whole UI shell: every screen and form | 543 |
| `public/app.css` | The whole stylesheet — was a `<style>` block until the page reached 600 lines | 288 |
| `public/app.js` | Fetches data and draws the screens that are small enough to keep here | 475 |
| `public/shell.js` · `dashboard.js` · `history.js` · `report.js` · `charts.js` · `machines.js` · `work.js` | One module per screen group; `charts.js` draws the bars, `work.js` holds the fault list and its close dialog | 121 · 136 · 148 · 79 · 101 · 358 · 241 |
| `public/sort.js` | The ordering rule for a table — numbers written as text, blanks last, ties kept — kept apart so the suite can run it on rows instead of reading it | 50 |
| `scripts/smoke-test.js` | Starts a throwaway server and checks 504 behaviours | 2,822 |
| `scripts/audit-offline.js` | Proves nothing reaches the internet | 151 |
| `start.bat` / `backup.bat` | Windows launchers | — |

The route files, one per screen group:

| File | Routes | Lines |
|---|---|---|
| `routes/auth.js` | login, logout, me | 52 |
| `routes/record.js` | history, history.csv | 45 |
| `routes/equipment.js` | machines: list, create, edit, retire, delete, photograph | 124 |
| `routes/work-orders.js` | work orders, numbers, the photo of the fault, the close rule, work-orders.csv | 176 |
| `routes/parts.js` | spare parts, stock on a job, parts.csv | 135 |
| `routes/pm.js` | recurring maintenance | 77 |
| `routes/dashboard.js` | the landing screen's four answers and its six-month trend | 76 |
| `routes/admin.js` | users, assignable people, backup | 81 |
| `routes/report.js` | the hourly rate, the month, report.csv | 56 |

Total application code: **about 3,970 lines**, and about 1,920 of tests. No file is past the
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
`Spare parts` · `Users` (admins) · `Backup` (admins)

`Users` has no public sign-up counterpart: accounts exist only if an admin creates them.

* **Every list has a search box** that works with the filters beside it, and the CSV
  download next to it produces exactly the rows on screen.
* **Everything about one machine sits behind three dots** at the end of its row —
  edit, history, retire and delete — instead of four buttons repeated on every row.
* **Deleting is a dialog, not a `confirm()`.** It counts what will go ("3 work orders and 1
  maintenance task"), says the history and the photograph go too, and the button stays
  disabled until the sentence *delete machine &lt;name&gt;* is typed; the same check runs again
  before the request is sent. The server cascades: deleting a machine really does delete its
  work orders, their parts, its maintenance schedules and its photograph.
* **The machine table shows what a machine is**: a photograph, its name, barcode,
  manufacturer, category, location and state — one column each, in that order. The empty
  table spans exactly the columns its header names, and the suite checks that rather than
  trusting anyone to count.
* **The machine table sorts by any heading that holds a value.** Name, Barcode,
  Manufacturer, Category, Location and Status are buttons: one click orders that column
  ascending, the same heading again turns it round, and a small arrow beside the heading
  says which way it is. The Photograph column and the three-dots column are not sortable —
  there is no sensible order for a picture. Nothing is sorted until someone asks, and the
  order they ask for survives a search, a filter change and a save. Clicking redraws from
  the list already in memory, so it costs no request; a barcode sorts as a number
  (`9`, `10`, `101220054`), a machine with nothing in the column goes last whichever way
  it is sorted, and two machines with the same value keep the order they arrived in.
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
* **A machine can be corrected — by an administrator.** Edit on its row opens what the
  record holds: name, barcode, manufacturer, category, location, notes and a photograph.
  A technician sees History on every row but not Edit, Retire or Delete; the server refuses
  those requests too, so the hidden button is not the protection.
* **The ticket says whether the machine stops.** Nobody types *down* on the machine, and
  nobody has to guess from a priority either: the report form asks *Does this stop the
  machine?* — *No, it is still running* by default, *Yes, take it out of service* — and that
  answer, on an unfinished job, is the whole rule. A high-priority fault on a machine that is
  still making parts leaves it running; a job somebody is working on does not take it out of
  service by itself; the answer can be changed again without closing the job. Until
  261106-ere priority and status decided, so reporting a fault could take a running machine
  out of service without anybody choosing to. The stored column still says only *active* or
  *retired*; `status.js` derives the rest and the list names the job — by its number — that
  is holding the machine down.
* **Editing a work order opens a dialog with the whole record on it.** Problem, owner,
  priority, hours, who reported it, what was seen, whether it stops the machine, and the
  photograph — replace it or remove it. It used to be a row of inputs inside the table that
  could change four things and nothing else, with the answer to *does this stop the machine*
  squeezed into a cell. The dialog is filled from the row that was clicked rather than from a
  second request, and one Save writes everything. There is **one** *Assigned to* field: with the list
  of people it is a choice, without it the same control shows the one true answer, is disabled
  and says why — and the save leaves ownership out entirely, because sending nothing must
  never mean *unassign*.
* **Every work order has a number.** `WO-2026-0001`, one series per year, given by the
  server when the ticket is created and never reused or renumbered: the id is for the
  database, the number is for the whiteboard, the phone call with the vendor and the printed
  sheet. It shows under the problem on the list, beside the job in History, at the top of the
  close dialog, and as its own column in both exports. Jobs that predate the column are
  numbered on upgrade, oldest first, per year.
* **A machine can have a photograph.** JPEG, PNG or WebP up to 2 MB, stored as a file in
  `photos/` beside the database. The type is decided by the first bytes of the file, not by
  the name or the header the browser sent, and the filename is chosen by the server.
* **A fault report says what was seen, who saw it and what it looked like.** Notes, a
  free-text name and a photograph of the fault, all optional, alongside the machine,
  the problem and the priority. The photograph is bytes to `/api/work-orders/:id/photo`
  under the same 2 MB cap and the same sniffed-type rule as a machine's photograph; the
  difference is deliberate — **any signed-in person may attach or remove one**, because
  the technician who finds the fault is exactly who needs to photograph it. Deleting a
  machine still takes its jobs and their photographs with it.
* **Closing a job is where the history is written.** The step that used to be one click
  opens a dialog that asks what was done, the hours, who checked it and which parts were
  used; the server refuses a job that is *being* closed without an account of the repair
  (`400 Say what was done before closing the job`). A change to a job that is already
  closed does not ask again, and a job reopened because the fix did not hold must be closed
  with a new account rather than inheriting the story of the repair that failed.
  Reopening keeps what was done and clears the closed date. Parts added in that dialog
  move stock immediately and are listed on the job; the History screen shows what was done
  under the job title, and the history file has it as its own column.
* **A machine has a history.** The History button on its row opens every job ever
  reported against it, open ones included.
* **History** lists finished work, newest first, narrowable to a date range — "what did
  we close in October".
* **Report** adds a month up: jobs closed, hours, parts cost, labour cost and total, plus
  the machines that took the most work. The hourly rate that turns hours into money is a
  field on that screen, not a number in the source.
* **The Dashboard draws two charts** — jobs closed per month and what each month cost,
  parts under labour — for the last six months. They are drawn as SVG in the page: no
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
  old file. A 2 MB cap is applied while reading, so a wrong pick cannot fill the disk.
* Every change is a real transaction. If a step fails, the earlier steps are undone — for
  example, using 99 of a part with only 3 in stock leaves the stock exactly as it was.
* `maintain.db` is your data, and `photos/` holds the machine photographs beside it. Copy
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
| `photos/` | machine photographs, one file each |

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
   It is deleted as soon as you change that password in **Users**.
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

It starts its own server on port 3999 with a throwaway database, checks 504 behaviours —
a `kill -9` restart, a lone copy of `maintain.db` opening with the data in it, search
composing with every filter, a month's costs adding up — then cleans up. You should see
`504 passed, 0 failed`.

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
* **No audit log** — who changed what is not recorded. Deliberately out of scope so far;
  it is the strongest candidate for the next milestone.
* **Concurrent edits are last-write-wins** — one process, never tested with two browsers.

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
