# Portal Probe Report — Moroccan Public Data Sources

Probe date: 2026-07-15. Method: conservative HTTP probes (robots.txt, homepage, sitemaps, documented API endpoints) with an identified research user agent, 1–2 s between requests, no authentication, no CAPTCHA interaction, no deep crawling. Companion artifacts: `source_inventory.jsonl` (machine-readable profiles), `sample_records.jsonl` (33 provenance-preserving samples), `extraction_backlog.md`, `compliance_notes.md`.

## Summary Matrix

| # | Portal | Tier | Access route found | Scrape feasibility | Recommended next step |
|---|--------|------|--------------------|--------------------|----------------------|
| 1 | PMMP (marchespublics.gov.ma) | 1 | Public Atexo/MPE search pages | **High** (proven — repo scraper already works) | Extend to awards/results/buyers |
| 2 | data.gov.ma | 1 | **Live CKAN API** (`/data/api/3/action/*`) | **High** | Build CKAN harvester first |
| 3 | SGG Bulletin Officiel | 1 | ASP.NET search + PDF downloads | Medium | Map postback params, then harvest |
| 4 | Adala (justice) | 1 | Next.js SSR pages + `/api/uploads/` PDFs | Medium | Probe Next.js data routes |
| 5 | Directinfo (OMPIC) | 1 | reCAPTCHA + paid docs | **Avoid** | Partnership with OMPIC |
| 6 | HCP | 1 | Sitemaps + catalogue pages | Medium (robots blocks `/download/`) | Catalogue-only harvester |
| 7 | ANCFCC | 2 | JS-heavy portal | Low | Manual review; procedures only |
| 8 | Chikaya | 2 | Public statistics page | Medium | Aggregate stats only |
| 9 | Rokhas | 2 | Pure React SPA, no SSR | Low | Partnership |
| 10 | PortNet | 2 | Liferay public pages + sitemap | Medium | Sitemap probe |
| 11 | Emploi-public.ma | 2 | UUID-keyed concours detail pages | **High** (metadata; downloads robots-disallowed) | Concours metadata harvester |
| 12 | LOF / Direction du Budget | 3 | Drupal pages + direct PDFs | **High** | Budget-document harvester |
| 13 | Cour des Comptes | 3 | WordPress `publication-sitemap.xml` | **High** | Sitemap-driven harvester |
| 14 | Conseil de la Concurrence | 3 | WordPress sitemaps (posts + case_study) | **High** | Sitemap-driven harvester |
| 15 | DGI (tax.gov.ma) | 3 | WAF: 503 on robots, 405 on portal | Low | Manual browser review |
| 16 | ADII / Douane | 3 | F5 WAF rejected robots; pages serve | Low | Manual review / partnership |
| 17 | Office des Changes | 3 | Drupal, clean section URLs | **High** | Regulation + stats harvester |

## Tier 1 Findings

### 1. PMMP — Portail Marocain des Marchés Publics
- Atexo/MPE ("LocalTrust") platform operated by TGR. No robots.txt (the request redirects to the 1.3 MB homepage).
- All target surfaces have public, parameterized search URLs on `index.php?page=entreprise.…`:
  - Consultations en cours: `EntrepriseAdvancedSearch&AllCons` (with `domaineActivite=<code>` category filters — full category taxonomy is embedded in the homepage nav)
  - All announcements: `…&AllAnn`; award notices: `…&AvisAttribution`; PV extracts: `…&AvisExtraitPV`; completion reports: `…&AvisRapportAchevement`
  - Excluded companies: `entreprise.EntrepriseRechercherSocietesExclues&search=1`
  - Public buyers: `entreprise.EntrepriseVisualiserEntitesAchatsRecherche`; forecast programs: `entreprise.ListePPs`
  - Regulatory texts: `/pmmp/textereg.html`
- **This repo already harvests the consultations surface** (`backend/scraper.py`: sector search → detail pages → DCE download; ~real records in `backend/data/tenders.db`). The marginal work is awards/results/excluded/buyers, which reuse the same table-parsing approach.
- Blockers: PRADO-style postbacks and session state for some filters; no public API. Official contact: `marchespublics@tgr.gov.ma` — partnership via TGR is the durable route.

### 2. data.gov.ma — the immediate win
- CKAN API confirmed live at `https://www.data.gov.ma/data/api/3/action/` (note the `/data/` prefix; `/api/3/` at root 404s).
- 663 datasets, 48 producer organizations (ministries, regions, Bank Al-Maghrib, CNSS, ANRT, Parliament…).
- Rich metadata per dataset: organization, tags, groups, resources with format + direct URL (XLSX/CSV…), `metadata_modified`, explicit license (ODbL observed), plus Moroccan extensions (`geographic_coverage`, `disaggregation_level`, `collection_frequency`, `available_languages`).
- Freshness is real: Ministry of Justice court-activity datasets updated 2026-07-07.
- One full catalogue sync ≈ 70 paged API calls. Highest value / lowest risk of all portals.

### 3. SGG — Bulletin Officiel
- DotNetNuke/ASP.NET site; no robots.txt. BO search lives at `/Legislation/rechercheSommairesBO.aspx` and navigation relies on `__doPostBack` (ViewState must be replayed).
- Bulletins are downloadable PDFs; metadata (number, date, language) visible in listings.
- Feasible but requires a postback-aware fetcher; start with a manual mapping of the search form fields.

### 4. Adala — Ministry of Justice legal portal
- Modern Next.js app, server-rendered (content present without JS). Legal-text PDFs served from `/api/uploads/YYYY/MM/DD/<arabic-filename>.pdf` — dated paths give free publication metadata.
- Recent dahirs and joint ministerial decisions were visible on the homepage at probe time (June 2026 texts).
- Next step: check whether `_next/data/<buildId>/…` JSON routes are stable enough to use as a de-facto API; otherwise parse the SSR HTML.

### 5. Directinfo (OMPIC) — do not scrape
- Google reCAPTCHA embedded on the public search; company documents are paid. Mentions légales PDF available at `/assets/documents/Mentions-legales-directinfo.pdf` and must be reviewed.
- Per the stop conditions: CAPTCHA + paid content ⇒ no automated collection. Route: OMPIC partnership / official API request. Public free artifacts (guide, barometer publications) can be referenced by URL.

### 6. HCP
- robots.txt **disallows `/download/` and most of `/docs/`** — this is where bulk files live, so automated bulk download is off-limits without permission.
- Excellent sitemap coverage: `index-sitemap`, `Bases-de-donnees` (BDS, comptes nationaux, RGPH 2004/2014/2024 interactive platform, ODD platform, regional BDS), `Micro-donnees-Open-data`, news sitemap.
- Strategy: harvest the catalogue/publication metadata from sitemap-listed pages, link users to HCP pages rather than mirroring files; ask HCP for bulk access.

## Tier 2 Findings

### 7. ANCFCC
JS-heavy portal, little server-rendered content. Only the public service/procedure catalogue is in scope; land-owner and parcel data are privacy-red-lined. Manual review recommended before any automation.

### 8. Chikaya
Public aggregate statistics page found: `?page=reclamation.Statistiques` (session token appears in URLs but the page serves without auth). Form dropdowns expose the administration-type taxonomy — useful reference data. Complaint narratives are personal data: aggregates only, low frequency.

### 9. Rokhas
Pure client-side React SPA (`<div id="root">` + bundle; robots allows all but there is nothing server-rendered to crawl). Workflow data sits behind accounts. Partnership route (Karaz platform); at most manual review of public help pages.

### 10. PortNet
Liferay portal; public procedure/service pages and guides are reachable; robots.txt allows all and declares a sitemap at `http://portnet.ma:8080/sitemap.xml` (non-standard port — verify before relying on it). Operational single-window workflows are authenticated: out of scope. Catalogue-level harvesting is feasible.

### 11. Emploi-public.ma
- Concours detail pages use clean stable URLs: `/{ar|fr}/تفاصيل/المباريات/{uuid}` — eight live concours were linked from the homepage at probe time.
- robots.txt **disallows the `/download/` paths** for concours/results documents in both languages: harvest listing + detail metadata, link to detail pages, do not fetch the disallowed document URLs.

## Tier 3 Findings

### 12. LOF / Direction du Budget
Drupal site; budget documents are direct PDFs under `/sites/default/files/` (e.g. `bsfpavril2026.pdf` linked from the homepage). Initial connection to robots.txt failed (transient TLS behavior — build retries in). Straightforward document-catalogue harvest by year/type/ministry.

### 13. Cour des Comptes
WordPress + Yoast. `publication-sitemap.xml` (174 KB) enumerates the dedicated publication post type in FR/AR/EN — includes the 2024–2025 annual report and the 2024 finance-law execution report. `sieges-et-ressorts` sitemap maps regional courts. Also worth probing the WordPress REST API (`/wp-json/wp/v2/publication`). Very clean target.

### 14. Conseil de la Concurrence
WordPress + Yoast; six post sitemaps plus a `case_study` post type (decision/opinion write-ups) with category/tag taxonomies, FR/AR/EN. July 2026 communiqués present (e.g. joint Conseil/Bank Al-Maghrib merger communiqué). Same harvester pattern as Cour des Comptes.

### 15. DGI (tax.gov.ma)
WebSphere portal behind a WAF: robots.txt → 503, `/wps/portal` → 405 on plain GET. Per stop conditions, treat as blocked for automation. Map stable public URLs manually in a browser; otherwise partnership.

### 16. ADII / Douane
F5 BIG-IP WAF rejected the robots.txt request ("Request Rejected" + support ID) while `/web/guest` pages serve normally. Liferay with stateful portlet URLs. Fragile: keep to occasional manual-paced fetches of specific documents (circulars, tariff pages) or pursue partnership. The ADIL tariff tool needs its own review.

### 17. Office des Changes
Drupal with default-permissive robots. Clean sections: `/fr/etudes-et-statistiques/series-statistiques`, `/metadonnees`, `/methodologie`, e-services, external-trade database. Good target for a regulation + statistics catalogue harvester.

## Cross-Cutting Observations

- **Three platform families cover 12 of 17 portals**: Atexo-style (PMMP, Chikaya), Drupal (data.gov.ma, OC, LOF), WordPress+Yoast (CDC, Conseil Concurrence) and Liferay (PortNet, Douane). One parser per family amortizes well.
- **Language**: Tier-1 legal/statistical content is heavily Arabic-first (Adala, Chikaya, emploi-public); the record schema's `language` field matters from day one.
- **The repo already has a working PMMP consultations pipeline** — the backlog below builds around it rather than restarting.
