# Task 2 Report: Consultations Workbench And Mobile Filter Collapse

## Implemented

- Added query-driven consultation status segments: En cours, Urgentes, Expirées, and Toutes.
- Defaulted status to `en_cours` only when the URL does not provide a `status` parameter.
- Implemented `urgent=true` as a route-local state. It requests active tenders only and filters the returned rows client-side using `getTenderUrgency`; no unsupported `urgency` parameter is sent to the API.
- Added API error feedback with a retry action.
- Collapsed advanced filters by default below the `md` breakpoint while keeping search and the primary apply action visible.
- Preserved the existing route-safe title link and added the specified crimson hover state.

## Verification

- `cd frontend && npm run build` completed successfully.
- `git diff --check` completed without whitespace errors.

## Concern

- The required mobile screenshot could not be captured. The installed Playwright CLI had no WebKit executable; two approved `playwright install webkit` attempts stopped before installation completed, so `playwright screenshot` could not launch the browser.
