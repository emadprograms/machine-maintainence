---
phase: MM-02-auth-and-users
plan: 1
subsystem: auth
tags: [node, sqlite, vanilla-js, offline]
provides:
  - scrypt password hashing with timingSafeEqual verification
  - Per-install signing secret in data/secret.txt — no hardcoded fallback
  - HttpOnly cookie sessions; logout revokes server-side
  - Admin-only user creation; no public registration route exists
  - Disabling a user takes effect on the next request and next login
affects: [Auth & users]
actuals:
  tokens: 0
  tasks: 6
  commits: 0
tech-stack:
  added: [node:sqlite, node:http, node:crypto]
  patterns: [single-table-router, ensureColumn-migrations, transactional-consume]
key-files:
  created: []
  modified: [server.js, auth.js, public/app.js]
key-decisions:
- "No public sign-up: the reviewed repo's worst hole (manager self-registration)"
- "Sessions in memory: restart signs everyone out, documented as a limitation"
duration: 1 session
completed: 2026-11-05
status: complete
---

# Phase 2: Auth & users Summary

**Delivered, and verified by the smoke test rather than asserted.**

## Accomplishments
- scrypt password hashing with timingSafeEqual verification
- Per-install signing secret in data/secret.txt — no hardcoded fallback
- HttpOnly cookie sessions; logout revokes server-side
- Admin-only user creation; no public registration route exists
- Disabling a user takes effect on the next request and next login

## Decisions & Deviations
- GET routes were unauthenticated in the first draft — route guard only ran for non-GET
- route() needed a second opts parameter; Object.assign tagged the inner function
- Self-disable guard compared 0 to boolean false and never fired

## Files Created/Modified
- `starter/server.js`
- `starter/auth.js`
- `starter/public/app.js`

## Verification
Covered by `starter/scripts/smoke-test.js`. Full suite: **45 passed, 0 failed**.

## Next Phase Readiness
Ready for phase 3.
