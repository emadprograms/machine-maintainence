---
phase: 10
plan: 1
name: A source that guesses is made to wait
status: complete
one-liner: Failed logins are throttled per source by arithmetic on timestamps, so the block expires without anything having to clear it
tasks: 3
files_modified: [starter/throttle.js, starter/server.js, starter/public/app.js, starter/scripts/smoke-test.js]
requirements: [AUTH-01, AUTH-02, AUTH-03]
commits: [1abe7a6]
---

# Plan 10-01: A source that guesses is made to wait

**Tasks:** 3
**Status:** Complete

## The design, and why the obvious one was rejected

The obvious implementation is a `failed_attempts` column and a `locked_until`
timestamp. It fails both of this phase's constraints:

- If failures accumulate on the **account**, anyone on the LAN can lock
  `admin@local` out of their own workshop by typing wrong passwords. That is a
  worse outcome than the guessing it prevents, and success criterion 4 forbids
  it explicitly.
- A stored lock needs something to clear it. Every such design ends in either a
  manual unlock (forbidden by AUTH-03) or a background sweeper.

So nothing is ever stored as "blocked". `throttle.js` keeps a list of failure
timestamps per source, and blocking is a **question asked of those timestamps**:
are there five within the last fifteen minutes? The wait is arithmetic on the
oldest one still in the window. It shrinks by itself as time passes and reaches
zero with nothing running. AUTH-03 is true because of arithmetic, not because a
timer was remembered.

## What was built

**`throttle.js`** — no HTTP knowledge. `createThrottle({ threshold, windowMs,
maxWaitMs, now })` returns `check`, `fail`, `reset`. `now` is injectable so
expiry can be tested without sleeping. Every call prunes entries older than the
window, which computes the answer and bounds memory in the same pass.

**The route** — `check()` runs *before* the password is verified, so guessing
costs the guesser a refusal rather than a scrypt run. A blocked source gets
`429` with `retry_after` and a message stating the wait (AUTH-01 asks for the
message, not just the number). A failure calls `fail()`; a success calls
`reset()` (AUTH-02). An unknown email goes down the identical path, so the
throttle cannot be used to discover which addresses exist.

**The source** is `req.socket.remoteAddress`, with IPv4-mapped addresses
normalised. `X-Forwarded-For` is deliberately not read: on a LAN with no proxy in
front, trusting it would let a single attacker mint unlimited identities.

**The login page** counts the wait down. A frozen "try again in 900 seconds"
leaves the user refreshing to find out whether it is still true.

## Measured behaviour

| Scenario | Result |
|---|---|
| 400 attempts at one per second from one source | **5** password checks actually evaluated |
| 4 mistypes, then the correct password | allowed |
| The same user mistypes 4 more times immediately after | allowed — the count was cleared |
| Block just raised | 900 s |
| After 7 min 30 s | 450 s |
| After 15 min 30 s | allowed, with nothing having run to clear it |

## Two things this phase exposed in the test suite itself

1. **An assertion that could not fail.** The AUTH-02 check called
   `throttle.reset()` directly on the module, which proves the module *can* clear
   a source — not that the route *does*. It passed with `reset()` deleted from
   the server. Rewritten to drive the route: two failures, a good login, then
   failures that would cross the threshold if the count had survived.

2. **An oracle test that spent its budget on the wrong address.** It exhausted
   the threshold on the real account and then asked whether an unknown email was
   also throttled. Of course it was — the source was blocked. It now spends its
   budget entirely on addresses that do not exist.

Both are recorded in the validation because a suite whose assertions cannot fail
is worth less than no suite: it reports safety it never checked.

## Also fixed, from a crash during this phase

An assertion threw mid-run, the child server outlived the test, and the next run
connected to that orphan on port 3999 and spoke to an old process with an old
database — producing a page of nonsense failures. The suite now refuses to start
if the port is occupied, and kills its child on every exit path. Both were
verified by crashing it deliberately.
