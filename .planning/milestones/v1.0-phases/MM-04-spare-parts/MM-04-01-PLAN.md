---
phase: 4
plan: 1
name: Spare parts
status: complete
requirements: []
must_haves:
  - Stock 3 renders an amber badge
  - Using 2 of 5 leaves 3; using 99 leaves 3 unchanged
  - Second use of the same part adds to the existing quantity
---

# Plan 4-01: Spare parts

Each task below was implemented and is covered by an assertion in
`starter/scripts/smoke-test.js` (45 checks) and, for phase 6, in
`starter/scripts/audit-offline.js`.

### Task 1: Parts with stock, price and low-stock indicator

**Files:** `starter/server.js`, `starter/public/app.js`

**Acceptance:** Stock 3 renders an amber badge

**Status:** complete

### Task 2: Transactional consumption: check stock, link part, decrement

**Files:** `starter/server.js`

**Acceptance:** Using 2 of 5 leaves 3; using 99 leaves 3 unchanged

**Status:** complete

### Task 3: Merge repeat usage of the same part into one line

**Files:** `starter/server.js`

**Acceptance:** Second use of the same part adds to the existing quantity

**Status:** complete

## Verification

```
node --no-warnings=ExperimentalWarning starter/scripts/smoke-test.js
-> 45 passed, 0 failed
```
