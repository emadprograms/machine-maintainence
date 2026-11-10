# Work-order problem and assignment

Date: 2026-11-05

- A work order requires a nonblank Problem. It may be created with or without an
  assignee and starts in Open either way.
- On starting an unassigned order, the UI asks who should be assigned and submits
  assignment and In progress together. Already-assigned orders start directly.
  Both administrators and technicians can use the existing names-only endpoint.
- The API rejects a start without an assignee and rejects clearing an assignee
  while the order remains In progress. Existing unassigned in-progress orders can
  still be edited, but must be assigned before starting again after reopening.
- The creation form loads its own machine and assignee choices, rather than relying
  on visiting Machines first. A failed people lookup still permits unassigned
  creation; a failed machine lookup prevents creation and asks the user to retry.

Verification: 556 smoke checks passed, including API tests for both roles and actual
work-order module interactions using a DOM/API double. Offline audit passed. Four
mutations (backend guard, prompt, creation assignment, start assignment) were caught.
The UI interaction tests do not replace a visual test in a browser.
