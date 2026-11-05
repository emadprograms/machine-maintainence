---
phase: "7"
slug: "parts-become-maintainable"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-11-05"
---

# Phase 7 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Audited inline (no `gsd-security-auditor` agent is installed in this environment); every
> threat below was probed against a running server, not assessed by reading code alone.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser → HTTP API | Session cookie is the only credential; every route requires it except login | Part records, stock counts, cookie |
| API → SQLite | Bound parameters only; `node:sqlite` in-process | All persistent state |
| Technician → Admin surface | Role checked per route; parts are technician-writable, users and machine deletion are not | Role claims in the signed token |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-7-01 | Tampering (mass assignment) | `PUT /api/parts/:id` | medium | mitigate | Field list enumerated; `id` only from the URL. **Probed:** `{"id":999}` left id 1, applied qty. | closed |
| T-7-02 | Injection | all part writes | high | mitigate | Bound parameters throughout. **Probed:** name `x'); DROP TABLE parts; --` stored as literal text and `parts` survived with its row. | closed |
| T-7-03 | Elevation of privilege (destructive) | `DELETE /api/parts/:id` | medium | mitigate | In-use guard refuses deletion once a job consumed the part; `ON DELETE RESTRICT` remains as backstop. | closed |
| T-7-04 | Denial of service (resource) | `stockValue()` bounds | low | mitigate | Rejects values above 1,000,000. **Probed:** 99999999999 → 400. | closed |
| T-7-05 | Information disclosure | error responses | medium | mitigate | No SQL text, no stack, no `TypeError` text. The malformed-JSON leak found in review is fixed centrally in `readBody`; asserted. | closed |
| T-7-06 | Tampering (stored XSS) | part names rendered in the table | medium | mitigate | `esc()` on every rendered field. The one raw interpolation (inline `onclick`) was replaced with an id lookup. | closed |
| T-7-07 | Denial of service (oversize body) | `readBody` 1 MB cap | low | accept | Over-cap requests call `req.destroy()`: the connection resets and nothing is written, but the client gets a dropped socket instead of a 413. Pre-existing v1.0 behaviour. **Probed:** server healthy afterwards (GET 200, POST 201). Accepted — a workshop LAN client is not adversarial, and a clean 413 is a v1.2 nicety. | closed — accepted |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-7-01 | T-7-07 | Oversize bodies reset the connection instead of returning 413. No data is written and the server stays healthy; the only cost is a confusing error in a hand-rolled client. | milestone owner (autonomous run) | 2026-11-05 |
| AR-7-02 | — | Parts are writable by technicians, including delete. Unlike machine deletion there is no cascade, and the in-use guard protects history. The business rule is "the person who restocked it should be able to correct it". | milestone owner (autonomous run) | 2026-11-05 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-05 | 7 | 7 | 0 | autonomous executor (inline audit; no auditor agent installed) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-05
