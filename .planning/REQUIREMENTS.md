# Requirements — Lean Machine Maintenance

Scoped for **milestone v1.0**. Each requirement is testable by a human on a Windows machine with no internet.

## Functional

| ID | Requirement | Success check |
|---|---|---|
| REQ-01 | SQLite persistence, WAL mode, single file | Create a work order, kill the server with Task Manager, restart, record still present; database file size does not grow when only viewing pages |
| REQ-02 | Login with scrypt-hashed passwords; per-install secret; logout revokes | Restart app → old cookie rejected; forged cookie signed with any other secret rejected; sign out then reload → logged out |
| REQ-03 | Admin-only user creation | There is no public sign-up form or endpoint |
| REQ-04 | Machine CRUD | Add machine, edit its location, mark retired, see it in the list |
| REQ-05 | Work orders on a machine | Create against a machine; invalid machine id is rejected with an error message, not a 500 |
| REQ-06 | Spare parts + stock change on use | Use 2 of a part with stock 5 → stock becomes 3; the change and the link happen together or not at all |
| REQ-07 | Recurring PM with due dates | Add "oil change every 30 days"; appears in Due Soon inside the window; Mark done moves next due forward exactly `interval_days` |
| REQ-10 | Backup | Backup button writes `data/backup-YYYY-MM-DD-HH-MM-SS.db` that opens as a valid database |
| REQ-11 | Modification guide | `starter/README.md` explains, with a worked example, how to add a field and a table |

## Non-functional

| ID | Requirement | Success check |
|---|---|---|
| REQ-08 | Fully offline | Browser Network tab shows zero requests to any host other than the local server; `grep -r "https\?://" starter/` finds no runtime fetch, font, CDN or API URL |
| REQ-09 | Portable on Windows | Copy the folder to a clean Windows box with Node installed, double-click `start.bat`, browser opens at `http://localhost:3000`, login works |
| — | Size | `wc -l` over `starter/**/*.{js,html}` ≤ ~1,200 |
| — | No native modules | `package.json` has no dependencies; no `.node` files |

## Out of scope (do not build)

Camera scanning, AI diagnosis, chatbot, Kanban board, multi-company tenancy, React/TypeScript, PWA/service worker, email or push notifications, LDAP/AD integration.

## Traceability

| Phase | Requirements |
|---|---|
| 1 — Foundation & persistence | REQ-01, REQ-10, REQ-11 (first pass) |
| 2 — Auth & users | REQ-02, REQ-03 |
| 3 — Machines & work orders | REQ-04, REQ-05 |
| 4 — Spare parts | REQ-06 |
| 5 — Preventive maintenance | REQ-07 |
| 6 — Windows portability & offline proof | REQ-08, REQ-09, REQ-11 (final) |
