// A record of failed sign-ins. No refusal, no delay.
//
// The earlier design blocked a source after five failures. That was the wrong
// trade for this application: the workshop has no password reset and no second
// admin by default, so a block means a technician standing at a machine unable
// to log a repair, unable to fix it themselves — to slow down an attacker who
// already had to be on the LAN to try. The cost lands on the person who most
// needs the app, and the benefit lands on a threat that is already narrow.
//
// The requirement was that guessing be slow and *visible*. Visibility does not
// require refusing anyone. Every failure is written down with a timestamp, the
// address it came from, and which address was attempted. Nobody is ever turned
// away, and a run of failures against one account at 3am is right there in the
// file.
//
// The application itself can see the file at app/data/login-failures.log.

import { appendFileSync, existsSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MAX_BYTES = 1024 * 1024;   // one rotation at a megabyte; a workshop will never

export function createLoginLog(dataDir, { now = () => new Date() } = {}) {
  const file = join(dataDir, 'login-failures.log');
  const path = file;

  function rotateIfNeeded() {
    try {
      if (existsSync(file) && statSync(file).size > MAX_BYTES) {
        // one generation of history is enough to see a pattern; more than that
        // is a file nobody reads
        renameSync(file, `${file}.1`);
      }
    } catch { /* a log that cannot rotate must not stop a sign-in */ }
  }

  return {
    path,

    /** One line per failure. Never record the password, not even a fragment. */
    record({ email, source, reason = 'wrong credentials' }) {
      const stamp = now().toISOString();
      // Tab-separated so a comma or a quote in an email cannot break the shape.
      const line = [stamp, source || 'unknown', email || '(none)', reason].join('\t') + '\n';
      rotateIfNeeded();
      try {
        appendFileSync(file, line);
      } catch { /* if the disk is full, a failed sign-in still fails quietly */ }
    },
  };
}
