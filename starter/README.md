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
| `server.js` | Web server, login, and every API route in one table | ~361 |
| `db.js` | Database connection, table definitions, migrations, backup | ~137 |
| `auth.js` | Password hashing and login tokens | ~48 |
| `public/index.html` | The whole UI shell (tabs and forms) | ~216 |
| `public/app.js` | Fetches data and draws the tables | ~269 |
| `scripts/smoke-test.js` | Starts a throwaway server and checks 47 behaviours | 240 |
| `scripts/audit-offline.js` | Proves nothing reaches the internet | 142 |
| `start.bat` / `backup.bat` | Windows launchers | — |

Total application code: **about 1,040 lines.** You can read all of it.

---

## How to change things

Everything follows the same three-step shape. Find the three files below and you can
change anything.

### `db.js` — what is stored
Table definitions, in order, from top to bottom. Each is a `CREATE TABLE IF NOT EXISTS`.

### `server.js` — the API
One object, `const api = { ... }`, keyed by `'METHOD /path'`. Each entry is one function.
`req.user` is already filled in by the time your code runs — you don't write auth checks.

### `public/app.js` — the screen
One function per page (`loadEquipment`, `loadWork`, ...) that calls `api('/equipment')`
and writes HTML into a table.

---

### The tabs

`Due soon` · `Machines` · `Work orders` · `Maintenance` · `Spare parts` · `Users` (admins) · `Backup` (admins)

`Users` has no public sign-up counterpart: accounts exist only if an admin creates them.

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
* Every change is a real transaction. If a step fails, the earlier steps are undone — for
  example, using 99 of a part with only 3 in stock leaves the stock exactly as it was.
* `maintain.db` is your data. Copy it to back up; delete it to start over.
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

It starts its own server on port 3999 with a throwaway database, checks 47 behaviours
including a `kill -9` restart, then cleans up. You should see `47 passed, 0 failed`.

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
* The server listens on `0.0.0.0:3000`, which means other PCs on the workshop network can
  reach it. If you only want this PC, change `HOST` to `'127.0.0.1'` in `server.js`.

### Known limitations

* No HTTPS. Fine on a trusted local network; do not expose it to the internet.
* No password reset by email (there is no email). Use `node reset-password.js` instead —
  see **If you lose the password** above.
* A restored backup signs everybody out, because sessions are rows in the database.
* No audit log. The reviewed repo had one; it is intentionally out of scope.

---

## Where this came from

Built as a lean replacement for `Ilop08/SIAI`, reviewed in `../CODE_REVIEW.md`.
Kept from that project: the scrypt password approach, the `ensureColumn` migration idea,
the colour palette. Replaced: `sql.js` (which rewrote the whole database on every request)
with `node:sqlite`; React/TypeScript with one HTML page; and the fake calendar that invented
maintenance dates with a real `pm_schedule` table.
