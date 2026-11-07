---
phase: "8"
slug: "work-belongs-to-somebody"
status: validated
nyquist_compliant: true
wave_0_complete: false
created: "2026-11-05"
---

# Phase 8 — Validation Strategy

| Property | Value |
|----------|-------|
| **Framework** | none — assertions in `starter/scripts/smoke-test.js` |
| **Quick run command** | `env PATH=/nonexistent node --no-warnings=ExperimentalWarning starter/scripts/smoke-test.js` |
| **Full suite command** | quick run + `node --no-warnings=ExperimentalWarning starter/scripts/audit-offline.js` |
| **Estimated runtime** | ~2 seconds |

## Sampling Rate

- **After every task commit:** quick run
- **After every plan wave:** full suite, including `OFFLINE-SAFE`
- **Max feedback latency:** 5 seconds

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | WO-01 | T-8-02 | Assigning an unknown user id is a 400, not an FK error | integration | quick run | ✅ | ✅ green |
| 08-01-02 | 01 | 1 | WO-02 | — | The list returns the owner's name; a disabled owner's name still renders | integration | quick run | ✅ | ✅ green |
| 08-01-03 | 01 | 1 | WO-01 | T-8-01 | `/api/users/assignable` exposes only id and name | integration | quick run | ✅ | ✅ green |
| 08-02-01 | 02 | 1 | WO-03 | T-8-03 | Title/notes/priority editable; empty title refused | integration | quick run | ✅ | ✅ green |
| 08-02-02 | 02 | 1 | WO-04 | T-8-03 | Technician can edit WOs but still 403 on users and machine delete | integration | quick run | ✅ | ✅ green |

## Wave 0 Requirements

Existing infrastructure covers all requirements. The phase-1 technician fixture is reused, and
extended rather than duplicated.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The owner dropdown is populated for a technician | WO-01 | Requires a browser and a technician session | Sign in as a technician, click Edit on a work order, confirm the Owner dropdown lists names |

## Nyquist Audit (2026-11-05)

| Requirement | Assertions | Status |
|---|---|---|
| WO-01 | assigned / reassigned / unassigned / unknown id 400 / no SQL leak | COVERED |
| WO-02 | owner name resolved; disabled owner still named | COVERED |
| WO-03 | title edited; status untouched; empty title 400; notes-only preserves title | COVERED |
| WO-04 | technician edit 200; cannot create users; cannot delete machines; cannot read staff list | COVERED |

Plus the leak-specific guards: assignable route reachable, key shape exactly `id,name`, no `@`
anywhere in the payload.

Gaps found: 0. Resolved: 0. Escalated to manual-only: 1 (dropdown rendering in a browser).

---

## Validation Sign-Off

- [x] All tasks have automated verification
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-11-05

## Validation Audit 2026-11-05

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 1 |
