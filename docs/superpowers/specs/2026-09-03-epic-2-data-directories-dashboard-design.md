# Epic 2 Data Directories & Dashboard Design

Date: 2026-09-03
Status: approved

## Context

Epic 2 restores the data directory surface that was removed during the v1 catalog-only pass. The backend endpoints are already live for cities, regions, sectors, stats, and overview data. TypeScript API helpers and response types are also present. The missing work is the frontend route/page restoration, current-theme reskin, and polish around the dashboard, charts, tables, and existing Morocco map.

The logged-out homepage decision is explicitly deferred to Epic 4. This epic must not change root-route behavior or introduce a public homepage.

## Goals

- Restore `/stats`, `/cities`, `/cities/:name`, `/regions`, `/regions/:name`, `/sectors`, and `/sectors/:code`.
- Reuse live backend routes: `/api/stats`, `/api/overview`, `/api/cities`, `/api/regions`, and `/api/sectors`.
- Restore `Stats.tsx`, `stats/OverviewTab.tsx`, `Cities.tsx`, `CityDetail.tsx`, `Regions.tsx`, `RegionDetail.tsx`, `Sectors.tsx`, and `SectorDetail.tsx` where useful from git history.
- Use the historical `Overview.tsx` only as an implementation reference for overview/dashboard content; do not restore it as a routed homepage in Epic 2.
- Wire the existing `MoroccoMap.tsx` into the cities experience.
- Reskin all restored pages to match the current institutional UI and navigation patterns.
- Keep standalone directory detail routes alive for deep links.

## Non-Goals

- No logged-out homepage implementation.
- No root-route behavior change.
- No authentication policy change.
- No new backend endpoints unless verification exposes a contract mismatch.
- No new charting or map dependency.
- No admin-app changes.

## Routing

Public app routes to add or restore:

- `/stats` renders the dashboard shell.
- `/stats?tab=villes` renders cities inside the dashboard shell.
- `/stats?tab=regions` renders regions inside the dashboard shell.
- `/stats?tab=secteurs` renders sectors inside the dashboard shell.
- `/cities` renders the standalone cities directory.
- `/cities/:name` renders city detail.
- `/regions` renders the standalone regions directory.
- `/regions/:name` renders region detail.
- `/sectors` renders the standalone sectors directory.
- `/sectors/:code` renders sector detail.

The root route remains unchanged for Epic 2. Logged-out homepage behavior belongs to Epic 4.

## Dashboard Design

`frontend/src/pages/Stats.tsx` becomes a compact tab shell:

- Page title: `Statistiques`
- Query-param tabs: `Vue d'ensemble`, `Villes`, `Régions`, `Secteurs`
- Active tab comes from `tab=villes|regions|secteurs`; absent or unknown values render overview.
- Tab changes update search params so the state is bookmarkable and browser back/forward friendly.

`frontend/src/pages/stats/OverviewTab.tsx` owns the overview fetch from `getStats()` and renders:

- KPI strip when `data.kpis` exists: active tenders, tenders closing within seven days, tenders added within seven days, distinct buyers.
- Category distribution from `by_category`.
- Top sectors list.
- Top buyers list.
- Procedure distribution when `by_procedure` exists.

Existing optional fields in `StatsResponse` remain guarded so the dashboard tolerates an older backend payload.

## Directory Pages

`Cities`, `Regions`, and `Sectors` accept an optional `embedded?: boolean` prop.

- Standalone mode renders page title, description, full spacing, and directory-specific layout.
- Embedded mode hides duplicate page chrome and fits inside the `/stats` dashboard shell.

Each directory page includes:

- Summary metrics.
- Search and sort controls where useful.
- A dense, scannable table or grouped list.
- Links to the matching detail page.
- Links into `/tenders` with the relevant filter query.
- Loading, empty, and error states.

## Cities & Morocco Map

`frontend/src/components/MoroccoMap.tsx` is already present and should be reused.

The cities page places the map after top metrics and before the ranking table. The map:

- Receives `CityStats[]`.
- Displays matched cities as scaled dots.
- Shows hover/focus tooltips with total and active counts.
- Supports keyboard activation.
- Navigates to `/tenders?location=<city>` on click or Enter/Space.

Cities without known coordinates remain visible in the table and are simply absent from the map.

## Detail Pages

City, region, and sector detail pages show:

- A concise header with total and active counts.
- Distribution lists for categories, top sectors, buyers, cities, or locations based on the endpoint payload.
- A primary link to filtered `/tenders`.
- A back link to the parent directory.

Invalid or missing backend data should render a calm error or empty state with recovery navigation rather than a blank page.

## Visual Direction

Follow the current app direction:

- Institutional, white or near-white surfaces.
- Thin low-contrast borders.
- Restrained crimson and gold accents.
- Compact, scan-friendly information density.
- No marketing hero treatment for these operational pages.
- No nested cards.
- No decorative gradient blobs or one-note color palette expansion.

Interactive controls should use familiar UI patterns: icon buttons for direct actions, segmented controls for sort modes, tabs for dashboard sections, and searchable inputs for long lists.

## Data Contracts

Use existing frontend helpers:

- `getStats()`
- `getOverview()`
- `getCities()`
- `getCityDetail(name)`
- `getRegions()`
- `getRegionDetail(name)`
- `getSectors()`
- `getSectorDetail(code)`

Expected response types already exist in `frontend/src/lib/types.ts`:

- `StatsResponse`
- `OverviewResponse`
- `CityStats`
- `CityDetail`
- `RegionStats`
- `RegionDetail`
- `SectorCategory`
- `SectorDetailResponse`

If implementation finds backend/frontend drift, fix the smallest compatible surface and keep backend changes additive.

## Testing

Verification commands:

- Frontend: `cd frontend && npx tsc -b --noEmit`
- Frontend: `cd frontend && npx oxlint src`
- Frontend: `cd frontend && npm run build`
- Backend/API surface, if needed: `cd backend && python -m pytest test_v1_api_surface.py`

Manual route checks:

- `/stats`
- `/stats?tab=villes`
- `/stats?tab=regions`
- `/stats?tab=secteurs`
- `/cities`
- `/regions`
- `/sectors`
- One representative city, region, and sector detail route.

Responsive checks:

- Mobile width around 375 px.
- Tablet width around 768 px.
- Desktop width around 1280 px.

## Acceptance Criteria

- The dashboard and all directory routes render without frontend runtime errors.
- `/stats` tabs are bookmarkable and keep the correct active state.
- Cities page displays the Morocco map when city data has coordinate matches.
- Directory detail pages link cleanly back to their parent pages and into filtered tenders.
- Loading, empty, and error states are present on restored data-driven pages.
- The current root route remains unchanged.
- No private tender API behavior is loosened.
