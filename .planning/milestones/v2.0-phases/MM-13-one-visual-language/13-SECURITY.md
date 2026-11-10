---
phase: "13"
slug: "one-visual-language"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-11-05"
---

# Phase 13 — Security

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-13-01 | Integrity (silent breakage) | Markup rewrite | **high** | mitigate | All pre-existing id/handler assertions passed before new ones were written; asserted that every header button targets an existing dialog | closed |
| T-13-02 | Integrity (page reload) | Dialog forms | medium | mitigate | Every form is \`method="dialog"\`; asserted for all five | closed |
| T-13-03 | Availability | Dialog without JS | low | mitigate | \`openForm\` falls back to setting the \`open\` attribute; each dialog has a non-JS close control | closed |
| T-13-04 | Stored XSS | \`emptyRow\` sentences | medium | mitigate | Sentences are static literals, and \`emptyRow\` escapes its argument anyway; DOM probe renders markup in a sentence as text | closed |
| T-13-05 | Integrity (false all-clear) | Empty state vs failed load | **high** | mitigate | No loader may turn a failed fetch into an empty list; asserted with comments stripped, mutation-proved | closed |
| T-13-06 | Stored XSS | New \`soft()\` / \`money()\` cells | medium | mitigate | \`soft()\` calls \`esc()\`; \`money()\` coerces through \`Number\`; both reach the DOM only as escaped text | closed |

## Accepted Risks

**AR-13-01 — A technician sees the New user dialog's markup in page source.**
The section is already \`adminOnly\` in the sidebar and the route is 403, so the
dialog cannot be opened or submitted to any effect. Serving per-role HTML to hide
the markup would add templating to protect nothing. Same reasoning as AR-11-01.

## Verified by

| Threat | Evidence |
|--------|----------|
| T-13-01 | 171 pre-existing checks green before any new assertion |
| T-13-02 | Suite: \`form[method="dialog"]\` on all five |
| T-13-03 | Suite: five close buttons; \`openForm\` fallback in source |
| T-13-04 | jsdom: markup in an empty-state sentence creates no element |
| T-13-05 | Suite: the scoped loader assertion, mutation-proved |
| T-13-06 | Suite: pre-existing escape assertions plus \`soft()\`/\`money()\` reviewed |
