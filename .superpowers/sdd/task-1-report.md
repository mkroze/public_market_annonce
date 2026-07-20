# Task 1 Report: Route-Safe Tender IDs And Deadline Helpers

## Status

DONE

## Commit

- `e34a0eb feat: add route-safe tender helpers`

## Implementation

- Added `frontend/src/lib/tenderUtils.ts` with the specified route ID and deadline urgency helpers.
- Updated tender table row navigation and title links to use encoded tender paths, and replaced local deadline calculations with `getTenderUrgency`.
- Decoded the detail route ID before loading a tender or requesting DCE/PDF downloads.
- Kept the existing `/tenders/:id` route unchanged because it already matches the specified route shape.

## Verification

- `cd frontend && npm run build` completed successfully: TypeScript compilation and Vite production build both exited 0.
- Reviewed commit `e34a0eb` against the brief: all helper interfaces and required table/detail usages are present; no direct tender-detail navigation interpolation remains in `TenderTable.tsx`.

## Concerns

None.

---

# Task 1 Review Fix Report

## What I Fixed

- Encoded tender IDs in the `getTender`, `downloadDce`, and `downloadPdf` API helpers.
- Updated the tender detail, PDF, and DCE backend routes to accept slash-bearing IDs. The generic detail route is registered after the specific download routes so their suffixes resolve correctly.
- Parsed French `DD/MM/YYYY` deadlines before falling back to `Date.parse`.
- Corrected the detail-page label to `Échéance`.
- Added a focused backend route regression test for slash-bearing IDs.

## Tests/Commands Run And Results

- `cd backend && .venv/bin/python -m unittest test_tender_routes.py` - passed.
- `cd backend && .venv/bin/python -m py_compile main.py` - passed.
- French deadline parser check for `01/02/2026` - passed as local date `2026-02-01`.
- `cd frontend && npm run build` - passed.

## Files Changed

- `backend/main.py`
- `backend/test_tender_routes.py`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/tenderUtils.ts`
- `frontend/src/pages/TenderDetail.tsx`
- `.superpowers/sdd/task-1-report.md`

## Concerns

None.
