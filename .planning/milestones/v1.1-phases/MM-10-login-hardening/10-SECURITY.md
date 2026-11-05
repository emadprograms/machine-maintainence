---
phase: "10"
slug: "login-hardening"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-11-05"
---

# Phase 10 — Security

> Audited inline (no `gsd-security-auditor` agent installed); each threat probed against a
> running server on :3777 with a throwaway database. Gate: ASVS L1, block on `high`.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| LAN client → login | Anyone able to reach the port can attempt credentials; the only cost used to be CPU time | Credentials, and now failure counts |
| Source address → throttle key | The key must be something the client cannot choose | Connection address |
| Throttle → error message | The message must inform the user without informing an attacker | Wait duration, account existence |
| Process memory → throttle state | State that survives nothing, which is the safety property | Timestamps only |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-10-01 | Authentication (brute force) | `POST /api/login` | **high** | mitigate | Threshold of 5 failures per source per 15-minute window; check happens before password verification. Measured: 400 attempts in 400 s → 5 password checks | closed |
| T-10-02 | Denial of service (self-inflicted) | Throttle key | **high** | mitigate | No account-keyed state exists. An attacker can only block their own address, for at most one window | closed |
| T-10-03 | User enumeration | Login failure path | medium | mitigate | An unknown email takes the identical path: counted, same 401 body, same 429 once blocked. Proved by spending a whole budget on invented addresses | closed |
| T-10-04 | Spoofing / throttle bypass | `X-Forwarded-For` | **high** | mitigate | The header is not read; `req.socket.remoteAddress` is used, with IPv4-mapped forms normalised. Probed: header present → still 429 | closed |
| T-10-05 | Memory exhaustion | Failure map | low | mitigate | Pruned on every access to the window; an entry with no recent failures is deleted. Asserted: map size returns to 0 | closed |
| T-10-06 | Permanent lockdown | Throttle expiry | **high** | mitigate | No stored flag exists to become permanent. The wait is arithmetic on the oldest in-window timestamp, bounded by the window, and cannot exceed it. A restart also clears everything | closed |
| T-10-07 | Information disclosure in the wait | 429 body | low | accept | The wait reveals that *this address* has been failing, to the address that was failing. It says nothing about which account, or whether it exists. AR-10-03 | accepted |
| T-10-08 | Distributed guessing | Per-source design | medium | accept | An attacker with many source addresses is not slowed. Detecting a distributed attempt needs cross-source analysis and is a different feature, not a tuning change. AR-10-02 | accepted |
| T-10-09 | Reverse proxy deployment | Source detection | medium | accept | Ignoring `X-Forwarded-For` is what makes the throttle bypass-proof. Behind a proxy it would throttle all users as one source — safe, but wrong. Documented so the decision is revisited deliberately rather than discovered. AR-10-01 | accepted |

---

## Verified by

| Threat | Evidence |
|--------|----------|
| T-10-01 | Live probe: 5 × 401 then `429` + `retry-after: 900`. Unit: 400 one-per-second attempts evaluated 5. Regression: removing the gate → 7 failures |
| T-10-02 | The word "locked" does not appear as state anywhere; `createThrottle` exposes no way to block an arbitrary key. Blocking is derived from that key's own failures |
| T-10-03 | Smoke "repeated failures on addresses that do not exist reach the threshold" → 429; the response body is the generic throttle message, not a credential verdict |
| T-10-04 | Live: `-H 'x-forwarded-for: 1.2.3.4'` while blocked → `429`. IPv4-mapped normalisation prevents one client appearing as two keys |
| T-10-05 | Smoke "an expired entry is forgotten entirely, so memory does not grow" → `map size 0` |
| T-10-06 | Smoke "the block expires on its own once the window has passed"; measured 900 → 450 → allowed. Smoke "the reported wait is bounded by the window" |
| T-10-07 | Accepted. Reasoning in AR-10-03 |
| T-10-08 | Accepted. Reasoning in AR-10-02 |
| T-10-09 | Accepted. Reasoning in AR-10-01 |

---

## Accepted Risks

**AR-10-01 — The throttle ignores `X-Forwarded-For`, so it cannot be deployed
behind a reverse proxy as-is.** On the workshop LAN there is no proxy. Honouring
the header without one would let a single client present unlimited identities and
defeat the entire mechanism — a bypass is worse than a deployment constraint.
If a proxy is ever introduced, this decision needs to change *together with* a
trusted-proxy allowlist, not before it.

**AR-10-02 — Distributed guessing is not detected.** Five attempts per source per
window stops one address. It does nothing against an attacker with many. Anything
effective against that needs cross-source aggregation and alerting, which is a
different feature with its own scope. At this deployment's size, an attacker on
the LAN with that capability has easier options.

**AR-10-03 — The 429 states the remaining wait.** It tells the client that its
*own* address has been failing. It does not say which account was targeted or
whether that account exists, and the information is only ever shown to the party
that caused it. The alternative — a silent refusal — would leave a legitimate
user who mistyped their password with no idea why they cannot sign in.

---

## Not covered

- Anything requiring a compromised session cookie. Sessions are unchanged by this
  phase; the throttle governs obtaining one, not using one.
- Timing analysis of the throttled path. Under the threshold the existing
  constant-time-ish comparison is unchanged; at or above it the response is fixed
  and identical, which is the stronger position.
