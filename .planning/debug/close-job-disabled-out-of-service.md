# Debug: closing a job while out of service

Date: 2026-11-05. Status: fixed.

## Cause

The close dialog enabled its action as soon as the current machine state loaded, regardless of the switch. The user could click while out of service and only then receive a validation error; the button also had no disabled appearance or hover explanation.

## Fix

The close action is disabled and visibly grey while the switch is out of service. Its focusable wrapper supplies an explanatory tooltip on hover and keyboard focus, including on narrow screens. Switching to Running enables the action; switching back disables it. Loading, lookup failures, retired machines and an in-flight close also keep the action disabled, and the machine switch is locked during submission. The server-side running-only rule remains unchanged.

## Verification

- 675 smoke checks and offline audit passed; work-order and sidebar UI tests passed.
- Real Chromium checked grey state, hover text, keyboard focus, switch interaction, close behavior, unchanged stock/hours, and tooltip positioning at 320px.
- Three targeted mutations (enabling when stopped, hiding the explanation, not updating after toggling) were detected by the UI tests.
