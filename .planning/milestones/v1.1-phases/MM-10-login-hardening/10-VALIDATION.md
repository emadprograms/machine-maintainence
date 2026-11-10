---
phase: "10"
slug: "login-hardening"
status: validated (amended — throttle rows superseded 2026-11-05)
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-05"
---

# Phase 10 — Validation Strategy

| Property | Value |
|----------|-------|
| **Framework** | none — assertions in `starter/scripts/smoke-test.js` |
| **Quick run command** | `env PATH=/nonexistent node --no-warnings=ExperimentalWarning starter/scripts/smoke-test.js` |
| **Estimated runtime** | ~3 seconds |

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Evidence | Status |
|---------|------|------|-------------|------------|-----------------|-----------|----------|--------|
| 10-01-01 | 01 | 1 | AUTH-01 | T-10-01 | N failures from one source make the next attempt 429, and the wait is stated | integration | "exceeding the threshold returns 429", "the refusal states how long to wait in the message", Retry-After header | ✅ passed |
| 10-01-02 | 01 | 1 | AUTH-02 | — | A correct password before the threshold clears the count | integration | "a successful login resets the source, so the next misses start over" (driven through the route) | ✅ passed |
| 10-01-03 | 01 | 1 | AUTH-03 | T-10-06 | The block is a function of elapsed time; a clock shift past the window restores access | unit + integration | "the wait shrinks as time passes", "the block expires on its own", "bounded by the window" | ✅ passed |
| 10-01-04 | 01 | 1 | — | T-10-03 | An unknown email counts as a failure | integration | "repeated failures on addresses that do not exist reach the threshold", "the throttled response is the same shape" | ✅ passed |
| 10-01-05 | 01 | 1 | — | T-10-04 | X-Forwarded-For does not mint a fresh identity | integration | "a spoofed X-Forwarded-For does not escape the throttle" | ✅ passed |

## Wave 0 Requirements

The throttle needs a controllable clock to test expiry without sleeping 15
minutes. The helper takes `now` as a parameter rather than reading `Date.now()`
internally, so a test can advance it — and the route passes the real clock. This
is the same shape as `verifyToken`'s explicit `exp` comparison.

## Nyquist Audit

**Sufficiency.** Every defect was reintroduced and the suite re-run:

| Defect | Assertions failed |
|---|---|
| No throttle at all | 7 |
| Success does not clear the count | 2 |
| Unknown email not counted | 3 |
| X-Forwarded-For trusted | 1 |
| Wait never shrinks | 1 |
| Entries never pruned | 1 |
| retry_after not attached on the client | 1 |
| Countdown never started | 1 |
| Countdown deleted entirely | 2 |

**Necessity — three assertions failed this audit by passing when they should
have failed.** They were rewritten, not adjusted until green:

1. **AUTH-02** called `throttle.reset()` directly on the module. That proves the
   module can clear a source; it cannot observe the server failing to call it.
   Rewritten to drive the route: two failures, a good login, then three more
   failures, which are the fifth only if the count survived.
2. **The email oracle** exhausted its budget on the real account before testing
   an invented one, so the invented address was refused because the source was
   blocked. Rewritten to spend the entire budget on addresses that do not exist.
3. **The countdown wiring check** matched words that remained in dead code. It now
   requires `startCooldown` to be called from outside its own body and
   `retryAfter` to be attached to the thrown error.

**A fourth problem was in the harness, not the assertions.** An assertion threw,
the child server survived, and the next run silently tested the orphan on the
test port. The suite now refuses to run against an occupied port and kills its
child on every exit path — verified by crashing it on purpose.

**Observed on the wire.** `401 ×5 → 429` with `retry-after: 900` and a message
stating the wait; a spoofed `X-Forwarded-For` still refused; the wait measured
falling 900 → 450 → gone.

## Validation Sign-Off

- [x] All tasks have automated verification
- [x] Every assertion was proved to fail with its defect reintroduced
- [x] Assertions that could not fail were rewritten to go through the broken path
- [x] Expiry is asserted as arithmetic against an injected clock, not by sleeping
- [x] The suite refuses to run against an orphaned server

**Approval:** validated — 145 checks, 0 failures.

---

## Amendment 2026-11-05 — throttle rows superseded

The five task rows above verify a throttle that has been removed. They are left
in place as history; the rows below supersede them and describe what ships.

| Task | Requirement | Secure behaviour | Evidence | Status |
|---|---|---|---|---|
| 10-02-01 | AUTH-01 | Failures are recorded with timestamp, source and attempted address | smoke: "failed sign-ins are written to a log", field assertions | ✅ passed |
| 10-02-02 | AUTH-01 | Nobody is refused and nothing is delayed | smoke: "forty wrong passwords … no limit reached", "the attempts were not slowed down" | ✅ passed |
| 10-02-03 | AUTH-02 | A good sign-in adds no failure entry | smoke: "a successful sign-in adds no failure entry" | ✅ passed |
| 10-02-04 | — | The password never reaches the log | smoke: proved to fail when a fragment was logged | ✅ passed |
| 10-02-05 | AUTH-03 | No throttle exists, so nothing can lock anyone out | structural: `throttle.js` and the 429 gate are absent from the source | ✅ passed |

**Nyquist check on the replacement assertions.** Each was proved to fail:
stopping the log write broke 7 of them; reintroducing a throttle broke 5;
adding a 250 ms delay broke the timing assertion; logging the password broke the
leak assertion. The timing assertion is the weakest of these — it allows 200 ms
per attempt, so it catches a deliberate sleep but not micro-optimisation.

**Approval:** amended — 138 checks, 0 failures.
