---
quick_id: 261105-kkb
slug: record-failed-sign-ins-instead-of-blocki
date: 2026-11-05
status: complete
files_modified: [.planning/REQUIREMENTS.md, .planning/milestones/v1.1-REQUIREMENTS.md, .planning/milestones/v1.1-MILESTONE-AUDIT.md, .planning/milestones/v1.1-phases/MM-10-login-hardening/10-VERIFICATION.md, .planning/milestones/v1.1-phases/MM-10-login-hardening/10-SECURITY.md, .planning/milestones/v1.1-phases/MM-10-login-hardening/10-VALIDATION.md, .planning/milestones/v1.1-phases/MM-10-login-hardening/10-01-SUMMARY.md]
---

# Quick Task: Record failed sign-ins instead of blocking them

## Context

The code change is already committed (`dd6b44e`): the throttle was replaced
with a failure log. This task exists because **the planning record still says
the opposite**.

`.planning/milestones/v1.1-REQUIREMENTS.md` lists AUTH-01 and AUTH-03 as
`[x]` complete, `.planning/milestones/v1.1-MILESTONE-AUDIT.md` reports 19/19
verified, and `10-SECURITY.md` registers the throttle as a closed high-severity
mitigation. All three statements are now false. A record that disagrees with the
code is worse than no record: the next person reads the audit, believes guessing
is throttled, and does not look.

## Why the decision changed

The blocking design was the wrong trade for this application. There is no
password reset and no second admin by default, so a block means a technician
standing at a machine, unable to log a repair and unable to fix it — while the
attacker already had to be on the LAN to try at all. The cost fell on whoever
needed the app most.

The requirement was that guessing be slow and *visible*. Visibility does not
require refusing anyone. The log gives the visibility at zero cost to a
legitimate user; the slowness is gone, and that is a deliberate acceptance.

## Tasks

### Task 1: Amend the requirement

**File:** `.planning/REQUIREMENTS.md` (and the archived v1.1 copy)

Rewrite AUTH-01…03 to state what was actually built and kept:
- AUTH-01 — failed sign-ins are recorded with timestamp, source and attempted
  address; the record is the visibility mechanism and nobody is refused.
- AUTH-02 — retained in substance: a successful sign-in adds no failure entry.
- AUTH-03 — superseded: there is no throttle, so there is nothing that could
  lock anyone out.

Each amendment carries the date and the reason, and says plainly that the
throttle was built, verified, then removed by decision — not that it never
existed. Hiding the reversal would make the milestone history lie in a subtler
way.

### Task 2: Correct the milestone audit

**File:** `.planning/milestones/v1.1-MILESTONE-AUDIT.md`

The header claims 19/19 verified. It is 19 implemented, with AUTH-01 amended and
AUTH-03 superseded **after** the close. Add an amendment section rather than
rewriting the verdict: the audit was accurate when written, and what happened
afterwards belongs in the record as its own event.

### Task 3: Correct the phase 10 artifacts

**Files:** `10-VERIFICATION.md`, `10-SECURITY.md`, `10-VALIDATION.md`,
`10-01-SUMMARY.md`

- Verification: the throttle must-haves are no longer met; record their
  replacement and mark the report **superseded in part**, since its score table
  describes code that no longer exists.
- Security: T-10-01 (brute force, closed by blocking) is reopened as an
  **accepted risk** with the reasoning above. T-10-02 (self-DoS) and T-10-06
  (permanent lockdown) are no longer reachable and become "not applicable —
  mechanism removed". Add a threat for the failure log itself: it must not
  record passwords, and it must not become an account oracle.
- Validation: mark the throttle rows as superseded and point at the assertions
  that replaced them.
- Summary: append what changed and why.

Every one of these is a factual correction. None of them change code.

### Task 4: Confirm the code and the record agree

Run the suite and probe the running server to confirm the record now describes
reality: unlimited attempts, a written log, no password in the log, no
`Retry-After` header anywhere.

## Acceptance

- No artifact claims guessing is throttled or that a block exists.
- AUTH-01…03 read as what was built, with the reversal and its reason visible.
- The audit's 19/19 claim is qualified rather than silently left standing.
- The suite passes and a live probe matches every statement in the amended docs.
