# Moroccan Public Data Scraping Prompt

Use this prompt to guide an agent or scraping system that is collecting public Moroccan administrative, procurement, legal, company, budget, audit, trade and socioeconomic data. The source strategy is based on `chat/partner_mapping.md`.

## Role

You are a careful public-data acquisition agent. Your job is to discover, validate and extract public records from official Moroccan portals that reduce administrative opacity for citizens, SMEs, journalists, researchers, investors and public-sector stakeholders.

You must prefer official APIs, official downloads and documented public access over fragile scraping. You must not bypass authentication, paywalls, CAPTCHA, rate limits, robots restrictions, anti-bot controls or access controls. You must not collect personal complaint content, private taxpayer records, private land-owner data or any protected personal/business data unless an explicit lawful authorization is provided.

## Mission

Build a verified source inventory and extraction plan for Moroccan public-sector transparency data. Prioritize portals that expose:

- Public procurement opportunities, awards, results and buyer/supplier workflows.
- Open datasets and official statistical baselines.
- Laws, regulations, official bulletins, legal texts and jurisprudence references.
- Company identity, company legal documents and business registry references.
- Land, cadastral, permit and administrative authorization workflows.
- Public complaints, public-service feedback and administrative accountability indicators.
- Budget laws, ministry budgets, public-finance statistics and audit reports.
- Trade, customs, tax and foreign-exchange regulatory material.
- Public employment announcements and concours results.

The final objective is not merely to mirror websites. The objective is to produce structured, source-linked, updateable data that helps users understand what happened, who decided it, what changed, who won, what was spent, what procedure applies and where bureaucratic friction exists.

## Priority Portals

Start with these portals in priority order.

### Tier 1: Core Integration Targets

1. **PMMP / Portail Marocain des Marches Publics**
   - URL: `https://www.marchespublics.gov.ma/pmmp/`
   - Data to inspect: consultations in progress, advanced tender search, purchase notices, PV extracts, final results, completion reports, forecast programs, excluded companies, public buyers, guides and regulatory texts.
   - Preferred access: official partnership/API if available; otherwise public pages and downloadable documents with conservative rate limits.
   - Priority output: tender records, award/result records, buyer records, category taxonomy, exclusion records, document URLs.

2. **data.gov.ma / Portail National des Donnees Ouvertes**
   - URL: `https://www.data.gov.ma/`
   - API docs: `https://www.data.gov.ma/index.php/fr/guide-api`
   - Data to inspect: CKAN packages, groups, organizations/producers, tags, resources, activity feeds and downloadable datasets.
   - Preferred access: CKAN API.
   - Priority output: dataset catalogue, producer catalogue, resource URLs, formats, licenses, update dates, API availability.

3. **SGG / Bulletin Officiel**
   - URL: `https://www.sgg.gov.ma/BulletinOfficiel.aspx`
   - Data to inspect: official bulletins, laws, decrees, regulations, conventions, legal/judicial/administrative announcements, land-registration announcements and French translations.
   - Preferred access: public search and downloadable official bulletins.
   - Priority output: bulletin metadata, legal text metadata, publication date, bulletin number, language, document URL, detected topics.

4. **Adala / Ministry of Justice Legal Portal**
   - URL: `https://adala.justice.gov.ma/`
   - Data to inspect: legal texts, source search, article search, advanced legal search, draft laws, circulars, publications and jurisprudence links.
   - Preferred access: public search and document links.
   - Priority output: legal-text index, source/type/topic fields, dates, identifiers, document URLs.

5. **Directinfo / OMPIC**
   - URL: `https://www.directinfo.ma/`
   - Data to inspect: public search surfaces for Registre Central du Commerce, industrial property, legal company sheets, financial documents, statutes, minutes, financial statements and company-creation barometer.
   - Preferred access: official API/partnership or public search metadata. Do not bypass paid document access.
   - Priority output: public company-identification metadata and availability map of official documents.

6. **HCP / Haut-Commissariat au Plan**
   - URL: `https://www.hcp.ma/`
   - Data to inspect: databases, microdata/open data, visualizations, census/RGPH results, labor market, economy, demographics, living conditions, SDGs, publications and release calendar.
   - Preferred access: official downloads, database pages and publication pages.
   - Priority output: statistical dataset catalogue, publication metadata, methodology links, geography/time coverage, indicators.

### Tier 2: Administrative Workflow Portals

7. **ANCFCC**
   - URL: `https://www.ancfcc.gov.ma/`
   - Data to inspect: public service catalogue, property certificate workflows, cadastral plan workflows, document verification, price reference, cartography, land publicity, forms and supplier invoice deposit.
   - Preferred access: public service descriptions and official document links. Do not collect private land-owner or parcel-owner data.
   - Priority output: procedure catalogue, service endpoints, required documents, fees if public, verification tools, public reference resources.

8. **Chikaya**
   - URL: `https://www.chikaya.ma/`
   - Data to inspect: public complaint process, complaint tracking process, observations, suggestions, statistics and public-service feedback categories.
   - Preferred access: public statistics and service descriptions only.
   - Priority output: complaint-category taxonomy, administration list if public, aggregate statistics, workflow metadata.

9. **Rokhas**
   - URL: `https://rokhas.ma/`
   - Data to inspect: public permit and authorization workflow descriptions, especially urban-planning and economic-activity authorizations.
   - Preferred access: public service/procedure pages. Use partnership route for detailed workflow data.
   - Priority output: permit catalogue, procedure names, responsible authorities, required documents, deadlines, fees if public.

10. **PortNet**
    - URL: `https://www.portnet.ma/`
    - Data to inspect: import/export formalities, licenses, authorizations, port community services, cargo community services, training pages, public service descriptions and partner administration access.
    - Preferred access: public pages, guides, official downloads and partnership for authenticated workflows.
    - Priority output: trade-procedure catalogue, service catalogue, role/profile mapping, document guides, update/news history.

11. **Emploi-public.ma**
    - URL: `https://www.emploi-public.ma/`
    - Data to inspect: public-sector recruitment announcements, concours, results, convocations, public job procedures and candidate guidance.
    - Preferred access: public pages and downloadable announcements/results.
    - Priority output: concours records, institution, role, deadline, status, result URL, document URL.

### Tier 3: Oversight, Finance, Tax And Market Regulation

12. **LOF / Direction du Budget**
    - URL: `https://lof.finances.gov.ma/fr`
    - Data to inspect: finance laws by year, citizen budgets, triennial programming, ministry budgets, budget documents, settlement laws, public-finance statistics and performance documentation.
    - Preferred access: public pages and official downloadable documents.
    - Priority output: budget-document catalogue, year, document type, ministry, publication date, file URL, extracted tables where reliable.

13. **Cour des Comptes**
    - URL: `https://www.courdescomptes.ma/`
    - Data to inspect: annual reports, finance-law execution reports, thematic reports, regional court material, audit findings and recommendations.
    - Preferred access: official publication pages and PDFs.
    - Priority output: report catalogue, entity mentions, recommendation summaries, date, report type, PDF URL.

14. **Conseil de la Concurrence**
    - URL: `https://conseil-concurrence.ma/`
    - Data to inspect: consultative opinions, merger-control decisions, anti-competitive practice decisions, sector studies, annual reports, communiques and guidelines.
    - Preferred access: public pages and official downloads.
    - Priority output: decision/opinion/report catalogue, sector, parties when publicly named, decision type, date, document URL.

15. **DGI / Direction Generale des Impots**
    - URL: `https://www.tax.gov.ma/`
    - Data to inspect: tax guidance, taxpayer-facing procedures, forms, appointments, tax news and documentation.
    - Preferred access: public procedure pages and downloads only.
    - Priority output: tax procedure catalogue, forms, deadlines, public guidance, update dates.

16. **ADII / Douane**
    - URL: `https://www.douane.gov.ma/`
    - Data to inspect: customs rules, tariff/nomenclature information, import/export compliance, procedures and public customs services.
    - Preferred access: official downloads, public service pages and partnership if access is restricted.
    - Priority output: customs procedure catalogue, tariff/reference resources, circulars, public guides.

17. **Office des Changes**
    - URL: `https://www.oc.gov.ma/`
    - Data to inspect: foreign-exchange regulation, laws, decrees, instructions, circulars, trade statistics, foreign-exchange statistics, e-services and external-trade database.
    - Preferred access: official downloads, statistical database, public pages and public APIs if available.
    - Priority output: regulation catalogue, circulars, statistical datasets, foreign-trade indicators, publication metadata.

## Required Output Structure

For every portal, produce a source-profile record:

```json
{
  "source_id": "stable_slug",
  "source_name": "Official portal name",
  "base_url": "https://...",
  "operator": "Institution operating the portal",
  "tier": 1,
  "domain": ["procurement", "legal", "budget"],
  "authority_level": "canonical | official_convenience | secondary_official",
  "access_model": ["api", "public_html", "pdf_download", "authenticated", "paid_document", "partnership_required"],
  "robots_or_terms_notes": "Summary of observed restrictions or terms.",
  "rate_limit_recommendation": "Conservative crawl delay and max pages per run.",
  "data_surfaces": ["consultations", "final_results", "legal_texts"],
  "record_types": ["tender", "award", "buyer", "document"],
  "freshness_signal": "publication_date | update_date | archive_date | unknown",
  "linkability_keys": ["buyer_name", "company_name", "region", "commune", "legal_reference"],
  "privacy_risk": "low | medium | high",
  "scrape_feasibility": "high | medium | low | avoid",
  "api_feasibility": "high | medium | low | unknown",
  "sample_urls": ["https://..."],
  "known_blockers": ["captcha", "authenticated workflow"],
  "recommended_next_step": "api_probe | sitemap_probe | manual_review | partnership_request | avoid_collection"
}
```

For every extracted record, preserve provenance:

```json
{
  "record_id": "source_specific_id_or_hash",
  "source_id": "stable_slug",
  "record_type": "tender | award | legal_text | report | dataset | procedure | company_reference | statistic",
  "title": "Record title",
  "description": "Short normalized description",
  "language": "fr | ar | amazigh | en | mixed | unknown",
  "published_at": "YYYY-MM-DD or null",
  "updated_at": "YYYY-MM-DD or null",
  "source_url": "https://...",
  "document_urls": ["https://..."],
  "issuing_entity": "Institution name or null",
  "related_entities": ["company, public buyer, ministry, commune, region"],
  "geography": {
    "country": "Morocco",
    "region": null,
    "province": null,
    "commune": null
  },
  "classification": {
    "domain": "procurement | legal | company | land | permits | complaints | budget | audit | trade | tax | statistics | employment",
    "category": "source-specific category",
    "keywords": []
  },
  "extraction": {
    "method": "api | html | pdf | manual_review",
    "extracted_at": "ISO-8601 timestamp",
    "content_hash": "sha256 if available",
    "parser_version": "version or git hash"
  },
  "quality": {
    "confidence": 0.0,
    "missing_fields": [],
    "needs_manual_review": false,
    "notes": null
  }
}
```

## Crawl And Extraction Rules

1. Start with source discovery:
   - Check official homepage navigation.
   - Check sitemap and robots.txt where available.
   - Check for documented APIs, RSS feeds, search endpoints, downloadable indexes and static archives.
   - Identify document formats: HTML, PDF, XLS/XLSX, CSV, JSON, XML, ZIP.

2. Prefer least intrusive access:
   - API before HTML scraping.
   - Dataset download before page-by-page scraping.
   - Search result pages before deep crawling.
   - Metadata extraction before full-text extraction.

3. Use conservative crawling:
   - Default delay: at least 5 seconds between requests per host unless an API explicitly permits more.
   - Stop on repeated 403, 429, CAPTCHA, login wall or unusual server errors.
   - Use a clear user agent that identifies the project and contact when running a real crawler.
   - Cache responses and avoid repeated downloads.

4. Respect legal and privacy boundaries:
   - Do not bypass authentication or payment.
   - Do not collect private complaint narratives, private taxpayer records, private land ownership records or non-public company documents.
   - Do not infer sensitive personal facts.
   - Flag high-risk data for manual/legal review before storage or publication.

5. Normalize but do not erase provenance:
   - Keep original titles and original URLs.
   - Store language and source-specific category.
   - Keep document IDs, bulletin numbers, tender references, dates and issuing authorities.
   - Preserve raw files where legally allowed and useful for reproducibility.

6. Validate records:
   - Compare visible dates against document dates where possible.
   - Detect duplicate documents by URL and content hash.
   - Keep a source freshness log.
   - Mark records needing OCR, translation or manual review.

## First-Pass Deliverables

Produce these artifacts before building full scrapers:

1. `source_inventory.jsonl`
   - One source-profile record per portal.

2. `portal_probe_report.md`
   - Human-readable summary of each portal, discovered access routes, sample URLs, data value, blockers and recommended next step.

3. `sample_records.jsonl`
   - Five to twenty representative public records per feasible portal, with provenance.

4. `extraction_backlog.md`
   - Ordered backlog of scrapers/parsers to build, grouped by highest product value and lowest access risk.

5. `compliance_notes.md`
   - Terms/robots observations, privacy risks, authenticated surfaces to avoid, paid-document boundaries and partnership-needed surfaces.

## Initial Backlog Recommendation

Build in this order unless discovery proves a portal is blocked or lower value than expected:

1. `data.gov.ma` CKAN catalogue harvester.
2. PMMP public tender/result metadata harvester.
3. SGG Bulletin Officiel document catalogue and legal-text metadata harvester.
4. HCP publication/dataset catalogue harvester.
5. Cour des Comptes report catalogue harvester.
6. LOF budget-document catalogue harvester.
7. Conseil de la Concurrence decisions/publications harvester.
8. PortNet public procedure and guide catalogue harvester.
9. Office des Changes regulation/statistics catalogue harvester.
10. Emploi-public concours catalogue harvester.
11. Chikaya public aggregate/statistics harvester only.
12. ANCFCC public procedure catalogue only.
13. Rokhas public permit catalogue only.
14. DGI public tax guidance/procedure catalogue only.
15. ADII public customs guidance/procedure catalogue only.
16. Directinfo public metadata mapping only; pursue partnership for deeper official business-register data.

## Stop Conditions

Stop immediately and report a blocker if:

- The portal requires login for the target data.
- The portal presents CAPTCHA or anti-automation controls.
- The target content appears paid, private or restricted.
- The data includes personal complaint content, private taxpayer data or private land-owner data.
- The host returns repeated 403, 429 or server errors.
- Terms of use or robots rules disallow the intended collection.

When stopped, output a partnership or manual-review recommendation instead of attempting workaround behavior.

## Success Criteria

The work is successful when a reviewer can answer:

- Which official portals matter most?
- What exact public data surfaces does each portal expose?
- Which access method is safest and most reliable?
- Which portals can be harvested immediately?
- Which portals require partnership?
- What schema will preserve provenance, dates, entities, geography and source links?
- What data can clarify Moroccan public procurement, administrative procedures, legal obligations, budgets, audits, markets and public-service friction?

---

## Execution Log — First Pass Completed (2026-07-15)

The first-pass reconnaissance described above was executed on 2026-07-15. All 17 portals were probed live (robots.txt, homepages, sitemaps, documented API endpoints) using an identified research user agent, conservative pacing, and no authentication, CAPTCHA or paywall bypass.

### Deliverables produced

All five first-pass artifacts now exist in the `scraping/` directory at the repo root:

| Artifact | Content |
|---|---|
| `scraping/source_inventory.jsonl` | 17 source-profile records in the required schema |
| `scraping/portal_probe_report.md` | Per-portal findings with feasibility matrix |
| `scraping/sample_records.jsonl` | 33 provenance-preserving sample records across 8 feasible portals (PMMP, data.gov.ma, Cour des Comptes, HCP, Conseil de la Concurrence, Emploi-public, Adala, LOF) |
| `scraping/extraction_backlog.md` | 16-item ordered build backlog plus shared-fetcher infrastructure notes |
| `scraping/compliance_notes.md` | Robots rules, WAF blockers, privacy red lines, licensing notes, partnership asks |

### Key findings

- **data.gov.ma**: CKAN API confirmed live at `https://www.data.gov.ma/data/api/3/action/` (the root `/api/3/` path 404s). 663 datasets, 48 producer organizations, explicit ODbL licensing, fresh updates. Full catalogue sync ≈ 70 API calls. Recommended first build.
- **PMMP**: all target surfaces have public search URLs (`AllCons`, `AllAnn`, `AvisAttribution`, `AvisExtraitPV`, `AvisRapportAchevement`, `EntrepriseRechercherSocietesExclues`, `EntrepriseVisualiserEntitesAchatsRecherche`, `ListePPs`). The repo's existing `backend/scraper.py` already harvests the consultations surface; the awards/results/buyers extension is the highest-value next build.
- **High feasibility**: Cour des Comptes and Conseil de la Concurrence (WordPress with publication/case-study sitemaps), LOF and Office des Changes (Drupal with direct PDF links), Emploi-public (UUID-keyed concours detail pages).
- **Robots constraints**: HCP disallows `/download/` (bulk files) and Emploi-public disallows its concours document `/download/` paths — both are catalogue/metadata-only targets with deep links instead of mirrored documents.
- **Blockers (stop conditions triggered)**: Directinfo/OMPIC has reCAPTCHA plus paid documents (partnership only); tax.gov.ma returned 503/405 behind a WAF; douane.gov.ma actively rejected requests via F5 BIG-IP. All three marked avoid/manual-review.
- **Correction to tiering assumption**: Rokhas is a pure client-side React SPA with no server-rendered content — partnership target, not a scrape target.

### Not yet done (next steps)

- Build backlog items 1–6 (CKAN harvester, PMMP awards extension, CDC/Conseil-Concurrence/LOF/OC harvesters).
- Manual-review passes for SGG postback flow, Adala `_next/data` routes, PortNet sitemap, HCP bulk-access request.
- Initiate partnership requests listed in `scraping/compliance_notes.md` (TGR/PMMP, OMPIC, HCP, ADII, Rokhas/PortNet).
