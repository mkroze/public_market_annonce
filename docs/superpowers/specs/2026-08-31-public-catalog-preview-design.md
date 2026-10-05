# Public Catalog Preview Design

Date: 2026-08-31

## Context

Logged-out visitors currently hit the login experience before they can inspect real tender data. That makes the service feel closed too early and prevents visitors from evaluating whether the catalog is useful. The product should let visitors browse the live catalog and open a lightweight tender detail, while keeping account-value actions behind authentication.

This design intentionally changes the contract from the earlier logged-out homepage slice that kept `/api/tenders` private. The new public surface is still read-only and limited to catalog discovery.

## Goals

- Let logged-out users browse the real tender catalog.
- Let logged-out users open a lightweight tender detail page.
- Keep high-value actions and operational participation details behind login.
- Make the login wall contextual instead of replacing the entire product with a form.
- Preserve the existing authenticated member experience.
- Keep backend access control as the source of truth.

## Non-Goals

- No pricing or subscription logic.
- No anonymous DCE download.
- No anonymous PDF or list export.
- No anonymous alerts or favorites.
- No public admin, scrape, stats, cities, regions, sectors, or assistant endpoints.
- No redesign of the catalog or tender detail page beyond the login-aware states needed for this feature.

## Public Surface

The following frontend routes should be reachable without a logged-in user:

- `/`
- `/tenders`
- `/tenders/:id`
- `/login`
- `/register`
- existing content and legal pages

The following backend routes should be publicly readable:

- `GET /api/tenders`
- `GET /api/tenders/{tender_id}`
- `GET /api/filters`
- existing auth entry points

The following backend routes remain authenticated:

- `GET /api/tenders/export`
- `GET /api/tenders/{tender_id}/pdf`
- `GET /api/tenders/{tender_id}/dce`
- `/api/alerts`
- `/api/favorites`
- `/api/admin`

Retired/non-launch public endpoints remain hidden as today:

- `/api/stats`
- `/api/cities`
- `/api/regions`
- `/api/sectors`
- `/api/blog`
- `/api/assistant/ask`
- `/api/scrape/status`

## Catalog Behavior

Logged-out users can use the same catalog page structure as logged-in users:

- search
- filters
- status segments
- pagination
- guided card view
- expert table view
- tender detail navigation

Logged-out users cannot export results. The export control should be replaced by a compact login CTA when results are available. The CTA should explain that exports are available after login.

Logged-in users keep the current export behavior.

## Tender Detail Behavior

Logged-out users can see the lightweight detail:

- title
- reference
- buyer
- location
- deadline and urgency
- category
- procedure
- type of notice when available
- summary signal cards for deadline, estimation, caution, DCE availability, candidatures, and market price
- decision checklist
- high-level domain and participation conditions such as allotissement, qualifications, agrements, variantes, reunion, visite, and PME reservation when available

Logged-out users should see contextual login walls for:

- DCE download
- PDF export
- official source portal link
- contact block
- withdrawal address
- deposit address
- opening location
- future favorites and alert actions

The login wall should use direct CTAs:

- primary: create account
- secondary: log in

After authentication, users should land back on the tender or catalog path they came from.

## API Client Behavior

The frontend API client currently treats any `401` as an expired session and redirects to `/login`. That behavior is still right for authenticated actions, but public read pages should not be forced into a redirect loop when a visitor has no token.

The client should support one of these equivalent patterns:

- keep catalog reads on endpoints that no longer return `401` anonymously, and only call authenticated actions from logged-in UI; or
- add a no-redirect option to `fetchJSON` for public reads if needed.

Authenticated action failures should still clear invalid tokens and move the user to login.

## Backend Authorization Design

Update the v1 API surface guard so public read routes are allowed without a token:

- login/register stay public
- `GET /api/tenders` stays on the allowed surface and becomes public
- `GET /api/tenders/{tender_id}` becomes public only for the detail route
- `GET /api/filters` becomes public
- DCE/PDF/export routes stay authenticated even though they live under `/api/tenders`

Because tender IDs may contain slashes, the guard must distinguish suffix action routes before allowing catch-all detail reads:

- paths ending in `/dce` require auth
- paths ending in `/pdf` require auth
- `/api/tenders/export` requires auth
- other `GET /api/tenders/...` detail paths are public

Handlers for alerts, favorites, and admin keep their existing `require_user` or role checks.

## Components

Expected frontend edits:

- `App.tsx`: remove the auth guard around `/tenders` and `/tenders/:id`; keep `/alerts` protected.
- `Tenders.tsx`: read `useAuth`; show export for logged-in users and a login CTA for logged-out users.
- `TenderDetail.tsx`: read `useAuth`; render logged-in actions as today and replace locked sections/actions with login CTAs for visitors.
- optional small helper component for a reusable locked-action panel if it keeps `TenderDetail.tsx` clear.

`Navbar` should keep `Consultations` visible to logged-out users. `Alertes` should be visible only to logged-in users, because alert management is not part of the public surface. Logged-out users should reach alerts through contextual login CTAs, not through primary navigation.

## Error Handling

- Public catalog read failures show the existing catalog error state.
- Public tender detail read failures show the existing detail error state.
- Locked action buttons should not call protected endpoints for logged-out users.
- If a logged-in user's token is expired, protected action calls still clear the token and redirect to login.
- If the backend denies a protected action, show the existing error/toast flow where applicable.

## Testing

Backend tests:

- update the v1 API surface test so anonymous `GET /api/tenders`, `GET /api/tenders/{id}`, and `GET /api/filters` are not rejected by the middleware.
- assert anonymous `GET /api/tenders/export`, `GET /api/tenders/{id}/pdf`, `GET /api/tenders/{id}/dce`, `/api/alerts`, `/api/favorites`, and `/api/admin` remain gated.
- preserve the route matching tests for slash-bearing tender IDs.

Frontend verification:

- `cd frontend && npm run build`
- logged-out `/tenders` loads catalog data.
- logged-out `/tenders/:id` loads light detail.
- logged-out export/DCE/PDF/source/contact/address interactions show login CTAs instead of firing protected requests.
- logged-in catalog and tender detail actions continue to work.
- `/alerts` still redirects logged-out users to login.

## Acceptance Criteria

- Logged-out users can browse the live tender catalog.
- Logged-out users can open tender detail pages without seeing the full member-only action set.
- DCE download, PDF/export, official source link, contact, addresses, alerts, favorites, admin, scrape, and retired analytics endpoints remain unavailable without login.
- Existing logged-in behavior remains intact.
- Backend tests document the new public-read/private-action contract.
