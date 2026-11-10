# Quick change — Sidebar and Settings

Reports is last in the sidebar, after Spare parts. Admins & Technicians and Backup are accessed through the main top-bar Settings dialog instead of the sidebar. The administrator pages retain their actions and provide a way back to Settings; the existing workshop time-zone control remains available. Technicians can view the time zone but cannot see or open administrator options. API role enforcement remains in place. Settings loads arriving after navigation cannot refocus a closed dialog.

Verification: the settings UI test covers ordering, role visibility, navigation and stale lookups; Chromium desktop and 320px mobile covered account creation, backup, time-zone changes, navigation and technician permissions. Full smoke and offline audit run sequentially.
