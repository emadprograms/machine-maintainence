---
phase: "8"
slug: "work-belongs-to-somebody"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-11-05"
---

# Phase 8 — Security

> Audited inline (no `gsd-security-auditor` agent installed); each threat probed against a
> running server.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Technician → staff directory | Two user-reading routes now exist with different exposure | Names (narrow route) vs emails and roles (admin route) |
| Browser → API | Session cookie; assignment writes from any signed-in user | Work-order ownership, titles |
| API → SQLite | Bound parameters | Ownership state |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-8-01 | Information disclosure — the narrowed users route reopens bug #11 | `GET /api/users/assignable` | high | mitigate | Payload is exactly `SELECT id, name`; asserted three ways (key shape, no `@`, full route still 403). **Probed live:** technician received `[{"id":1,"name":"Admin"},{"id":2,"name":"Sam T"}]` and 403 from `/api/users`. | closed |
| T-8-02 | Tampering — assigning an arbitrary user id | `POST`/`PATCH /api/work-orders` | medium | mitigate | `assigneeValue()` validates against `users` before the write; non-integers and unknown ids both refused. | closed |
| T-8-03 | Elevation — using the work-order PATCH to reach admin-only fields | `PATCH /api/work-orders/:id` | medium | mitigate | Enumerated fields only (`title`, `status`, `priority`, `notes`, `assigned_to`); role/`active` are not on the list. | closed |
| T-8-04 | Repudiation — no record of who edited a work order | `PATCH /api/work-orders/:id` | low | accept | Attribution records the *owner*, not every editor. A full edit audit is deferred with reasons in REQUIREMENTS.md. | closed — accepted |
| T-8-05 | Tampering (stored XSS) | owner names rendered in the list | medium | mitigate | `esc()` on `assignee_name` in the row template; the select renders ids as values and escaped names as text. | closed |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-8-01 | T-8-04 | Any technician may edit any work order, and the record shows who owns it rather than who last touched it. Role restrictions here protect accounts and machine records; shared work is the product. A per-edit audit log is explicitly deferred. | milestone owner (autonomous run) | 2026-11-05 |
| AR-8-02 | — | `assigned_to` carries no database-level foreign key (SQLite cannot add one via `ALTER TABLE`). Integrity rests on application validation plus the fact that users are disabled, never deleted. Revisit if a delete-user path is ever added. | milestone owner (autonomous run) | 2026-11-05 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-05 | 5 | 5 | 0 | autonomous executor (inline audit) |

---

## Sign-Off

- [x] All threats have a disposition
- [x] Accepted risks documented
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-05
