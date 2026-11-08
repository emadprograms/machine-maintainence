# Debug: sidebar collapse affordance

Date: 2026-11-05. Status: fixed.

## Cause

The previous change moved the control to the top but retained a full-width row with a visible “Collapse” label and a plain chevron. That satisfied the requested location literally but missed the conventional compact sidebar control and took unnecessary space in the navigation.

## Fix

An icon-only panel control sits in the sidebar heading, with an arrow indicating collapse or expansion. In the narrow rail it remains directly under the logo. The dynamic tooltip, accessible name and expanded state communicate the action without visible label text. Existing preference persistence, Ctrl/Cmd+B, keyboard focus and short-screen navigation scrolling remain intact.

## Verification

- 673 smoke checks pass; the shell test covers icon-only markup, accessible labels, keyboard shortcut, state persistence and storage failure.
- Chromium verified the control at the top in expanded and collapsed states, arrow direction, keyboard and reload, short/320px screens, scrolling navigation and technician permissions.
- Four targeted mutations caught a visible label, missing panel icon, broken accessible name and missing arrow reversal.
