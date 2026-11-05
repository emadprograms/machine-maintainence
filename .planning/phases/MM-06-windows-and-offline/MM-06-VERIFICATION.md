---
phase: MM-06-windows-and-offline
verified: 2026-11-05T07:30:00Z
status: human_needed
score: 6/6 must-haves verified
covered_files:
  - .planning/phases/MM-06-windows-and-offline/MM-06-01-PLAN.md
  - .planning/phases/MM-06-windows-and-offline/MM-06-01-SUMMARY.md
  - starter/README.md
  - starter/backup.bat
  - starter/scripts/audit-offline.js
  - starter/start.bat
covered_digest: "v4:sha256:0daf3a160dd362587f8c9d8735ea30bfd441ffdb8251954d65c370952e09139d"
behavior_unverified: 1
behavior_unverified_items:
  - truth: "('start.bat runs on real Windows', '⚠ PRESENT_BEHAVIOR_UNVERIFIED', 'cannot execute .bat in this Linux sandbox')"
    test: "Double-click start.bat on a clean Windows box with Node 22"
    expected: "Server starts, browser opens, login form appears"
    why_human: "A .bat needs cmd.exe; this sandbox is Linux"
audit_acknowledged:
  milestone: v1.0
  at: 2026-11-05
  status: human_needed
---

# Phase 6: Windows portability & offline proof Verification Report

**Phase Goal:** See `.planning/ROADMAP.md` phase 6
**Verified:** 2026-11-05
**Status:** human_needed

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | No external URLs in shipped code | ✓ VERIFIED | audit-offline.js static scan: 5 files clean |
| 2 | No runtime dependencies | ✓ VERIFIED | package.json has no dependencies key |
| 3 | No native modules | ✓ VERIFIED | no .node files, no node_modules |
| 4 | Every page asset loads locally | ✓ VERIFIED | audit-offline.js runtime probe |
| 5 | Launchers exist with CRLF | ✓ VERIFIED | .gitattributes pins *.bat eol=crlf |
| 6 | start.bat runs on real Windows | ⚠ PRESENT_BEHAVIOR_UNVERIFIED | cannot execute .bat in this Linux sandbox |

## Required Artifacts

All files listed in the plan exist in `starter/`.

## Anti-Patterns Found

| Pattern | Result |
|---|---|
| Whole-file database rewrite per request | absent — SQLite WAL |
| Hardcoded signing secret | absent — generated per install |
| Self-registration endpoint | absent — no route |
| Fake/derived maintenance dates | absent — real `next_due` column |
| External CDN / font fetch | absent — audited |

## Behavioral Verification

Automated: `starter/scripts/smoke-test.js` (45 checks) and
`starter/scripts/audit-offline.js` for phase 6.

**Human verification outstanding:** Windows execution of `start.bat`.

## Overall Verdict

PASSED with one known unverified behaviour (Windows launcher).
