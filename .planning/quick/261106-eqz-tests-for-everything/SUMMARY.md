---
quick_id: 261106-eqz
slug: tests-for-everything
date: 2026-11-06
status: complete
commit: 3bc3fd5
files_modified: [app/scripts/smoke-test.js, app/README.md, README.md, .planning/PROJECT.md, .planning/STATE.md]
---

# Quick task 261106-eqz — adequate tests for everything

**Asked for:** "make adequate tests for everything."

Nothing in the application changed. The suite went from **372 to 401 checks** and, more to
the point, from *"the things somebody thought of"* to *"the things somebody thought of, plus a
floor that notices what nobody thought of"*.

## What the audit found

The 37 endpoints in `routes/` were compared against every path string in the suite. Two had
**never been called at all**:

| Endpoint | Why it mattered |
|---|---|
| `POST /api/logout` | session revocation — the one security property of signing out |
| `GET /api/export/history.csv` | the History screen's download, content type, file name and filter |

And three classes of defect that no endpoint test can see:

* a `<dialog>` with no heading (announced as "dialog", nothing else),
* a `<button>` with no text or label (announced as "button"),
* an endpoint added tomorrow that the suite never names.

## What was added

**Signing out.** Two browsers for one person: both work, one signs out, the other stays signed
in, both end up out. Then the property that actually matters — a **copy of the cookie taken
before signing out** is replayed against `/api/me` and must be refused. The cookie header is
checked too (`sid=; Max-Age=0`), because a browser that keeps sending a dead cookie pays for a
lookup that can never succeed.

**The history export.** Answers, is `text/csv` with `history.csv` in the disposition, starts
with the BOM and the column names, carries the closed job it was asked for, carries *nothing
else* when filtered by machine, and refuses an anonymous request.

**LIKE escaping, behaviourally and directly.** A search for `100%` finds the job whose title
contains a literal percent and not the job that merely contains `100`. Then `likeParam()` is
asked directly about `%`, `_`, a backslash and surrounding spaces.

**Date parsing, directly.** `2026-02-30` and `2026-13-01` are refused as "not a real calendar
date", `2026-1-01` and `yesterday` as "must be written as YYYY-MM-DD", a leap day in a leap
year is accepted, and `nowStamp()` has the shape SQLite sorts.

Both of those run in a **child process with its own database**: importing `filters.js` pulls in
`db.js`, which must not open the database the server under test is using.

**Three meta-checks**, reading the source: every route in `routes/` is named somewhere in the
suite (a floor, not a proof — the comment says so); every dialog has an `<h3>`; no button is a
blank rectangle.

## A bug in the suite, found by appending to it

The first version of the new block used the suite's shared client and every call came back
**401**. The reason: an earlier restart rotates the signing key, so the client that the rest of
the file uses is dead by the end. A test appended there would fail for a reason that looks like
a product bug, or — worse, with a `some(...)` style assertion — pass because the empty answer
satisfied it. The block now signs in for itself and asserts that it can.

## Mutation proofs

Eleven mutations, **eleven caught** — after one survived.

| Mutation | Caught by |
|---|---|
| signing out stops revoking the session | *a copy of the cookie taken before signing out no longer works* |
| signing out kills every session the person has | *while the other browser is still signed in* (+4) |
| the cookie is not dropped | *signing out tells the browser to drop the cookie* |
| the history file ignores the machine filter | *filtered by machine, it carries nothing else* |
| the file is called something else | *with a file name and a spreadsheet type* |
| LIKE stops escaping the wildcards | *a search for "100%" finds the literal percent* (+2, one of them older) |
| LIKE stops trimming | *and trims what was typed before wrapping it* |
| an impossible date rolls into the next month | *a date that does not exist is refused* (+5 older) |
| an untested endpoint appears | *every endpoint is exercised somewhere in this suite* |
| a dialog loses its heading | *every dialog names itself with a heading* |
| a button loses its label | *no button is a blank rectangle* |

**The one that survived first:** removing `revokeSession()` from the logout route passed the
whole suite. My logout test asserted that the *client* could no longer reach `/api/me` — which
is true the moment the server tells the browser to forget its cookie, whether or not the
session row was deleted. A stolen cookie would still have worked. The check is now the
captured-cookie replay, which fails with the mutation and with nothing else.

## What is still not tested anywhere, and cannot be here

Named so the gap is a decision rather than an oversight:

* **Anything that needs a browser**: layout, the row menu's placement, the disabled delete
  button, a dialog opening on top of a scrolled table. The source is read; nobody has clicked.
* **Two people editing at once** (last write wins, by design).
* **Windows**: the `.bat` launchers need `cmd.exe`; the suite is CRLF-pinned where it matters.
* **A real spreadsheet opening the exports**: the bytes are asserted (BOM, CRLF, quoting,
  formula prefix), not Excel.
