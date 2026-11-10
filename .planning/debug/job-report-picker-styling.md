# Debug: job-report attachment picker styling

Date: 2026-11-05. Status: fixed.

## Symptom and root cause
The work-update Job report disclosure used a plain native file input, while Photos and videos used the shared `.stage-photo-picker` upload-card styling. The native control exposed the browser's outdated-looking file button and did not match the adjacent picker.

## Fix
Reused the existing media picker card and upload icon for the job-report input. Added an accessible, live selected-filename display and a control to clear the new selection. Kept the PDF/DOC/DOCX restriction, upload and latest-stage edit/keep/remove semantics unchanged; file names are rendered as text.

## Verification
- Full smoke suite: 697 passed, 0 failed; work-order UI, stage gallery, print and media/report attachment integration suites passed.
- Real Chromium exercised clicking the styled card to open the file chooser, selecting and clearing a report, selecting it again, saving the attachment, and removing the existing report in latest-stage editing. Also exercised large media and responsive mobile layout.
