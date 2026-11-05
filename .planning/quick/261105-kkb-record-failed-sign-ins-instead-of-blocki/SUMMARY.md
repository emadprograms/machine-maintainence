---
quick_id: 261105-kkb
slug: record-failed-sign-ins-instead-of-blocki
date: 2026-11-05
status: complete
commits: [dd6b44e]
files_modified: [.planning/REQUIREMENTS.md, .planning/milestones/v1.1-REQUIREMENTS.md, .planning/milestones/v1.1-MILESTONE-AUDIT.md, .planning/milestones/v1.1-phases/MM-10-login-hardening/10-VERIFICATION.md, .planning/milestones/v1.1-phases/MM-10-login-hardening/10-SECURITY.md, .planning/milestones/v1.1-phases/MM-10-login-hardening/10-VALIDATION.md, .planning/milestones/v1.1-phases/MM-10-login-hardening/10-01-SUMMARY.md]
---

# Quick Task 261105-kkb — Summary

**Task:** Record failed sign-ins instead of blocking them.
**Outcome:** Done. Code in `dd6b44e`; this task corrected the record to match.

## What the code does now

Every failed sign-in appends one tab-separated line to
`starter/data/login-failures.log`: ISO timestamp, source address, the address
attempted, and whether the account existed. Nobody is refused. Nothing is
delayed. There is no `Retry-After` header because there is no wait.

`throttle.js` is deleted, along with the 429 gate, the client countdown and ten
assertions that covered them. `login-log.js` replaces it, with nine assertions.

## What the record said before, and why that mattered

The planning artifacts are the durable output of this work, and three of them
were actively wrong after the change:

| Artifact | Claimed | Reality |
|---|---|---|
| `v1.1-REQUIREMENTS.md` | AUTH-01 `[x]` "throttled"; AUTH-03 `[x]` "block expires" | No throttle exists |
| `v1.1-MILESTONE-AUDIT.md` | "19/19 verified", AUTH-01 evidenced by "five 401s then 429" | That evidence is unreproducible |
| `10-SECURITY.md` | T-10-01 closed by a threshold; T-10-02/06 closed by design | All three described removed code |

An audit that describes code that is gone is worse than no audit, because it is
believed. Each was amended rather than rewritten: the original text stays and an
amendment states what changed, when and why. Reversing a decision is normal;
erasing that it happened is not.

## What the amendments say

- **AUTH-01** — rewritten to the failure log, with the original text, the reason
  for the change, and the cost accepted (unlimited fast guessing) stated inline.
- **AUTH-03** — superseded, not deleted. It constrained a mechanism that no
  longer exists.
- **Audit** — verdict left standing with an explicit qualifier; a new
  §"Amendment — the throttle was removed" carries the decision and its cost.
- **Security** — T-10-01 reopened as **accepted**; T-10-02/06 → *n/a* (mechanism
  gone); T-10-07/08 → moot; two new threats for the log itself, both closed.
- **Verification** — "superseded in part", with a table mapping each old
  must-have to what it is now and how the replacement is verified.
- **Validation** — replacement assertion rows with their Nyquist check.

## Verification

| Check | Result |
|---|---|
| Suite | **138 passed, 0 failed** under `PATH=/nonexistent` |
| Offline audit | `OFFLINE-SAFE` |
| Twelve consecutive wrong passwords | all 401, no `Retry-After`, no mention of a wait |
| Log written | 12 lines, correct fields |
| Log not web-reachable | `/data/login-failures.log` → 404, `/login-failures.log` → 404 |

The new assertions were proved to fail when broken: stopping the log write broke
7, reintroducing a throttle broke 5, a 250 ms delay broke the timing check, and
logging the password broke the leak check.

## Honest limitations

- The timing assertion allows 200 ms per attempt. It catches a deliberate sleep,
  not micro-optimisation.
- The log is append-only locally with one rotation at 1 MB. It is not shipped
  anywhere and not parsed by the app; reading it means opening the file.
- Unlimited guessing is now the behaviour. The control that would actually
  reduce the risk is a longer password minimum (currently 8), which was
  identified but is out of scope for this task.
