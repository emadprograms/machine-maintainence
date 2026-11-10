# Quick change — Sidebar brand opens dashboard

Removed the separate Dashboard navigation entry. The Machine Maintenance brand is an accessible button that opens the dashboard and marks it current; it remains available in the collapsed sidebar. Replaced the MM placeholder with an inline gear-and-machine logo, with no external assets. Existing sidebar collapse behavior and all dashboard content are retained.

Verification: shell interaction tests cover brand navigation, active state, collapsed sidebar, persistence and the new logo. Chromium desktop and 320px mobile checked pointer and keyboard navigation, layout, collapse persistence and current-page state. Full smoke and offline audit run sequentially.
