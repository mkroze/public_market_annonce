# Guide & Outils Consolidation — Design

Date: 2026-07-19
Status: approved

## Purpose

Calculateur, Assistant and Procédures (plus the tools Procédures links to — Éligibilité and Recours) tell one continuous story — "understand the procedure, check you qualify, size the numbers, prepare your bid, know your recourse" — but are split across five pages. This fragments the bidder's experience. Consolidate them into one coherent scrollable page, **without tabs**.

## Decisions (from brainstorming)

1. **Merge all five tools**: Procédures, Éligibilité, Calculateur, Assistant, Recours.
2. **Assistant keeps both modes**: generic guidance when no tender is selected; full tender-specific analysis when opened with `?tender=<id>`.
3. **Layout: journey scroll + anchor rail** (no tabs). One scrollable page in bidder order with a slim sticky side rail (desktop) that scrollspies the active section.

## Architecture

New page `frontend/src/pages/Guide.tsx` at route `/guide`, titled **"Guide & Outils"**. It renders five titled sections in order, each with an `id` for anchor deep-linking:

1. `#procedures` — Procédures
2. `#eligibilite` — Éligibilité
3. `#calculateur` — Calculateurs
4. `#assistant` — Assistant
5. `#recours` — Recours

Each section reuses the existing page component in an `embedded` mode (same pattern already used for Cities/Regions/Sectors in the stats consolidation). No business logic is rewritten.

### `embedded` prop contract

Each of `Procedures`, `Eligibility`, `Calculator`, `Recours`, `CandidacyAssistant` gains `embedded?: boolean`. When `embedded` is true:

- Hide the component's own `<h1>` + subtitle header block and any "← retour" back-link (the Guide page owns the title; the anchor rail owns navigation).
- Drop the outer page padding (`px-4 sm:px-6 py-8` → `pt-2` or none) so the Guide section wrapper controls spacing.
- `Procedures` additionally hides its "Outils pratiques" card grid (`TOOLS`, Procedures.tsx:5,100-117) — those tools (Éligibilité, Recours, Calculateur) are now sibling sections on the same page, so the cross-links are redundant.

Standalone routes keep current behavior (prop absent).

### Anchor rail + scrollspy

A slim sticky rail (`position: sticky; top`) on the left, visible on `lg` and up (`hidden lg:block`), listing the five sections as `<a href="#...">` links. An `IntersectionObserver` over the five section elements sets the active link (dot/bold indicator in crimson). On small screens the rail is hidden and the page is a plain vertical scroll. Layout: `lg:grid lg:grid-cols-[180px_1fr] lg:gap-8`.

### Assistant section (both modes)

`CandidacyAssistant` already reads `?tender=` via `useSearchParams` (CandidacyAssistant.tsx:49). In embedded mode:

- No tender selected → show its generic intro/guidance and a call-to-action linking to `/tenders` ("Ouvrez une consultation pour l'analyser ici").
- `?tender=<id>` present → render the full tender-specific analysis (compliance checklist, legal sidebar, price/threshold checks) exactly as today.

`Guide.tsx` does not need to parse the param itself — it renders `<CandidacyAssistant embedded />` and the component reads the URL. The page stays lazy-loaded (see routing) so the heavy assistant + its deps don't inflate the main bundle.

## Routing & navigation changes

`frontend/src/App.tsx`:
- Add `/guide` route. Because it transitively imports `CandidacyAssistant`, load `Guide` via `React.lazy` + the existing `Suspense` fallback (mirror the current `/assistant` lazy pattern) so the main bundle is unaffected.
- Keep all existing routes: `/procedures`, `/procedures/:slug`, `/eligibility`, `/recours`, `/calculator`, `/assistant` remain functional standalone for deep links.

`frontend/src/components/Navbar.tsx`:
- In `moreLinks`, replace the three entries **Assistant, Procédures, Calculateur** with a single **"Guide & Outils"** entry (`to: "/guide"`). Blog, Tarifs, Partenaires unchanged. Remove now-unused lucide icon imports (`Sparkles`, `Scale`, `Calculator`) only if no longer referenced anywhere in the file.

`frontend/src/pages/TenderDetail.tsx:172`:
- Change the assistant link from `/assistant?tender=${tender.id}` to `/guide?tender=${tender.id}#assistant`.

## Files

- Create: `frontend/src/pages/Guide.tsx` (page shell: title, anchor rail, scrollspy, five embedded sections).
- Modify: `frontend/src/pages/Procedures.tsx` (embedded prop; hide header + TOOLS grid).
- Modify: `frontend/src/pages/Eligibility.tsx` (embedded prop; hide header + back-link).
- Modify: `frontend/src/pages/Calculator.tsx` (embedded prop; hide header).
- Modify: `frontend/src/pages/Recours.tsx` (embedded prop; hide header + back-link).
- Modify: `frontend/src/pages/CandidacyAssistant.tsx` (embedded prop; hide header + back-link, keep both tender/no-tender modes).
- Modify: `frontend/src/App.tsx` (lazy `/guide` route).
- Modify: `frontend/src/components/Navbar.tsx` (single Guide entry).
- Modify: `frontend/src/pages/TenderDetail.tsx` (assistant link → `/guide?tender=…#assistant`).

## Error handling

- No new data fetching in `Guide.tsx` itself; each embedded section keeps its own loading/error handling (Assistant's tender fetch, etc.).
- Scrollspy: `IntersectionObserver` is guarded (only observes sections that mounted); no-op if unavailable.
- Deep-link `/guide#calculateur`: browser native anchor scroll on load; acceptable if it lands slightly off due to sticky header (sections get `scroll-mt-4` to compensate).

## Verification

- `npx tsc -b --noEmit`, `npx oxlint src`, `npm run build` pass.
- Headless-Chrome render of `/guide`: all five section headings present in order; anchor rail present on wide viewport.
- `/guide#calculateur` deep-link: calculateur section scrolled into view.
- `/guide?tender=<id>`: Assistant section renders tender-specific analysis (checklist present); `/guide` without tender shows the generic assistant guidance + CTA.
- Old routes `/procedures`, `/procedures/:slug`, `/eligibility`, `/recours`, `/calculator`, `/assistant` still render standalone with their own titles.
- Navbar "more" dropdown shows "Guide & Outils" and no longer shows Assistant/Procédures/Calculateur.
- TenderDetail "analyser" link points to `/guide?tender=…#assistant`.

## Out of scope

- Rewriting any tool's business logic or copy.
- Deleting or redirecting the old routes.
- Merging Blog/Tarifs/Partenaires.
