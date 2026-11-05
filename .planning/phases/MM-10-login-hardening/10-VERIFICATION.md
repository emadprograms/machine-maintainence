---
phase: MM-10-login-hardening
verified: 2026-11-05T11:55:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .planning/phases/MM-10-login-hardening/10-01-PLAN.md
  - .planning/phases/MM-10-login-hardening/10-01-SUMMARY.md
  - starter/throttle.js
  - starter/server.js
  - starter/public/app.js
  - starter/scripts/smoke-test.js
covered_digest: "v4:sha256:428eb410f81972d4317bc5233e9cead2a87b66b7b657a4a8553a87ce71cfa6c6"
behavior_unverified: 0
---

# Phase 10: Login hardening Verification Report

**Phase Goal:** Guessing passwords over the LAN is slow and visible.
**Verified:** 2026-11-05
**Status:** passed

*Auditors are not installed in this environment (`agents_installed: false`), so
the audit ran inline against live probes and the suite.*

## Goal Achievement

### Observable Truths (from ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Repeated wrong passwords from one source are refused with a message stating the wait | ✓ VERIFIED | Live: attempts 1–5 → 401, attempt 6 → `429` with `retry-after: 900` and `"Too many failed sign-ins. Try again in 900 seconds."`. The page renders that number and ticks it down. |
| 2 | A correct password after a successful login attempt resets the counter | ✓ VERIFIED | Smoke "a successful login resets the source, so the next misses start over" — driven through the route, and proved to fail when `reset()` is removed from the server |
| 3 | A throttled source recovers automatically once the window elapses — no manual intervention, no permanent lockout | ✓ VERIFIED | Unit, with an injected clock: blocked at threshold → wait 900 s → 450 s after half the window → allowed after the window, with no reset call. Live semantics confirm the same arithmetic: `retry_after` is always ≤ 900. |
| 4 | The throttle cannot be used to lock a known admin out indefinitely | ✓ VERIFIED | No account state exists. Keying is per source, and the wait is bounded by the window, so the worst case is 15 minutes from the attacker's own address. An existing session is unaffected — smoke "being blocked does not invalidate an existing session". |

### Plan must-haves

| Must-have | Status |
|---|---|
| Five failures from one source make the next attempt a 429 with the wait stated | ✓ |
| A successful login clears that source's count | ✓ |
| The block expires on its own, no stored flag, no manual unlock | ✓ — there is no "blocked" field anywhere; the type does not exist |
| An unknown email counts as a failure | ✓ — proved by spending the whole budget on invented addresses |
| `X-Forwarded-For` cannot escape the throttle | ✓ — header present, still 429 |

### Effectiveness, measured rather than asserted

| Scenario | Password checks performed |
|---|---|
| 400 attempts at one per second from one source | **5** |

That is the point of the phase: the cost of guessing went up by roughly two
orders of magnitude per unit of time, without any state that has to be cleaned
up.

### Accessibility of the block

| Time since the block | Wait reported |
|---|---|
| immediately | 900 s |
| +7 min 30 s | 450 s |
| +15 min 30 s | allowed |

The wait falls because it is computed from the oldest failure still in the
window. Nothing runs to make this happen.

## Test integrity

Suite **118 → 145 checks**, all passing under an empty `PATH`.

Each defect was reintroduced and the suite re-run:

| Defect | Failing assertions |
|---|---|
| No throttle at all (v1.0 behaviour) | 7 |
| Success does not clear the count | 2 |
| Unknown email not counted (email oracle) | 3 |
| `X-Forwarded-For` trusted | 1 |
| Wait never shrinks (a stored flag by another name) | 1 |
| Entries never pruned (expiry never happens) | 1 |
| `retry_after` not attached to the client error | 1 |
| `startCooldown` never called | 1 |
| Countdown deleted entirely | 2 |

**Three assertions initially passed with their bug present** and were rewritten:

1. AUTH-02 was tested by calling `reset()` on the module directly, which cannot
   detect the route failing to call it.
2. The email-oracle test spent its threshold on the real account, so the unknown
   email was refused because the *source* was blocked, not because unknown
   emails are counted.
3. The countdown wiring check searched for words that remained in dead code; it
   now requires `startCooldown` to be called from outside its own body.

## Two suite defects found and fixed by this phase's own failures

**A crash left an orphan server on the test port.** The next run connected to it
and tested an old process with an old database, producing a page of failures that
had nothing to do with the code. The suite now refuses to start when the port is
occupied, and kills its child on `exit`, `uncaughtException` and
`unhandledRejection`. Verified by deliberately crashing it and confirming the
port was free afterwards.

## Deviations

- The plan called for the throttle work plus assertions. The **login page
  countdown** was added because AUTH-01 says the throttle must be stated; a
  number that never changes is stated once and then misleading.
- AUTH-02's assertion design changed from the plan's sketch after it was found to
  be incapable of failing.

## Not verified

- Behaviour behind a reverse proxy. `X-Forwarded-For` is ignored by design, so a
  deployment behind a proxy would throttle every user as one source. That is a
  deliberate, documented trade-off (AR-10-01), not an oversight.
- A determined attacker using many source addresses (a botnet, or ARP spoofing
  several IPs on the LAN). Per-source throttling cannot see a distributed attack;
  detecting one is a different feature. AR-10-02.
