---
quick_id: 261106-erq
slug: admins-and-technicians
date: 2026-11-07
status: complete
kind: quick
commit: 6673448
files_modified: [app/public/index.html, app/public/app.js, app/routes/admin.js, app/scripts/smoke-test.js, app/README.md, README.md, .planning/PROJECT.md, .planning/STATE.md]
---

# 261106-erq — "Users" is now "Admins & Technicians"

**Asked for:** "I want to change the name 'user' to 'Admins & Technicians'."

## Inventory — where the word actually was

| # | Site | Kind | Changed |
|---|---|---|---|
| 1 | Sidebar entry (`PAGES`) | label | → `Admins & Technicians` |
| 2 | Page `<h2>` | heading | → `Admins &amp; Technicians` |
| 3 | "New user" button | action | → `New account` |
| 4 | Dialog title "New user" | heading | → `New account` |
| 5 | "Create user" submit | action | → `Create account` |
| 6 | Empty state "…with \"New user\"" | sentence | → `…with "New account"` |
| 7 | HTML comment | prose | updated |
| 8 | `404 { error: 'User not found' }` | a sentence a person reads | → `That account no longer exists` |

**Not changed, on purpose:** the `users` table, the `/api/users` routes, the `role` values
`admin` / `tech`, the `#users-rows` / `#user-filter` ids, and `loadUsers` / `drawUsers`. A
rename of what a word *looks like* must not rename what other code, exports and tests depend
on — the same line drawn when "Owner" became "Assigned to" (261106-erh). One check holds it:
the route is still `'GET /api/users'`.

## The naming, decided out loud

The section holds two roles, so it is named for both: **Admins & Technicians**. The word for
one row of it was *not* replaced with that phrase — "New Admins & Technicians" is not a
sentence. The screen already used **account** in its filter ("All accounts") and in its dialog
("only an admin can create an account"), so creating one now says *account* everywhere:

* button `New account` · dialog `New account` · submit `Create account` · filter `All accounts`.

That is the only word the three places agree on, and it is the word the record actually is.

## Checks — 531 → 536

* **the menu and the page heading give the section the same name** — compared to each other,
  not to a literal per site, so they cannot drift;
* **nothing on that screen still calls the people users** — no `>Users<`, no "New user", no
  "Create user", in the page or in the script;
* **creating one is called an account, like the filter that lists them** — button, dialog
  title, submit and filter together;
* **the endpoint underneath keeps its name** — `/api/users` still routed and still called;
* **a missing account is reported as a sentence, not as "User not found"** — a real `PUT` to
  a stale id, asserting the 404 and that its message says no "user".

## Mutations — 7, all caught

menu left as *Users* · heading left as *Users* · heading drifted to *Admins and Technicians*
(an ampersand is not an "and") · dialog left as *New user* · filter saying *All users* · the
404 reverted · **the API renamed along with the label** — that last one did not merely fail a
check, it crashed the suite at the first route that uses it, which is the right size of
failure.

## Not verified

Nobody has looked at the sidebar with the longer label. `#sidebar` is 232px wide and the
labels are 13px; "Admins & Technicians" is about 150px, so it should fit, but a narrower
window or a larger default font size is where it would wrap — the rail collapses (⌘B) and
that is the fallback.
