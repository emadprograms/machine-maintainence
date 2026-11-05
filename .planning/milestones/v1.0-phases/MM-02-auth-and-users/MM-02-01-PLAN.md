---
phase: 2
plan: 1
name: Auth & users
status: complete
requirements: []
must_haves:
  - Stored hash starts with scrypt$; wrong password fails
  - Secret file exists after first run; source contains no secret
  - Old cookie rejected after logout
  - User list never contains password hashes; technician gets 403
  - Disabled user gets 403 at login
  - Second start does not print the creation banner
---

# Plan 2-01: Auth & users

Each task below was implemented and is covered by an assertion in
`starter/scripts/smoke-test.js` (45 checks) and, for phase 6, in
`starter/scripts/audit-offline.js`.

### Task 1: scrypt hashing + verification with timingSafeEqual

**Files:** `starter/auth.js`

**Acceptance:** Stored hash starts with scrypt$; wrong password fails

**Status:** complete

### Task 2: Per-install secret written to data/secret.txt; no hardcoded fallback

**Files:** `starter/auth.js`, `starter/db.js`

**Acceptance:** Secret file exists after first run; source contains no secret

**Status:** complete

### Task 3: HttpOnly cookie session with server-side revocation on logout

**Files:** `starter/server.js`

**Acceptance:** Old cookie rejected after logout

**Status:** complete

### Task 4: Admin-only user creation with validation; no public register route

**Files:** `starter/server.js`, `starter/public/index.html`, `starter/public/app.js`

**Acceptance:** User list never contains password hashes; technician gets 403

**Status:** complete

### Task 5: Disable/enable a user, taking effect immediately

**Files:** `starter/server.js`

**Acceptance:** Disabled user gets 403 at login

**Status:** complete

### Task 6: First-run admin password printed once, never reseeded

**Files:** `starter/server.js`

**Acceptance:** Second start does not print the creation banner

**Status:** complete

## Verification

```
node --no-warnings=ExperimentalWarning starter/scripts/smoke-test.js
-> 45 passed, 0 failed
```
