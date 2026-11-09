# Quick summary: machine details, media and stage reports

- Added optional machine model and serial number to create/edit, migration, list/search and job print.
- Streamed JPEG/PNG/WebP and MP4/MOV/WebM uploads for machines, reported faults and stage updates, with no 2 MB limit. Media responses support authenticated byte ranges. Legacy inline stage images remain supported with a bounded JSON body.
- Added one optional PDF/DOC/DOCX report per stage after media, with authenticated attachment downloads, owner-scoped temporary uploads, transactional association and cleanup on replacement, stage deletion and machine cascade deletion. Pending uploads expire after 24 hours and are pruned on upload or startup. Database backups require copying the photos folder separately.
- Preserved latest-stage admin restrictions, stock reconciliation, parts-only costs and historical records.
- Verification: full smoke 690 passed; offline audit OFFLINE-SAFE; dedicated streamed-media test covers >2 MB media, format validation, byte ranges, ownership and authentication, stock rollback, expiration, replacement and cascade cleanup. Focused UI/print/photo cleanup suites passed. Real Chromium desktop/mobile exercised machine fields, machine/fault/stage video, large photo, report attachment/removal, previews and print. Chromium parts-only regression passed.
- Existing preview database migration preserved 5 machines and 16 work orders; model and serial columns added in place.
