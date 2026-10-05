# Interactive Morocco Map — Cities Page

**Date:** 2026-07-19
**Status:** Approved

## Goal

Add an interactive SVG map of Morocco to the Cities page (`/cities`). City dots scale on hover, show a tooltip with tender stats, and click through to the filtered tenders list. No new dependencies, no backend changes.

## Component

New file: `frontend/src/components/MoroccoMap.tsx`.

- Props: `cities: CityStats[]` — the data already loaded by `Cities.tsx` via `getCities()`.
- Renders an SVG with `viewBox="0 0 600 600"` (responsive width, `preserveAspectRatio`).
- Contains a simplified Morocco outline path, including the southern provinces, filled `var(--color-ivory-dim)` with a `var(--color-border-subtle)` stroke to match existing cards.
- A hardcoded coordinates table in the same file:
  `MOROCCO_CITY_COORDS: Record<string, [lat, lng]>` covering ~40 major cities (Casablanca, Rabat, Marrakech, Tanger, Agadir, Fès, Oujda, Meknès, Kénitra, Tétouan, Laâyoune, Dakhla, Essaouira, Safi, El Jadida, Nador, Béni Mellal, Khouribga, Errachidia, Ouarzazate, etc.).
- Projection: simple linear mapping of lat/lng onto the viewBox over Morocco's bounding box (~21°N–36°N, ~17°W–1°W). Precision beyond "dots land in the right place on a stylized outline" is not a goal.

## Visual encoding

- One `<circle>` per city whose normalized name matches the coords table.
- Radius scales with `sqrt(total)`, clamped to [4, 18] px.
- Fill `var(--color-crimson)` at partial opacity (~0.55); on hover: full opacity + `transform: scale(1.4)` with a CSS transition (transform-origin at the dot center).
- The 6 largest cities get permanent `<text>` labels beside their dots; all others show their name only via the hover tooltip.

## Interaction

- **Hover:** an HTML tooltip (absolutely positioned overlay, not SVG text) near the dot showing city name, total consultations, and actives.
- **Click:** `useNavigate()` to `/tenders?location=<encodeURIComponent(city.name)>` — the same URL the ranking table's external-link button uses.
- **Accessibility:** dots have `cursor-pointer`, `role="link"`, `aria-label` ("<Ville> — N consultations, M actives"), `tabIndex=0`, and Enter/Space triggers navigation. Focus shows the same scaled/tooltip state as hover.

## Placement in Cities.tsx

- New full-width card section titled **"Carte des consultations"**, styled like the existing sections (border, rounded, ivory background), placed after the metrics grid and before the ranking-table/aside grid.
- A small footnote in the card: the map shows major cities only; the full list is in the table below.
- The section renders only when `cities.length > 0` (same guard as the rest of the page) and in both embedded and standalone modes.

## Edge cases

- **City not in coords table:** simply not rendered on the map; still present in the ranking table.
- **Name matching:** accent- and case-insensitive — normalize both sides with `NFD` + strip diacritics + lowercase, so "Fes"/"Fès", "Tetouan"/"Tétouan" match.
- **Duplicate matches:** if two API city names normalize to the same coords entry, render both dots at that position (no merging).
- **Empty data / loading:** section hidden; no skeleton needed.

## Testing

- Manual: hover scaling + tooltip, click navigation to filtered tenders, keyboard Tab/Enter navigation, responsive behavior at mobile widths (map card stacks full width; SVG scales down).
- Lint/build: `npm run lint` and `tsc -b` pass.

## Out of scope

- Backend/API changes.
- Region-level choropleth coloring.
- Pan/zoom or geographic precision beyond the stylized outline.
