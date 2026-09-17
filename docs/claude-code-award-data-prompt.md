# Claude Code Prompt: PMMP Award Data Retrieval

Use this prompt with Claude Code from the repository root.

````text
You are working in the `public_market_annonce` repository. Your task is to investigate and implement a reliable way to retrieve Moroccan public-procurement award information from the official PMMP portal.

Goal
Build or spike the data pipeline needed to answer, per awarded tender:

1. Who won?
   - Winner / retained bidder / attributaire / concurrent retenu.
2. How much was it worth?
   - Awarded amount / montant de l'offre retenue / montant attribue / montant TTC.
3. How many competitors lost?
   - Count all bidders/participants, identify winner(s), then derive losers as participants minus winners when the document supports it.
   - Also preserve rejected/excluded competitors when listed.

Primary official source
- PMMP homepage:
  https://www.marchespublics.gov.ma/pmmp/
- PV extracts search:
  https://www.marchespublics.gov.ma/index.php?AvisExtraitPV=&page=entreprise.EntrepriseAdvancedSearch
- Final results search:
  https://www.marchespublics.gov.ma/index.php?AvisAttribution=&page=entreprise.EntrepriseAdvancedSearch
- Official dematerialization / publication rules PDF:
  https://www.marchespublics.gov.ma/pmmp/download/pdf/1692-23-fr_demat_procedures_pieces_et_documents.pdf

Navigation to verify manually
- `Annonces` -> `Autres annonces` -> `Tous les extraits de PV`
- `Annonces` -> `Autres annonces` -> `Tous les resultats definitifs`
- Optionally also inspect:
  - `Liste des bons de commande attribues`
  - `Liste des marches attribues`

Important context already in this repo
Read these files before coding:

- `docs/award-data-source-research.md`
- `scraping/portal_probe_report.md`
- `scraping/compliance_notes.md`
- `backend/scraper.py`
- `backend/config.py`
- `backend/database.py`

Expected finding
The richest source should be `Tous les extraits de PV`, because the PV/result documents are expected to include:

- list of competitors who submitted bids
- amounts proposed by competitors
- excluded/rejected competitors
- retained competitor / attributaire
- retained amount

`Tous les resultats definitifs` is probably better for winner + amount but may be weaker for participant counts. Treat this as a hypothesis and verify it on real samples.

Do not assume fields exist because labels exist in legal templates. Verify on real current PMMP records.

Implementation approach

Phase 1: Map the source pages
1. Open the PMMP public pages manually or programmatically.
2. Confirm that the two direct URLs above still resolve to the expected public search screens.
3. Inspect the HTML/forms/postback behavior.
4. Identify how search results are paginated.
5. Identify links from result rows to detail pages, downloadable PDFs, or published PV/result documents.
6. Document exact URLs, query params, form fields, hidden state fields, and link patterns discovered.

Phase 2: Pull a small verification sample
1. Retrieve 5 to 10 real records from `AvisExtraitPV`.
2. Retrieve 5 to 10 real records from `AvisAttribution`.
3. For each record, preserve:
   - source type: `pv_extract` or `final_result`
   - source URL
   - tender reference
   - buyer/entity
   - title/object
   - publication date when available
   - document URL(s)
   - raw HTML/PDF text snippet used for extraction
4. If documents are PDFs, extract text with a deterministic local tool first.
5. Use OCR only when text extraction fails, and mark OCR-derived values as lower confidence.

Phase 3: Extract award fields
Implement extraction that returns a normalized object like:

```json
{
  "source_type": "pv_extract",
  "source_url": "https://www.marchespublics.gov.ma/...",
  "document_url": "https://www.marchespublics.gov.ma/...",
  "tender_reference": "string",
  "buyer": "string",
  "title": "string",
  "published_at": "YYYY-MM-DD or null",
  "winner_name": "string or null",
  "winner_ice": "string or null",
  "awarded_amount": "number or null",
  "awarded_amount_currency": "MAD",
  "participants_count": "number or null",
  "losers_count": "number or null",
  "participants": [
    {
      "name": "string",
      "bid_amount": "number or null",
      "status": "winner|rejected|not_retained|unknown"
    }
  ],
  "extraction": {
    "method": "html|pdf_text|ocr|manual_sample",
    "confidence": "high|medium|low",
    "extracted_at": "ISO datetime",
    "evidence": [
      {
        "field": "winner_name",
        "quote": "short source quote",
        "source": "html|pdf",
        "page": "number or null"
      }
    ]
  }
}
```

Extraction rules
- Never fabricate winner, amount, participant count, or loser count.
- If a tender is cancelled, unsuccessful, infructueux, deserted, or has no retained winner, set `winner_name` to null and record the outcome/status explicitly.
- If multiple lots have different winners, represent award data per lot. Do not collapse multiple-lot results into one fake winner.
- `losers_count` is only valid when `participants_count` and winner count are both known.
- If only rejected competitors are listed, store `rejected_count` separately or use participant statuses, but do not pretend it equals all losers unless the document proves it.
- Preserve source evidence for each extracted field.
- Normalize Moroccan amounts carefully:
  - Accept spaces, non-breaking spaces, commas, dots, `DH`, `MAD`, `Dhs`, and `TTC`.
  - Do not lose decimals.
- Normalize company names conservatively. Keep the original string.

Technical constraints
- Reuse the existing PMMP scraping style in `backend/scraper.py` where possible.
- Use `httpx` and `BeautifulSoup` if this remains consistent with the repo.
- Respect portal fragility:
  - use a normal browser-like user agent from existing config
  - follow redirects
  - keep request rate low
  - add retries/backoff
  - do not hit authenticated/private enterprise or buyer workspaces
  - do not bypass CAPTCHA or WAF protections
- The portal may use PRADO/Atexo session state and hidden form fields. Capture and replay state correctly instead of hardcoding brittle requests.
- Direct raw requests may sometimes return WAF/interstitial/generic pages. Detect that and fail gracefully.

Deliverables
1. A short source-mapping note, either appended to `docs/award-data-source-research.md` or added as a new doc under `docs/`.
2. A small probe script or module that can fetch and parse a limited sample from the award/PV surfaces.
3. Parser code that extracts the fields above from real sample records.
4. A JSONL sample output file under `scraping/` or another appropriate data/research folder.
5. Tests for the parser using saved HTML/PDF text fixtures, not live network calls.
6. Clear notes about remaining unknowns:
   - exact field completeness
   - HTML vs PDF placement
   - OCR frequency
   - portal terms/robots/redistribution constraints

Suggested filenames
- `scraping/award_probe.py`
- `scraping/award_samples.jsonl`
- `docs/award-data-extraction-map.md`
- `backend/award_parser.py`
- `backend/tests/test_award_parser.py`

Acceptance criteria
- The work demonstrates at least 5 real records where winner and amount are extracted or explicitly marked unavailable with evidence.
- At least 3 records must include a participant count or a documented reason why participant count cannot be derived.
- The code handles a no-award / unsuccessful / cancelled case if one appears in the sample.
- Every extracted winner, amount, and count has source evidence.
- Tests pass locally.
- The final notes state whether the best production source is:
  - `AvisExtraitPV`
  - `AvisAttribution`
  - both combined
  - or a different PMMP surface.

Final response format
Report:
1. What source pages were verified.
2. Which fields were successfully extracted.
3. Sample records count.
4. Where the code and sample output live.
5. What remains risky or unknown.
````
