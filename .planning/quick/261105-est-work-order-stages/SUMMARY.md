# Work-order stage updates

Date: 2026-11-05

- Removed final labour hours from the create and edit forms; the final total is
  entered on closing. Each numbered stage separately records time spent, a required
  written update, author, UTC timestamp and up to five optional photos (2 MB each).
- Starting an open ticket requires Stage 1 and an assignee in a single transaction.
  Subsequent updates append stages while the ticket remains in progress; a job can
  close after any stage. View updates works after closure and reopening continues
  the timeline. Existing unassigned in-progress tickets can be assigned on update.
- The close form proposes the sum of stage durations for a new final total. A previous
  final total is preserved on reopening, with the stage sum displayed for review.
  Stage durations are not independently added to costs (no double-counting).
- Photos and stage data survive restart; deleting a machine cascades stage rows and
  removes stage photo files. As with other photos, the data/photos folder must be
  backed up alongside the database.

Verification: 586 smoke checks pass, including updates, assignment, validation,
photo ownership, concurrent numbering, restart, close/reopen and cleanup. Three
mutations were caught. Real Chromium exercised creation, Stage 1 with two photos,
Stage 2, closing with the summed total, and reading updates after closure. Offline
Audit: OFFLINE-SAFE.
