# Close-job machine status switch

Replaced the close dialog's running-state question and dropdown with the same accessible red/green switch used in work updates. It loads the latest machine state, defaults accordingly, and only records a running state when the job is closed. Out-of-service and retired machines cannot be closed; a failed state lookup offers retry rather than guessing. The closing note remains optional.

Verification: 674 smoke checks, OFFLINE-SAFE, work-order UI tests and desktop/mobile Chromium flows covering red/green switch appearance, keyboard operation, running-only closure and layout.
