---
phase: "12"
slug: "the-front-door"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-11-05"
---

# Phase 12 — Security

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-12-01 | Broken access control | \`/api/dashboard\` aggregation | **high** | mitigate | Four fixed sections; the users table is never read; payload asserted free of email/password/user-shaped keys; 401 for anonymous | closed |
| T-12-02 | Integrity (summary disagrees with screen) | Summary SQL | **high** | mitigate | Reuses \`workOrderFilter\` and the parts predicate; asserted that the card count equals the list length, and that closing one order lowers the count by one | closed |
| T-12-03 | Resource exhaustion | Unbounded payload | low | mitigate | Items capped at 5; counts are integers | closed |
| T-12-04 | Stored XSS | \`dashboard.js\` string-built markup | **high** | mitigate | \`escapeHtml\` on every interpolated field; DOM probe renders \`<img src=x onerror=alert(1)>\` as inert text with no \`img\` element created | closed |
| T-12-05 | Integrity (false all-clear) | Failed-load rendering | medium | mitigate | Error path is a separate render with no counts; asserted in DOM | closed |

## Accepted Risks

None. The one deliberately not defended against is a user with access to the
browser's own devtools editing what they see — not a threat model, since the
server decides what they may do.

## Verified by

| Threat | Evidence |
|--------|----------|
| T-12-01 | Suite: 4 payload assertions + 401. Section keys are a fixed literal, not derived from the request |
| T-12-02 | Suite: card==list length; close-one-and-recount. Mutation-proved twice |
| T-12-03 | Suite: "items are capped at five" |
| T-12-04 | jsdom: hostile title, ampersand. Suite: per-field escape assertions, mutation-proved |
| T-12-05 | jsdom: error render contains no \`.dash-count\` |
