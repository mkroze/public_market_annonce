# Guide & Outils Consolidation — Design

Date: 2026-07-19
Status: approved

## Purpose

Calculateur, Assistant and Procédures (plus the smaller Éligibilité and Recours tools) tell one story — how to understand, qualify for, price and defend a public-procurement bid — but live on five fragmented pages. Merge all five into a single coherent page, explicitly **without tabs**: a scrollable journey with an anchor rail.

## Decisions (from brainstorming)

1. **Merge scope: all five tools** — Procédures, Éligibilité, Calculateurs, Assistant, Recours. Procedure detail routes (`/procedures/:slug`) stay.
2. **Assistant: section with both modes** — without a tender it shows generic guidance and a prompt to pick a consultation; with `?tender=<id>` it renders the full tender-specific analysis.
3. **Layout: journey scroll + anchor rail** — one scrollable narrative in bidder order with a sticky scrollspy rail; no tabs, no accordions.

## Page structure

New route **`/guide`** → `frontend/src/pages/Guide.tsx`, titled **"Guide & Outils"**.

Section order (each a titled block with an `id` anchor and a numbered French heading):

| # | Anchor | Section title | Content source |
|---|--------|---------------|----------------|
| 1 | `#procedures` | Procédures de passation | `Procedures` embedded |
| 2 | `#eligibilite` | Vérifier votre éligibilité | `Eligibility` embedded |
| 3 | `#calculateurs` | Calculateurs | `Calculator` embedded |
| 4 | `#assistant` | Analyser une consultation | `CandidacyAssistant` embedded (lazy) |
| 5 | `#recours` | Réclamations et recours | `Recours` embedded |

**Anchor rail:** sticky left rail (desktop `lg:` and up only; hidden on mobile), listing the five sections. Scrollspy via IntersectionObserver highlights the section in view. Clicking a rail item scrolls smoothly to the anchor. Deep links like `/guide#calculateurs` scroll on load.

## Component changes (embedded pattern, as in the stats consolidation)

Each tool page gets `embedded?: boolean` (default false). When true:

- hide its own `<h1>` header block and page padding (`px-4 sm:px-6 py-8` → none; the Guide shell owns spacing);
- hide "back" links (`ArrowLeft` links to /