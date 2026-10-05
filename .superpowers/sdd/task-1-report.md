# Task 1 Report: Lifecycle Helper, Schema, And Backfill

## Status

Complete.

## TDD Evidence

The required focused RED run was executed after adding the tests and before implementation:

```text
Ran 4 tests
FAILED (errors=4)
```

Failures were the expected missing `tender_lifecycle` module and missing `deadline_date` column.

After implementation, the focused GREEN run passed:

```text
cd backend && .venv/bin/python -m unittest test_admin.TenderLifecycleHelperTest test_admin.TenderLifecycleMigrationTest
Ran 4 tests in 0.037s
OK
```

The backend regression suite also passed:

```text
cd backend && .venv/bin/python -m unittest test_admin.py test_tender_routes.py test_dce_cache.py
Ran 40 tests in 1.098s
OK
```

## Implementation

- Added deadline normalization and SQL lifecycle expression helpers in `backend/tender_lifecycle.py`.
- Added idempotent tender lifecycle columns, indexes, and deadline-date backfill in `backend/database.py`.
- Added the required lifecycle helper and migration tests in `backend/test_admin.py`.

## Concerns

None.

---

## Review Fix: Deadline Validation

### Status

Complete.

### TDD Evidence

After adding malformed and impossible-deadline coverage, the focused RED run failed as expected:

```text
Ran 5 tests in 0.059s
FAILED (failures=2)
```

The failures showed that `31/02/2020` was normalized to `2020-02-31` by both
the SQL helper expression and the migration backfill.

After the fix, the requested focused GREEN run passed:

```text
cd backend && .venv/bin/python -m unittest test_admin.TenderLifecycleHelperTest test_admin.TenderLifecycleMigrationTest
Ran 5 tests in 0.072s
OK
```

The requested backend regression suite also passed:

```text
cd backend && .venv/bin/python -m unittest test_admin.py test_tender_routes.py test_dce_cache.py
Ran 41 tests in 1.181s
OK
```

### Fix

- `deadline_date_expr()` now accepts only trimmed, exact `DD/MM/YYYY` or
  `DD/MM/YYYY HH:MM` values whose SQLite canonical date/time equals the input.
- The schema backfill now uses `deadline_date_expr()`, preventing its rules
  from drifting from lifecycle state evaluation.
- Added Python and SQL regression cases for impossible dates, malformed dates,
  and invalid times; invalid values remain normalized as `NULL` and state
  `unknown`.

### Concerns

None.

---

## Re-review Fix: Repair Populated Deadline Cache

### Status

Complete.

### TDD Evidence

Added an upgrade-path regression that seeds lifecycle columns already present
with the previous fabricated value `2020-02-31` for source deadline
`31/02/2020`, plus a mismatched cached value for a valid source deadline.

The focused RED run failed before the repair migration:

```text
cd backend && .venv/bin/python -m unittest test_admin.TenderLifecycleMigrationTest
Ran 2 tests in 0.058s
FAILED (failures=1)
```

The failure showed the old migration retained populated `2020-02-31`.

After the repair, the required focused GREEN run passed:

```text
cd backend && .venv/bin/python -m unittest test_admin.TenderLifecycleHelperTest test_admin.TenderLifecycleMigrationTest
Ran 6 tests in 0.102s
OK
```

### Fix

- The lifecycle migration now reconciles every `deadline_date` against the
  validated source-deadline expression using SQLite's null-safe `IS`
  comparison.
- Invalid cached ISO dates are cleared, and populated values that disagree
  with a valid source deadline are recomputed during upgrade.

### Concerns

None.
