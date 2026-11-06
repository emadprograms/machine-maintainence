# Code review — 2026-11-06 (v3.0 shipped, after the server split)

**Scope:** the whole of `app/` — 3,150 lines of application code, 1,370 of tests.
**Method:** read every server file and the client modules; probed the running server for
each suspicion before writing it down; every claim below is tagged **[read]** or **[ran]**.
Nothing here is inferred from a file name.

**Result:** one high finding, fixed with two assertions and two mutations. Two minor
defects fixed the same way. Four observations recorded rather than changed.

---

## Fixed during this review

### 1. Disabling a user did nothing to their open session — HIGH

`sessions.js` proved the sign-in, but `currentUser` then trusted the token's own copy of
who the user was: `{ sub, role, name }`, valid for twelve hours. So:

* **Disabling an account ended only the next sign-in.** The session already open kept
  working. **[ran]** Signed in as a technician, had the admin disable them, and the
  technician continued to receive `200` from `GET /api/work-orders`.
* **A demoted admin kept the admin screens** until the cookie expired — including
  `PUT /api/settings` and `POST /api/backup`.

The suite's own comment said *"Disabling takes effect immediately on the next request AND
next login."* Only the login half was ever asserted. Worse, the disabled technician's dead
client was reused 700 lines later in the phase-16 block, where it was passing an assertion
about **roles** while actually being an **authentication** failure — a 401 read as a 403.

**Fix:** `who.js` re-reads `id, name, role, active` from `users` on every request and
refuses an inactive row. One extra indexed lookup, and identity can no longer be stale.

| Assertion added | Mutation that must fail it |
|---|---|
| `a disabled user loses the session they already had` | drop `!row.active` → **fails** |
| `a demoted admin loses the admin screens without signing in again` | return the token's role → **fails** |
| `a second admin can read the user list` (control) | — |

### 2. Two backups in the same second returned SQLite's error — LOW

`backup()` stamped the file to the second (`backup-2026-11-06-11-47-21.db`) and used
`VACUUM INTO`, which refuses an existing file. **[ran]** Two clicks in one second:
`400 {"error":"output file already exists"}` — the database's sentence, shown to a person.

**Fix:** the stamp now carries milliseconds. Assertion: *a second backup in the same second
is a second file, not an error*; restoring the seconds-only stamp fails it.

### 3. A role had two spellings — LOW

`POST /api/users` normalised `technician` → `tech`; `PUT /api/users/:id` stored whatever it
was given. A row could therefore say `technician` and behave as a technician while looking
like a third kind of user. **[ran]** Confirmed: the `CHECK` constraint rejected the write,
so the API answered `400` for something it should simply have normalised.

**Fix:** both routes now normalise through the same expression. Assertion: *a role is
stored in one spelling only*.

---

## Recorded, not changed

These are judgements, not oversights. Each is deliberate and the reason matters more than
the finding.

**No rate limiting or lockout on sign-in.** *Deliberate, at the owner's request (v1.1
reversal):* failures are logged to `login-failures.log` and the attempt is never refused.
Anyone reviewing this app will flag it; the answer is in `.planning/PROJECT.md`. Do not
"fix" it without asking.

**Unexpected errors return the raw message** — `send(res, 400, { error: raw })`. On a
single-machine offline app, a visible error is worth more than a tidy one; the owner reads
these. It would be wrong on a public service, where it leaks SQL detail.

**No security headers** (`X-Content-Type-Options`, `Content-Security-Policy`). The app is
served over a workshop LAN with no external content and no user-supplied HTML. `nosniff`
would be a one-line improvement if the app is ever exposed further.

**`GET /api/users/assignable` lists inactive users**, so a job can be assigned to someone
who has left. Rendering such an owner is a requirement (WO-02: a departed technician must
not vanish from their own history); *assigning new work* to one is a gap the UI could close
by filtering the select. Not changed — it needs a product decision, not a patch.

---

## What this review could not check

* **Any screen in a real browser.** No browser exists in the build environment. This is not
  a footnote: today's reported bug — History and Report rendering a blank icon because
  `ICONS` had eight entries for ten screens — was invisible to an API-only suite. A
  jsdom pass that renders each screen and asserts the sidebar has ten non-empty `<svg>`
  elements would have caught it and would catch the next one. **Recommended next.**
* **Windows.** The persistence fix of v2.1 and everything since has never run there;
  `LOCAL-AGENT-VERIFY-PROMPT.md` is the pending check.
* **Concurrency.** Single process, one writer, never two browsers.

## Ratings

| Area | Verdict |
|---|---|
| Authentication & sessions | Good — scrypt, hashed tokens in the database, `HttpOnly` + `SameSite=Strict`, revocation on logout, identity re-checked per request (today) |
| Authorization | Good — one wrapper enforces it for 32 of 34 routes; the two public ones are login and logout |
| Injection | Good — bound parameters everywhere; LIKE wildcards escaped; CSV formula injection defused |
| XSS | Good — every interpolation into `innerHTML` passes through `esc()`/`badge()`/`soft()`; spot-checked all `${…}` sites in `public/*.js` |
| Data safety | Strong — WAL with per-write checkpointing, `kill -9` tested, backups taken by SQLite, first-password note deleted when superseded |
| Readability | Good again — largest file 585 lines, largest server file 296, route modules 40–135; the ~600-line rule is now asserted rather than remembered |
