# Stats Consolidation & KPI Upgrade — Design

Date: 2026-07-19
Status: approved

## Purpose

The navbar has too many top-level tabs, and Villes/Régions/Secteurs are essentially statistical views. Consolidate them as tabs inside an upgraded Statistiques page, and raise the quality of the KPIs shown on its overview from raw counts to market-activity indicators.

## Decisions (from brainstorming)

1. **Tabs inside Stats** — Statistiques gets internal tabs: Vue d'ensemble | Villes | Régions | Secteurs. Existing list and detail routes (`/cities`, `/cities/:name`, `/regions`, `/regions/:name`, `/sectors`, `/sectors/:code`) stay alive for deep links; they only leave the navbar.
2. **Market-activity KPIs** — one backend `/api/stats` extension; all KPIs computable from existing columns.
3. **URL query param tabs** — `/stats?tab=villes|regions|secteurs`; absent/unknown param = Vue d'ensemble. Bookmarkable, back-button friendly.

## Backend change: extend `/api/stats` (backend/main.py:372)

Add a `kpis` object and a `by_procedure` list to the existing response. Existing fields (`total`, `by_category`, `top_sectors`, `top_entities`) are unchanged — the Overview page and any other consumer keep working.

```json
{
  "total": 812,
  "by_category": [...],
  "top_sectors": [...],
  "top_entities": [...],
  "kpis": {
    "active": 612,
    "closing_7d": 45,
    "new_7d": 78,
    "distinct_buyers": 214
  },
  "by_procedure": [
    { "procedure_type": "AOO", "count": 700 },
    { "procedure_type": "AOR", "count": 60 }
  ]
}
```

KPI definitions (SQL over `tenders`):

- `active`: `COUNT(*) WHERE status = 'en_cours'`.
- `closing_7d`: active tenders whose `deadline` falls within the next 7 days. `deadline` is stored as text `DD/MM/YYYY HH:MM`; convert with `substr(deadline,7,4) || '-' || substr(deadline,4,2) || '-' || substr(deadline,1,2)` and compare to `date('now')` / `date('now','+7 day')`. Rows with empty or malformed deadlines are excluded.
- `new_7d`: `COUNT(*) WHERE scraped_at >= datetime('now','-7 day')`. Labeled "Ajoutées (7 j)" in the UI because `publication_date` is unreliable (often empty) — this measures ingestion, not official publication, and the label must not claim otherwise.
- `distinct_buyers`: `COUNT(DISTINCT entity)`.
- `by_procedure`: `SELECT procedure_type, COUNT(*) GROUP BY procedure_type ORDER BY count DESC` (empty procedure_type grouped as-is; frontend renders it as "Non précisé").

## Frontend changes

### File structure

- `frontend/src/pages/Stats.tsx` — becomes the tab shell: reads `tab` via `useSearchParams`, renders the tab bar and the active tab component. Tab switching uses `setSearchParams` (push, not replace).
- `frontend/src/pages/stats/OverviewTab.tsx` — new file; receives the current `Stats.tsx` content, upgraded:
  - **KPI strip** (top): four cards — Actives, Clôture < 7 j, Ajoutées (7 j), Acheteurs — from `data.kpis`, styled like the existing `StatsStrip`.
  - Existing **category strip** (Total importé + categories) below it.
  - Three columns on large screens: Top secteurs | Top entités | **Répartition par procédure** (new `TopList` instance over `by_procedure`, label "Non précisé" for empty types).
- `frontend/src/pages/Cities.tsx`, `Regions.tsx`, `Sectors.tsx` — reused as tab content. Each gets a `embedded?: boolean` prop: when true, the page hides its own `<h1>` block (the Stats shell owns the title). Standalone routes keep current behavior (prop absent).
- `frontend/src/lib/types.ts` — extend `StatsResponse` with `kpis` and `by_procedure` (both optional to tolerate an older backend).
- `frontend/src/components/Navbar.tsx` — `mainLinks` becomes: Apercu, Consultations, Statistiques. Villes/Regions/Secteurs entries removed. `moreLinks` unchanged.
- `frontend/src/App.tsx` — routes unchanged (all existing routes stay).

### Tab bar

Styled like the app's academic theme (border-bottom tabs, crimson active indicator; follow existing patterns — no stock daisyUI tab classes). Labels: "Vue d'ensemble", "Villes", "Régions", "Secteurs". Active tab from `?tab=`; `villes` | `regions` | `secteurs` map to their components, anything else → Vue d'ensemble.

## Error handling

- Each tab component keeps its own fetch/loading/error handling (already implemented in the reused pages; OverviewTab inherits the current Stats retry UI).
- `kpis`/`by_procedure` missing from the API response (older backend): OverviewTab hides the KPI strip and procedure list rather than crashing (optional-chaining guard).

## Verification

- `npx tsc -b --noEmit`, `npx oxlint src`, `npm run build` all pass.
- Headless-Chrome render of `/stats`, `/stats?tab=villes`, `/stats?tab=regions`, `/stats?tab=secteurs`: correct tab active, content renders.
- KPI numbers cross-checked against direct SQL queries on `backend/data/tenders.db`.
- Navbar shows only Apercu | Consultations | Statistiques as main links (desktop + mobile).
- Deep links `/cities/:name`, `/regions/:name`, `/sectors/:code` still render standalone with their titles.
- Overview page (`/`) unaffected by the `/api/stats` payload extension.

## Out of scope

- Time-series charts and per-region/city cross KPIs (option "Full analytics push" declined).
- Deleting or redirecting the old routes.
- Estimated-budget KPIs (no amount column exists in `tenders`).
