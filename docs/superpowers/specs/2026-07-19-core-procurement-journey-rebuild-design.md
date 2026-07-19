# Core Procurement Journey Rebuild Design

Date: 2026-07-19

## Goal

Rebuild the app's core procurement journey so a Moroccan SME bid manager can move from discovery to decision to action without getting blocked by routing, loading, mobile filtering, unclear tender status, or recall-heavy alert setup.

## Scope

In scope:

- Overview launchpad
- Consultations workbench
- Tender detail decision page
- Favorite and alert handoff
- Guide assistant handoff from a selected tender
- Obvious blocker-level visual defects in this path

Out of scope for this pass:

- Full information architecture redesign
- Blog, partners, and pricing redesign beyond blocking layout bugs
- New backend data model migrations unless required for the existing route/API contract
- Payment/subscription behavior

## Primary Actor

Bid manager at a small or mid-sized Moroccan company.

They need to:

- Find relevant active tenders quickly.
- Understand whether a tender is worth pursuing.
- Save or monitor relevant opportunities.
- Prepare the candidacy using the app's guidance tools.

## Target Journey

1. Land on overview.
   - User sees whether data is available, when it was last updated, and how many actionable opportunities exist.
   - If data or API loading fails, user sees a plain-language failure state and retry/import actions.

2. Search consultations.
   - User starts with searchable results, not a wall of controls.
   - On desktop, filters remain efficient and visible.
   - On mobile, advanced filters collapse behind a clear control, while active filter chips and result counts remain visible.

3. Compare tenders.
   - User can scan title, buyer, location, estimate, deadline, and urgency.
   - Default view prioritizes active/actionable opportunities.
   - Expired or closed tenders are not mixed into the default list without clear labeling.

4. Inspect a tender.
   - Clicking a tender reliably opens detail, including tender IDs that contain slashes.
   - The page leads with decision-critical summary facts.
   - Documents, original portal link, save, alert, and candidacy preparation actions are visible and understandable.

5. Act.
   - User can save a tender or create a similar alert.
   - If unauthenticated, the app returns the user to the original tender or intent after login/register.
   - Alerts can be created from current search filters or tender context without requiring users to type sector codes.

6. Prepare candidacy.
   - Guide assistant receives tender context when available.
   - The assistant feels like the next step in the tender workflow, not a disconnected content page.

## UX Principles Applied

- Visibility of system status: show loading, failure, retry, import status, and data freshness.
- Match with real world: use procurement terms consistently in French with correct accents.
- User control and freedom: preserve return paths after login and allow users to clear filters or back out.
- Consistency and standards: use real links for navigation and accessible controls for actions.
- Error prevention: encode or route tender IDs safely; avoid ambiguous date parsing.
- Recognition over recall: use sector/location selectors and chips instead of manual sector-code entry.
- Flexibility and efficiency: keep power filters for desktop while reducing mobile friction.
- Aesthetic and minimalist design: show the right controls at the right step, not all controls upfront.
- Error recovery: give concrete next actions when API, export, DCE, or detail loading fails.

## Page Designs

### Overview Launchpad

The overview should become a dashboard-like entry point:

- Header: "Marchés Publics" with concise value copy.
- Status row: total active opportunities, urgent deadlines, last import/update status, and a clear import/retry action.
- Primary CTA: "Voir les consultations".
- Quick links: top categories, sectors, or locations leading to filtered consultations.
- Error/empty states:
  - API unavailable: explain the data cannot be loaded and offer retry.
  - Empty database: explain that import is needed and show import action.
  - Import in progress: show progress/status, not only a spinner.

### Consultations Workbench

The consultations page remains the main productivity screen:

- Header: result count, selected status segment, export action.
- Status segments: Active, Urgent, Expirées/Clôturées, Toutes.
- Search input always visible.
- Active filter chips visible above results.
- Desktop: advanced filters visible in a compact two-row panel.
- Mobile: advanced filters collapsed by default, with a count of active filters.
- Results:
  - Title is a real link to detail.
  - Row/card displays buyer, location, estimate, deadline, and urgency.
  - Deadline is parsed from normalized data, not browser-dependent string parsing.
  - Expired items have clear labels and lower visual priority.

### Tender Detail Decision Page

The tender detail page should prioritize decision-making:

- Reliable route handling for tender IDs with slashes.
- Back link to previous search context when possible.
- Summary block:
  - Object/title
  - Buyer
  - Location
  - Deadline and urgency
  - Estimate and caution when available
  - Procedure/category/status
- Primary actions:
  - Préparer ma candidature
  - Sauvegarder
  - Créer une alerte similaire
  - Télécharger DCE
  - Export PDF
  - Voir sur marchespublics.gov.ma
- Sections below: addresses, participation conditions, meetings/visits, contact.
- Failure states for detail, DCE, and PDF should name the failed action and offer retry or portal fallback.

### Favorites And Alerts

Favorites and alerts should support the journey:

- Unauthenticated save/alert actions redirect to login with return intent.
- After login/register, user returns to the tender or alert creation flow.
- Alert creation from search:
  - Pre-fill keywords, category, sector, location, buyer, and status from filters.
- Alert creation from tender:
  - Pre-fill tender category, sector, location, and buyer.
- Alert form should use selectors/chips where data exists. Free text remains available for keywords.
- Existing alert toggles should be actionable, not read-only.

### Guide Assistant Handoff

The guide remains broad, but tender-origin flows should open the assistant section with context:

- Tender detail CTA links to guide assistant with the selected tender ID.
- Assistant shows the tender context summary when available.
- User can continue manually if tender context cannot load.

## Technical Design Notes

- Use `encodeURIComponent` or a route-safe stable tender identifier before navigating to detail. If API endpoints require the raw ID, decode at the API boundary.
- Add a reusable API state pattern for loading, error, empty, and success states in the core pages.
- Replace `new Date(deadline)` parsing on localized deadline strings with a helper that accepts normalized ISO data or explicitly parses the known `DD/MM/YYYY HH:mm` format.
- Preserve search parameters when navigating from list to detail where possible.
- For unauthenticated intent, store a short return URL and action intent in location state or query params.
- Keep styling aligned with the current academic theme and avoid broad visual-system rewrites.

## Acceptance Criteria

- A tender with an ID containing slashes can be opened from the consultations list.
- Overview never remains on an indefinite spinner after an API failure.
- Consultations mobile view shows search and results access before advanced filters.
- Default consultations view distinguishes active from expired/closed tenders.
- Tender detail exposes save, alert, candidacy, DCE/PDF, and portal actions in the first decision area when available.
- Creating an alert from search or tender context does not require typing sector codes manually.
- Unauthenticated favorite/alert intent returns the user to the intended tender/action after login or registration.
- Pricing badge overlap is fixed if touched during visual cleanup.
- Build completes successfully.

## Verification Plan

- Run the frontend build.
- Manually inspect desktop and mobile screenshots for:
  - overview
  - consultations
  - tender detail from a slash-containing ID
  - login return flow
  - alert creation
- Verify API failure states by temporarily stopping or misrouting the API in local development.
- Verify date urgency with active, urgent, and expired sample deadlines.
