# Partners Page — Design

Date: 2026-07-16
Status: approved

## Purpose

Add a public "Partenaires & Sources de données" page to the marches-publics frontend. It shows site visitors the ecosystem behind the product: the official Moroccan portals already integrated or publicly mapped, plus strategic partner institutions. It is an ecosystem/transparency page, not an internal dashboard: internal probe judgments (scrape feasibility, WAF blockers, robots notes, partnership tactics) are excluded. Public copy must distinguish between sources already integrated into the product and official sources that are only referenced as transparency/enrichment targets.

## Data sources (inputs)

- `scraping/source_inventory.jsonl` — 17 probed official portals (2026-07-15 reconnaissance). Canonical research source; the TS file below is its curated public projection. This file must be committed, regenerated, or the public facts must be copied into the implementation notes before another agent implements the page from a clean checkout.
- `chat/partner_mapping.md` — 10 strategic partner institutions.

## Architecture

Approach: static typed data file, following the existing `src/lib/procedures.ts` convention (typed exported arrays, header comment citing provenance). No backend changes, no fetching.

### New files

**`frontend/src/lib/partners.ts`**

```ts
export interface DataSource {
  id: string;                     // slug from source_inventory.jsonl
  name: string;                   // official portal name
  operator: string;               // operating institution
  url: string;                    // official base URL
  tier: 1 | 2 | 3;
  domains: string[];              // French labels: "Marchés publics", "Juridique", "Budget", ...
  description: string;            // one French sentence: what public data the portal exposes
  status: "integre" | "reference" | "acces_institutionnel";
}

export interface StrategicPartner {
  name: string;                   // e.g. "TGR — Trésorerie Générale du Royaume"
  role: string;                   // one French sentence: why this partner matters
  tags: string[];                 // value tags, e.g. "Légitimité officielle"
  url: string;
}
```

- `dataSources`: all 17 portals. Status assignment: `integre` = PMMP only (already harvested by `backend/scraper.py`); `acces_institutionnel` = Directinfo/OMPIC, Rokhas, DGI, ADII (public page should say institutional access is required, without naming CAPTCHA/WAF/auth blockers); `reference` = the rest.
- `strategicPartners`: the 10 institutions from partner_mapping.md (TGR, PMMP, Min. Finances, Min. Transition Numérique, ADD, Intérieur/DGCT/INDH, CNCP, Maroc PME, CGEM, FNBTP).

**`frontend/src/pages/Partners.tsx`** — the page (see layout below).

### Modified files

- `frontend/src/App.tsx`: add `<Route path="/partenaires" element={<Partners />} />`.
- `frontend/src/components/Navbar.tsx`: add `{ to: "/partenaires", label: "Partenaires", icon: Handshake }` to `moreLinks`.

## Page layout

French throughout. daisyUI + Tailwind + lucide-react, visually consistent with existing pages.

1. **Header** — title "Partenaires & Sources de données" + one intro sentence explaining that the app integrates PMMP data and maps other official public sources for transparency and future enrichment.
2. **Sources de données officielles** — cards grouped by tier with French group headings:
   - Tier 1 → "Sources principales"
   - Tier 2 → "Portails administratifs"
   - Tier 3 → "Finances & régulation"
   Each card: portal name, operator, domain badges, description, status badge (Intégré / Référencé / Accès institutionnel), external link to the official portal.
3. **Partenaires stratégiques** — card grid: name, role sentence, tags, official link.
4. **Attribution note** — closing paragraph: integrated data originates from official public portals, referenced portals are listed for transparency, deep links point to original sources, and listing an institution does not imply endorsement or an existing partnership.

No filters, search or pagination: 27 static items do not need them.

## Error handling

None required: static page, no data fetching, no user input.

## Verification

- `tsc` / oxlint pass; Vite production build succeeds.
- Manual visual check of `/partenaires` in the dev app (desktop + mobile nav).
- All 17 portal cards and 10 partner cards render; external links open the correct official sites.
- PMMP is the only card labelled "Intégré"; Directinfo/OMPIC, Rokhas, DGI and ADII use "Accès institutionnel"; the other portals use "Référencé".
- No public copy mentions scrape feasibility, WAF, CAPTCHA, robots, blockers, internal backlog status, or partnership tactics.
- No copy says or implies that referenced institutions endorse the product or that a partnership already exists.

## Out of scope

- Backend endpoint or build-time generation for this data (revisit if update cadence increases).
- Internal probe dashboard (feasibility, blockers, backlog status).
- Arabic/English translations.
