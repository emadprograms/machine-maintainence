# Debug: new tickets and the updates history

Date: 2026-11-05. Status: fixed and checked; the user's exact installation was not available.

## Evidence

On the current server an open ticket with no stages returns HTTP 200 and `[]`, and
Chromium showed `No updates yet.` with no error. We could not reproduce an empty-list
failure on that server. The earlier test suite did not explicitly assert this case.

An older server serving newly updated client files did reproduce a missing updates
endpoint: HTTP 404 with a plain-text body. This can happen when code is pulled while
the old app process is still running; static files are read from disk but the route
map is created on server startup. This is a plausible cause, not a confirmed diagnosis
of the user's installation.

## Fix

For an open ticket whose work-order list reports no stages, display `No updates yet.`
immediately, while verifying the history in the background. Save stays disabled until
that verification finishes, so a newly added stage is shown before the user proceeds.
An actual network/permission/lookup failure is not silently described as no updates.
An unavailable plain-text 404 endpoint instead asks the user to restart the app after
updating; a JSON 404 for a missing ticket remains a distinct error. Unexpected history
responses are rejected rather than presented as empty.

## Verification

- 589 smoke checks, including a real API request for a new ticket returning `[]`.
- Client interaction tests cover the empty state during and after loading, a stale
  snapshot corrected by a concurrent update, failed fetches, a missing endpoint, a
  genuinely missing ticket, and malformed server results.
- Four mutations caught: suppressing either empty state, replacing a failed lookup
  with an empty state, and hiding the outdated-server diagnosis.
- Chromium checked the current server's empty ticket, staged update/photo flow, and
  assignee retry flow. A separate old-server/new-client reproduction displayed the
  restart instruction rather than falsely claiming that a failed fetch was empty.
