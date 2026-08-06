# Extraction Backlog

Ordered by product value ÷ access risk, updated with probe evidence (2026-07-15). Item 0 exists already; items 1–6 are buildable immediately with no legal ambiguity; items 7–11 need one manual-review step first; items 12–16 are partnership/manual tracks.

## Already built (maintain)

**0. PMMP consultations harvester** — `backend/scraper.py` already covers sector search → tender rows → detail pages → DCE download into `backend/data/tenders.db`. Keep; add scrape_log-based freshness monitoring and content-hash dedup per the record schema.

## Build now (public, structured, low risk)

**1. data.gov.ma CKAN catalogue harvester** — `GET /data/api/3/action/package_search` paged (663 datasets, ~70 calls), plus `organization_list`. Store dataset + resource + producer records with license and `metadata_modified`. Re-sync weekly. *Effort: small. Value: cross-domain enrichment layer.*

**2. PMMP results/awards extension** — same table-parsing approach as item 0 against `AvisAttribution`, `AvisExtraitPV`, `AvisRapportAchevement`, `EntrepriseRechercherSocietesExclues`, `EntrepriseVisualiserEntitesAchatsRecherche`, `ListePPs`. Links tenders → winners → buyers; unlocks award intelligence, the core product differentiator. *Effort: medium. Value: highest.*

**3. Cour des Comptes report harvester** — parse `publication-sitemap.xml`, fetch publication pages for title/date/PDF URL; probe `/wp-json/wp/v2/` first (may remove HTML parsing entirely). *Effort: small.*

**4. Conseil de la Concurrence harvester** — same WordPress pattern: post sitemaps + `case_study` post type; capture decision type, sector, parties, date, PDF. Shares 90% of code with item 3. *Effort: small.*

**5. LOF budget-document harvester** — crawl year/type sections, catalogue PDFs under `/sites/default/files/` with year, document type, ministry. Add connection retries (transient TLS failures observed). *Effort: small.*

**6. Office des Changes harvester** — regulation pages (laws, instructions, circulars) + statistical series/metadata pages. Drupal, clean URLs. *Effort: small–medium.*

## Build after one manual-review pass

**7. Emploi-public concours harvester** — listing pages + UUID detail pages for title, institution, deadline, status. **Respect robots: never fetch `/download/` document paths; link to detail pages.** *Effort: small.*

**8. HCP catalogue harvester** — sitemap-driven metadata harvest of Bases-de-données, Micro-données and publication pages. **Catalogue only; `/download/` is robots-disallowed** — request bulk access from HCP in parallel. *Effort: medium.*

**9. SGG Bulletin Officiel harvester** — requires mapping the ASP.NET ViewState/postback flow of `rechercheSommairesBO.aspx` first; then bulletin metadata + PDF URLs. Canonical legal layer, worth the plumbing. *Effort: medium.*

**10. Adala legal-text harvester** — probe `_next/data` JSON routes; fall back to SSR HTML. Dated `/api/uploads/` paths give publication dates for free. *Effort: medium.*

**11. PortNet procedure catalogue** — verify declared sitemap (`portnet.ma:8080/sitemap.xml`), then harvest public procedure/guide pages. *Effort: medium.*

## Restricted tracks (aggregate-only, manual, or partnership)

**12. Chikaya statistics harvester** — aggregate statistics page + administration taxonomy from form options. Quarterly cadence. No complaint content, ever.

**13. ANCFCC procedure catalogue** — manual review of JS-rendered service pages; catalogue procedures/fees/required documents only. No owner/parcel data.

**14. DGI tax guidance catalogue** — blocked by WAF (503/405). Manual browser mapping of stable public URLs first; no automated crawling until proven tolerated.

**15. ADII customs catalogue** — F5 WAF present. Manual-paced retrieval of specific circulars/tariff pages only; partnership for anything systematic.

**16. Directinfo / OMPIC** — no automated collection (reCAPTCHA + paid documents). Pursue OMPIC partnership/official API; meanwhile reference their free public artifacts by URL only.

## Cross-cutting infrastructure (do alongside items 1–2)

- Shared fetcher: identified user agent with contact email, ≥5 s/host delay, response cache, stop-on-403/429/CAPTCHA circuit breaker.
- Provenance store implementing the record schema (source_url, document_urls, content sha256, extracted_at, parser_version).
- Freshness log per source (`scrape_log` table already exists — generalize it beyond PMMP).
- Language detection (fr/ar) at ingestion.
