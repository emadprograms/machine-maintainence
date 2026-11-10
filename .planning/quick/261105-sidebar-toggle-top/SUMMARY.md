# Quick task: sidebar collapse control at the top

The collapse/expand control now sits directly below the sidebar heading and before navigation. Its arrow and accessible label reflect the action in each state, while the existing saved preference and Ctrl/Cmd+B shortcut continue to work. The navigation scrolls within the remaining space on short screens so the top control stays reachable.

Verification: 672 smoke checks passed; the shell interaction test covers navigation, expanded/collapsed labels, preference persistence, keyboard shortcut and storage failures. Chromium verified expanded/collapsed placement, reload, keyboard, short and 320px layouts, scrolling to the last item and technician-only navigation. Five targeted mutations were caught.
