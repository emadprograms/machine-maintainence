# Phase 10 — Login hardening: context

## What exists

`POST /api/login` verifies a scrypt hash in roughly constant time and returns
`401 Wrong email or password` for any failure. There is no accounting of
failures at all: the route is a pure function of the credentials and the users
table. Anyone on the LAN can try passwords as fast as the CPU allows, with no
sign that they are doing it.

## Requirements

- **AUTH-01** — repeated failures from one source are throttled, and the message
  says how long the wait is.
- **AUTH-02** — a successful login clears that source's count.
- **AUTH-03** — the block expires by itself; no permanent lockout.

## The design decision that shapes everything

AUTH-03 plus success criterion 4 (“the throttle does not exist in a form that
lets an attacker lock out a known admin indefinitely”) together rule out the
obvious design. The obvious design is a `failed_attempts` column and a
`locked_until`, and it is wrong for two reasons:

1. **An attacker becomes a denial-of-service.** If failures accumulate on the
   *account*, anyone can lock `admin@local` out of their own workshop by typing
   wrong passwords. That is a worse outcome than the guessing it prevents.
2. **A stored lock needs a writer to clear it.** Every stored-flag design ends
   up with either a manual unlock path (violates AUTH-03) or a sweeper.

So the state is keyed on the **source**, not the account, and there is no
“locked” flag at all. Failures are timestamps; the block is a *derived
question* — “are there N failures from this source in the last M minutes?” —
and the wait is arithmetic on those timestamps. Nothing has to expire anything,
so nothing can fail to expire it. A source that stops trying is forgotten
because its timestamps age out.

The source is the connection address. `X-Forwarded-For` is deliberately **not**
consulted: on a LAN with no proxy in front of it, trusting that header would let
a single attacker mint unlimited identities and bypass the throttle entirely.
If a reverse proxy is ever put in front of this, that decision has to be revisited
along with the header.

In memory, not in the database: consistent with the v1.0 session store, and it
means the state dies with the process — a restart clears every block, which is
the most conservative possible answer to AUTH-03.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Key | Source address | Account keying lets an attacker lock out a real user |
| State | Timestamps in a `Map` | A block that is computed cannot fail to expire |
| Window | 15 minutes | Long enough to make guessing slow, short enough that a mistyping user is not stuck over lunch |
| Threshold | 5 failures | Below this the workshop notices nothing; above it guessing gets expensive |
| Wait | Escalates with the count, capped at the window | A plain fixed wait invites an attacker to pace themselves |
| Success | Clears that source | AUTH-02, and the user who eventually remembers their password is not punished |
| Response | `429` with `retry_after` seconds and a human message | AUTH-01 wants the wait stated |
| Unknown email | Counts as a failure | Otherwise the throttle tells an attacker which emails exist |

## Migration

None. No schema change.

## Windows

No new commands, no shell-outs, no file paths. The state is a process-local
`Map`, so `start.bat` is unchanged.
