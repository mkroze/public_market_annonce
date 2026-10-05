# Compliance Notes — Moroccan Public Data Collection

Probe date: 2026-07-15. These notes record observed robots.txt rules, terms-of-use surfaces, WAF behavior, privacy red lines and paid/authenticated boundaries. They bind the backlog in `extraction_backlog.md`.

## Robots.txt observations (per host)

| Host | robots.txt | Constraint that matters |
|------|------------|--------------------------|
| marchespublics.gov.ma | None (redirects to homepage) | No stated crawl rules; apply self-imposed ≥5 s delay; avoid agent/enterprise authenticated spaces |
| data.gov.ma | Present (Drupal defaults) | Content allowed; only `/core/`, `/profiles/`, admin paths disallowed. Prefer CKAN API anyway |
| sgg.gov.ma | 404 | No stated rules |
| adala.justice.gov.ma | 404 (SPA response) | No stated rules |
| directinfo.ma | None served | Irrelevant — CAPTCHA + paid content forbid automation regardless |
| **hcp.ma** | Present | **`Disallow: /download/` and `/docs/` (bulk files). Catalogue pages allowed. Sitemaps provided.** Do not fetch disallowed paths |
| ancfcc.gov.ma | None (homepage returned) | No stated rules; privacy red line dominates (see below) |
| chikaya.ma | 404 | No stated rules; privacy red line dominates |
| rokhas.ma | Present | `Disallow:` (all allowed) — moot, SPA with authenticated workflows |
| portnet.ma | Present | All allowed; sitemap declared at `http://portnet.ma:8080/sitemap.xml` (verify port before use) |
| **emploi-public.ma** | Present | **Disallows `/fr/*/download/` and `/ar/تحميل/*` (concours/results/experts documents) in both languages.** Metadata pages allowed |
| lof.finances.gov.ma | Connection failed on probe | Retry later; page traffic works. Assume no rules but keep conservative pace |
| courdescomptes.ma | Present (Yoast) | All allowed; sitemap index provided |
| conseil-concurrence.ma | Present (Yoast) | All allowed; sitemap index provided |
| **tax.gov.ma** | **503 (WAF)** | Treat as do-not-crawl until manually reviewed |
| **douane.gov.ma** | **F5 WAF "Request Rejected"** | WAF actively filters; robots intent unknowable. Manual-paced access to specific public documents only |
| oc.gov.ma | Present (Drupal defaults) | Content allowed |

## WAF / anti-automation surfaces (stop conditions triggered)

- **tax.gov.ma (DGI)**: 503 on robots.txt, 405 on `/wps/portal`. Do not automate; manual browser mapping first.
- **douane.gov.ma (ADII)**: F5 BIG-IP rejection page with support ID on robots.txt while `/web/guest` serves. Any repeated rejection ⇒ stop and log, per stop conditions.
- **directinfo.ma (OMPIC)**: Google reCAPTCHA on public search. Automation prohibited by our own rules; partnership route only.

## Paid / authenticated boundaries (never bypass)

- **Directinfo**: company legal documents (statutes, financial statements, minutes) are paid products of OMPIC. Only free public metadata surfaces may even be referenced. Review `https://www.directinfo.ma/assets/documents/Mentions-legales-directinfo.pdf` before any Directinfo-related feature ships.
- **PMMP**: agent (`agent.AgentHome`) and enterprise workspaces, bid submission, caution électronique (`/caution/`) are authenticated — out of scope. Public search surfaces only.
- **Rokhas**: permit workflows behind accounts; public SPA shell contains no data.
- **PortNet**: single-window operational services are authenticated; public procedure/guide pages only.
- **HCP**: some databases require registration; do not create automated accounts.

## Privacy red lines (data we must not collect)

1. **Chikaya**: complaint narratives, complainant identity, complaint tracking data — personal data. Only site-published aggregate statistics and the administration taxonomy.
2. **ANCFCC**: land-owner names, title deeds, parcel ownership — even where a lookup succeeds, this is protected personal/property data. Procedure descriptions, fees and required-document lists only.
3. **DGI**: any taxpayer-specific data. Public guidance/forms only.
4. **Emploi-public**: concours *results* pages can contain candidate names (personal data). If results are ingested, store pass/fail statistics and result-page URLs, not candidate name lists, pending legal review under law 09-08 (Moroccan data-protection law) and CNDP guidance.
5. **Directinfo/OMPIC**: natural-person identifiers of company managers require care under 09-08 even when technically public.

## Attribution, licensing and reuse

- **data.gov.ma**: datasets carry explicit licenses (ODbL observed) — record `license_id`/`license_title` per dataset and honor share-alike/attribution terms downstream. This is the only portal with clean machine-readable licensing; treat it as the model.
- Other portals publish no explicit reuse license. Moroccan law 31-13 (right of access to information) supports reuse of proactively published public information, but per-portal terms pages should be captured and reviewed before commercial redistribution. Always attribute with original URL + retrieval date (the record schema enforces this).
- Preserve original titles/URLs; do not rehost paid or robots-disallowed documents — deep-link instead.

## Operational rules encoded in the shared fetcher

1. User agent identifies the project and a contact email.
2. ≥5 s/host between requests (2–3 s acceptable for the documented CKAN API); nightly/off-peak runs.
3. Circuit breaker: 2 consecutive 403/429/CAPTCHA/WAF responses ⇒ halt host for 24 h and log a blocker.
4. Response cache keyed by URL + content hash; never re-download unchanged documents.
5. Robots.txt re-checked at the start of every run (rules above are a snapshot, not a grant).

## Partnership requests to initiate

| Institution | What to ask for | Unblocks |
|---|---|---|
| TGR / PMMP (marchespublics@tgr.gov.ma) | Official data access / API for tenders, awards, buyers | Item 2 durability |
| OMPIC | Directinfo API / bulk company-reference licence | Item 16 |
| HCP | Bulk access to `/download/` statistical files | Item 8 completeness |
| ADII | Circulars/tariff data feed | Item 15 |
| Karaz/Rokhas & PortNet | Procedure-catalogue data sharing | Items 11, 13 |
