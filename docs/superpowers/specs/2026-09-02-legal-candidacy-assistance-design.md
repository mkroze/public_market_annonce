# Legal & Candidacy Assistance Design

## Goal

Restore Epic 1 as a contained "Preparer" product surface that reintroduces legal and candidacy assistance without destabilizing the launch catalog. The restored surface must keep the tender catalog as the primary public experience, add practical legal tooling around it, and protect the Anthropic-backed AI assistant behind account authentication.

## Scope

This epic restores:

- `/guide` as the public preparation hub.
- `/procedures` and `/procedures/:slug` as public static procedure references.
- `/recours` as a public static recours deadline helper.
- `/eligibility` as a public static eligibility checker.
- `/assistant` as an account-only candidacy assistant with optional tender prefill via `?tender=<id>`.
- Legal tooltip annotations on selected `TenderDetail` fields where `lib/compliance.ts` already provides matching legal references.

This epic does not restore the broader v0 public surface: stats, geographic directories, map exploration pages, partners, blog, pricing, calculator, or marketing pages beyond the current catalog-oriented shell.

## Current Context

The active branch is `next-prod`. The branch already contains the live catalog, member area, DCE cache work, and the current navy institutional reskin. The stripped Epic 1 pages are recoverable from git history at `f9e0fef^:frontend/src/pages/<Page>.tsx`.

The backend endpoint for the AI assistant is still live at `POST /api/assistant/ask`, implemented in `backend/main.py` and grounded in `backend/legal_context.py`. The frontend API client already exports `askAssistant()`. Render must define `ANTHROPIC_API_KEY`; without it, the endpoint returns a 503 configuration error.

Reusable frontend building blocks already exist in-tree:

- `frontend/src/components/LegalAssistantSidebar.tsx`
- `frontend/src/components/LegalTooltip.tsx`
- `frontend/src/components/ComplianceChecklist.tsx`
- `frontend/src/lib/compliance.ts`
- `frontend/src/lib/procedures.ts`

## Product Behavior

### Navigation

Add a restrained "Preparer" entry to the primary public navigation. It should point to `/guide`, use a lucide legal/preparation icon, and follow the existing rounded pill active state. It should not crowd the catalog-first positioning: "Consultations" remains the first nav item.

### Guide Hub

`/guide` is the public hub for preparation content. It presents the restored static tools in one coherent page:

- procedures overview
- eligibility checker
- recours helper
- assistant entry point

The old `/guide` imported a removed `Calculator` page. This epic must not restore that calculator. The guide should omit the calculator section and use the existing procedures, eligibility, recours, and assistant modules instead.

When the user is signed in, the assistant section may embed or link directly to the candidacy assistant. When the user is signed out, it should show a compact account-gated call to action linking to `/login` and `/register`, preserving the intended destination.

### Account-Only Assistant

`/assistant` must be protected with the existing `RequireAuth` wrapper. Signed-out users are redirected to `/login` with the current route in `state.from`.

For signed-in users, the assistant page restores the previous candidacy workflow:

- optional tender prefill from `?tender=<id>` via `getTender()`
- guessed procedure and prestation type from tender data
- editable market parameters
- threshold alerts
- price risk calculation
- declaration-on-honor requirements
- persistent local checklist state per tender/procedure
- `LegalAssistantSidebar` chat grounded by the selected procedure name

If the Anthropic key is missing or invalid, the existing client error from `askAssistant()` should surface inside the assistant sidebar without breaking the rest of the page.

### Static Legal Tools

`/procedures` restores the procedure directory from `lib/procedures.ts` and links each procedure to `/procedures/:slug`.

`/procedures/:slug` restores the detail page with:

- timeline
- document checklist grouped by phase
- commission information
- deadlines
- legal references
- cross-links to eligibility and recours

`/eligibility` restores the article 27 questionnaire using local component state. The verdict updates immediately as answers change.

`/recours` restores the article 163/164 helper. It calculates indicative deadlines from a selected motif and reference date using local date logic.

All static legal tools remain public because they do not call paid AI endpoints and can support discovery.

### Tender Detail Tooltips

Attach `LegalTooltip` to selected existing labels in `TenderDetail.tsx` only where `FIELD_ANNOTATIONS` already has a clear field key:

- procedure badge or procedure signal: `procedure`
- budget estimate signal: `montant`
- caution signal or caution-related field: `caution-provisoire`
- qualifications field: `qualifications`

Do not add vague tooltips to fields without a matching annotation. Do not reorganize TenderDetail beyond the label-level attachment needed for this epic.

## Visual Design

The restored pages must match the current institutional reskin, not the older pre-reskin page style.

Use:

- `institutional-page` design tokens already defined in `frontend/src/index.css`
- `PageShell` and `Breadcrumbs` where they fit page-level layout
- `shadow-card`, `rounded-xl`, and current navy/white surface tokens
- lucide icons for navigation and controls
- pill buttons and existing DaisyUI button classes where the surrounding code already uses them
- dense but readable operational layouts for forms, checklists, and decision panels

Avoid:

- returning to the older red/crimson visual emphasis except through compatibility aliases already mapped to navy
- decorative marketing hero sections
- nested cards
- one-off raw hex colors inside restored page components
- hover-only interactions without keyboard focus states

## Accessibility And Interaction

All restored interactive controls must have:

- visible focus states
- 44px minimum touch target where practical for primary interactive controls
- accessible labels for icon-only buttons
- no horizontal scroll at 375px viewport width
- loading and error states for assistant/tender prefill operations
- keyboard-reachable dropdowns/tooltips using the existing DaisyUI pattern where possible

The fixed `LegalAssistantSidebar` must not fully obscure focused content. On small screens it should fit within `calc(100vw - 2rem)` and keep its close/send controls keyboard accessible.

## Architecture

Use route-level pages under `frontend/src/pages` and avoid introducing a new global state layer. The existing data modules already form the domain boundary:

- `lib/procedures.ts` owns static procedure, eligibility, recours, and price-risk reference data.
- `lib/compliance.ts` owns threshold validation, money parsing, tender guessing, declaration requirements, and field annotations.
- `lib/api.ts` owns the assistant and tender fetch calls.

The assistant page may keep local state for form inputs, loaded tender, and checklist selections. Checklist persistence remains in `localStorage`, keyed by tender id and procedure slug.

## Files

Expected restored or modified files:

- Restore/create `frontend/src/pages/CandidacyAssistant.tsx`
- Restore/create `frontend/src/pages/Procedures.tsx`
- Restore/create `frontend/src/pages/ProcedureDetail.tsx`
- Restore/create `frontend/src/pages/Recours.tsx`
- Restore/create `frontend/src/pages/Eligibility.tsx`
- Restore/create `frontend/src/pages/Guide.tsx`
- Modify `frontend/src/App.tsx` for routes and assistant auth gate
- Modify `frontend/src/components/Navbar.tsx` for the "Preparer" link
- Modify `frontend/src/pages/TenderDetail.tsx` for selected `LegalTooltip` attachments
- Optionally modify `frontend/src/components/LegalAssistantSidebar.tsx`, `frontend/src/components/ComplianceChecklist.tsx`, or `frontend/src/components/LegalTooltip.tsx` only for reskin/accessibility alignment

No backend files should be changed for this epic.

## Testing And Verification

Use test-first implementation for behavior that can regress:

- route availability and auth gating for `/assistant`
- guide links and omission of the removed calculator section
- eligibility verdict behavior, if a React test harness is added or already available
- compliance helper behavior through TypeScript-safe usage, if direct unit testing is practical

If the repo does not have a frontend test harness, do not add a heavy testing stack solely for this epic unless the implementation plan explicitly justifies it. At minimum, verification must include:

- `npm run build` from `frontend`
- lint if the project lint command runs locally
- browser smoke checks for `/guide`, `/assistant` signed-out redirect, `/procedures`, one `/procedures/:slug`, `/eligibility`, `/recours`, and a tender detail page

## Rollout Notes

Render configuration must include `ANTHROPIC_API_KEY` before `/assistant` is promoted as a paid/member value. Without the key, the rest of Epic 1 remains usable, and the assistant chat should display the backend configuration error instead of crashing.

This epic is intentionally compartmentalized. It should be shippable independently from later restoration epics for geographic directories, statistics, blog/marketing, or calculator tooling.
