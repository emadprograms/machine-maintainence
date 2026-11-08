# Debug: the assignee picker is empty when starting a work order

Date: 2026-11-05. Status: fixed.

## Evidence and causes

A Chromium reproduction created an already-assigned open work order and opened its
start dialog. The assignee field was hidden and its select contained zero options,
even though the job was assigned and the API returned both accounts. The UI only
loaded people for unassigned jobs, making the preassigned person's name invisible
and preventing changes at the point of starting.

There was a second failure mode: a single Promise.all waited for the stage history
and people lookups together. A failed or stalled history lookup meant the people
select stayed empty even when the names endpoint succeeded.

## Fix

The start dialog always displays the assignee choice, preselecting any existing
assignment and sending a newly selected one with Stage 1. An unassigned legacy
in-progress job also asks for an assignee. People and history populate separately;
the form explains failures or an empty account list and offers an in-place retry,
without discarding the typed update. Save remains disabled until the necessary data
loads. Stale responses from earlier dialogs/retries cannot replace current choices.

## Verification

- 588 smoke checks pass, including the API reassignment path and actual work module
  tests for assigned/unassigned jobs, failed/slow requests, retry, empty accounts,
  preservation of a draft/selection and stale responses.
- Four mutations were caught: hiding the preassigned picker, dropping preselection,
  dropping the submitted assignment, and blanking people when history fails.
- Isolated Chromium tests covered an admin reassigning an existing job, an unassigned
  job with a failed history request and successful retry, and a technician selecting
  an assignee and starting a job. The earlier stage/photo/close flow also passed.
