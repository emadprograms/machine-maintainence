// Throttling for repeated failed logins.
//
// The state is a list of timestamps per source, and "is this source blocked?" is
// a question asked of those timestamps — never a flag that some other code has
// to remember to clear. A stored lock needs a writer to undo it, and every
// version of that design ends up with either a manual unlock (which AUTH-03
// forbids) or a sweeper that runs at a time nobody is watching.
//
// Keyed on the source, not the account: if failures accumulated on the account,
// anyone could lock the workshop's admin out by typing wrong passwords, which is
// a worse outcome than the guessing it would prevent.
//
// `now` is injectable so expiry can be tested as the arithmetic it is, rather
// than by sleeping for the length of the window.

export const DEFAULTS = {
  threshold: 5,             // failures within the window before a source waits
  windowMs: 15 * 60_000,    // how far back failures are counted, and the longest wait
  maxWaitMs: 15 * 60_000,   // cap on the computed wait
};

export function createThrottle(options = {}) {
  const { threshold, windowMs, maxWaitMs, now } = { ...DEFAULTS, ...options };
  const clock = now ?? (() => Date.now());
  const failures = new Map();   // source -> ascending timestamps

  // Drop everything older than the window. This is both how the answer is
  // computed and what stops the map growing: a source that gave up long ago has
  // no entries left, and a source with no entries is deleted entirely.
  function prune(source) {
    const list = failures.get(source);
    if (!list) return null;
    const cutoff = clock() - windowMs;
    const kept = list.filter((t) => t > cutoff);
    if (kept.length === 0) { failures.delete(source); return null; }
    failures.set(source, kept);
    return kept;
  }

  // The wait grows with the count so that pacing attempts does not pay, and is
  // capped at the window so continuing to hammer gains nothing. It is measured
  // from the oldest failure still in the window, so the wait always shrinks as
  // time passes and reaches zero on its own.
  function waitFor(list) {
    if (list.length < threshold) return 0;
    const t = clock();
    const oldest = list[0];
    const remaining = oldest + windowMs - t;
    if (remaining <= 0) return 0;
    return Math.min(remaining, maxWaitMs);
  }

  function status(source) {
    const list = prune(source);
    if (!list) return { blocked: false, failures: 0, retryAfter: 0 };
    const wait = waitFor(list);
    if (wait <= 0) return { blocked: false, failures: list.length, retryAfter: 0 };
    return {
      blocked: true,
      failures: list.length,
      // rounded up: reporting 0 seconds while still refusing would be a lie
      retryAfter: Math.ceil(wait / 1000),
    };
  }

  return {
    check: status,
    fail(source) {
      const list = prune(source) ?? [];
      list.push(clock());
      failures.set(source, list);
      return status(source);
    },
    reset(source) {
      failures.delete(source);
      return { blocked: false, failures: 0, retryAfter: 0 };
    },
    // exposed for the test and for an operator wondering what is going on
    peek: status,
    get size() { return failures.size; },
  };
}
