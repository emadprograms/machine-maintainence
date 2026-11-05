---
phase: "11"
slug: "the-shell"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-11-05"
---

# Phase 11 — Security

> Audited inline (no `gsd-security-auditor` installed); DOM probes against the real
> module plus source assertions. Gate: ASVS L1, block on `high`.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Role → navigation | The sidebar decides what to *show*; the server decides what is *allowed* | Screen names |
| Browser storage → layout | `localStorage` is shared with any script on the origin | A single boolean |
| Module → DOM | Icon markup is written with `innerHTML` | Static SVG strings |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-11-01 | Broken access control | Sidebar filtering | **high** | mitigate | Hiding an entry is presentation, not enforcement. Both admin routes keep their 403 assertions and the technician boundary is re-asserted in the suite | closed |
| T-11-02 | Injection (DOM) | `renderShell` `innerHTML` | medium | mitigate | Icons are static strings; the only interpolated values are `p.key` and `p.label` from the module's own `PAGES` constant, never user data | closed |
| T-11-03 | Availability | `localStorage` access | medium | mitigate | Read and write are each inside `try/catch`; failure degrades to an expanded sidebar. Asserted structurally, and proved to fail when the guard is removed | closed |
| T-11-04 | Accessibility (denial of navigation) | Collapsed rail | low | mitigate | Each entry keeps `aria-label` and `aria-current`; the toggle is a focusable button with `aria-expanded` | closed |
| T-11-05 | Information disclosure | Sidebar markup | low | accept | A technician's page source does not contain the Users or Backup labels. The routes are already 403, so no data is exposed — only the knowledge that the screens exist, which the app has never hidden | accepted |

---

## Verified by

| Threat | Evidence |
|--------|----------|
| T-11-01 | Technician DOM render: 5 entries, no Users/Backup. Smoke: pre-existing `/api/users` 403 assertions unchanged and passing |
| T-11-02 | `shell.js` contains no `fetch`, no `api()` call, no user-supplied interpolation. Offline audit still `OFFLINE-SAFE` |
| T-11-03 | Mutation test: removing the `try/catch` fails "the collapsed state is read defensively" |
| T-11-04 | DOM: entries carry `aria-label`; toggle is `<BUTTON>`, carries `aria-expanded` and `aria-controls` |
| T-11-05 | Accepted — reasoning in AR-11-01 |

---

## Accepted Risks

**AR-11-01 — The sidebar's label list is visible to anyone who can read the page
source.** A technician can see that screens called Users and Backup exist, though
not their contents. Hiding the existence of a screen from the source would mean
serving different HTML per role, which adds a templating layer and a cache
problem to protect nothing: the routes are already 403, and the app has never
pretended those screens do not exist.
