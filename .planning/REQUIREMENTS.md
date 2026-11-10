# Requirements: Machine Maintenance

**Status:** No milestone in progress. v1.0, v1.1, v2.0 and v3.0 are shipped and archived.

This file is the live spec for the milestone currently being built. While nothing is
being built it stays short and points at the archive:

| Milestone | Requirements | Shipped |
|---|---|---|
| v1.0 Lean core, offline, on Windows | `.planning/milestones/v1.0-REQUIREMENTS.md` | 2026-11-05 |
| v1.1 Operable | `.planning/milestones/v1.1-REQUIREMENTS.md` | 2026-11-05 |
| v2.0 Dashboard | `.planning/milestones/v2.0-REQUIREMENTS.md` | 2026-11-05 |
| v3.0 The record | `.planning/milestones/v3.0-REQUIREMENTS.md` | 2026-11-06 |

Every requirement in all four has been validated; the evidence for each is in
`.planning/milestones/<version>-phases/`, one verification report per phase.

## Starting the next milestone

Run `/gsd-new-milestone`. The opening decision is what the app should answer next, not
which features to add. The two candidates raised and declined in 2026-11-06 were "Trust"
(an audit trail, a verified off-folder backup, a restore rehearsal) and "In the workshop"
(phone layout, a printable job sheet, quick actions). The audit trail remains the largest
gap: who changed what is still not recorded anywhere.
