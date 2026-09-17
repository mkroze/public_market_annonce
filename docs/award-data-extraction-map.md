# PMMP Award-Data Extraction Map

> Probe + parser spike, **2026-09-15**. Answers the "Verify next" items in
> [`award-data-source-research.md`](./award-data-source-research.md): where the
> *attributaire / montant / nombre de soumissionnaires* actually live, and
> whether to build on `AvisExtraitPV`, `AvisAttribution`, both, or another PMMP
> surface. Companion code: [`scraping/award_probe.py`](../scraping/award_probe.py),
> [`backend/award_parser.py`](../backend/award_parser.py),
> [`backend/test_award_parser.py`](../backend/test_award_parser.py); sample output:
> [`scraping/award_samples.jsonl`](../scraping/award_samples.jsonl).

## TL;DR — verdict on the production source

- **Both surfaces are the same list, filtered by one field.** `Tous les extraits
  de PV` and `Tous les résultats définitifs` are the *same* PMMP advanced-search
  screen with a different `annonceType` value (`5` = extrait de PV, `4` =
  résultat définitif). Live counts on 2026-09-15: **95 144 PV extracts**,
  **37 746 résultats définitifs**. Both resolve, both paginate identically.
- **The award payload is not in the portal HTML — it is inside the published
  PDF** (Extrait de PV / Résultat définitif). The search rows carry only the
  tender identity + a "Résultat définitif" icon and a link back to the
  consultation. Winner, montant and bidder lists come from parsing the PDF.
- **Recommended production source: `AvisExtraitPV` (annonceType=5) as primary,
  `AvisAttribution` (annonceType=4) as a fallback/supplement.** The Extrait de
  PV is the *richest* document — it lists all bidders, the évincés, the
  admissibles, per-bidder amounts, and the retained bidder — so it is the only
  one from which `participants_count` and `losers_count` are derivable. The
  Résultat définitif reliably gives winner + montant but is thin on bidder
  counts (see MEM sample). Ingest PV extracts first; use résultats définitifs to
  fill winner/amount where a PV is missing or unreadable.

## Phase 1 — Source-page mapping (verified live)

### URLs and how the filter is really applied
| What | Value |
|---|---|
| Landing (PV) | `https://www.marchespublics.gov.ma/index.php?page=entreprise.EntrepriseAdvancedSearch&AvisExtraitPV` |
| Landing (résultats définitifs) | `…&AvisAttribution` |
| Form `action` | `/index.php?page=entreprise.EntrepriseAdvancedSearch&AllAnn` (POST) |
| Announce-type select | `ctl0$CONTENU_PAGE$AdvancedSearch$annonceType` |
| Announce-type values | `2`=info, **`4`=résultat définitif**, **`5`=extrait de PV**, `6`=rapport d'achèvement, `8`=décision de résiliation, `9`=rapport de présentation |
| Publication-date range | `…$dateMiseEnLigneCalculeStart` / `…$dateMiseEnLigneCalculeEnd` (dd/mm/yyyy; defaults to last 6 months) |
| Submit button | `ctl0$CONTENU_PAGE$AdvancedSearch$lancerRecherche` = `Lancer la recherche` |
| Result count | Text `Nombre de résultats : N` |
| Result rows | `<table class="table-results">`; each data row has hidden `…$refCons` + `…$orgCons` |
| Detail link | `?page=entreprise.EntrepriseDetailConsultation&refConsultation=<ref>&orgAcronyme=<org>` |

### PRADO/Atexo gotchas (this is the fragile part)
The portal is a PRADO/Atexo stateful app. Two non-obvious things had to be right
before the announce-type filter actually applied — both are encoded in the probe:

1. **Replay the whole form, including the ~16 KB `PRADO_PAGESTATE`**, then set
   `annonceType`, the date range, and the submit button, and POST to the form's
   own `action` (`…&AllAnn`). A partial post silently returns the default
   consultations list or "Aucun résultat".
2. **Do NOT replay the two `<textarea>` fields** (`…$qualification$libelleQualif`
   and `…$domaineActivite$idsDomaines`). Posting them back makes the search
   return *Aucun résultat* even when the filter is valid. Omitting them is what
   makes `annonceType` bite. (`_collect_form` in the probe skips textareas for
   this reason.)
3. **Use a fresh HTTP session per surface.** Reusing one `httpx.Client` across
   the PV and the attribution search corrupts the per-session PRADO state and
   the second search returns 0 rows.

Pagination: a `listePageSize` select (10/20/50/100/500) plus `numPageTop` /
`numPageBottom` inputs drive paging; each page is another PRADO postback with the
refreshed `PRADO_PAGESTATE`.

### Where the award document is reached
The result row links to `EntrepriseDetailConsultation`. On a genuinely awarded &
closed tender, that page renders a `panelDetailsAnnonce` block and exposes the
published **Extrait de PV / Résultat définitif** document (a PDF). Freshly
published consultations that merely carry the result-announce icon do not yet
render award content — so ingestion must target closed tenders (older
publication-date windows) and follow the PV/résultat document link.

> Note: the portal serves no robots.txt (redirects to the homepage). Compliance
> notes mandate a ≥5 s/host delay, browser-like UA (reused from `backend/config`),
> redirect-following, and a circuit-breaker on repeated 403/429/CAPTCHA. The
> probe uses a 6 s inter-request delay and bails on any WAF/interstitial marker.

## Phase 2/3 — Verification sample (5 real records)

Extracted with deterministic `pypdf` text; OCR only where fonts garble text.
Full objects in [`scraping/award_samples.jsonl`](../scraping/award_samples.jsonl).

| Key | Type | Ref | Winner | Amount (MAD) | Participants | Losers | Outcome | Confidence |
|---|---|---|---|---|---|---|---|---|
| bkam_14_2024 | pv_extract | 14/AOO/BKAM/2024 | TROPICANA PLANTES | per-lot: 1 765 520,53 / 1 324 044,39 / 650 153,01 | 3 | n/a (3 lots) | awarded | high |
| auej_20_2019 | pv_extract | 20/AUEJ-SB/2019 | SHORA AUDITING SARL | 26 976,00 | 4 | 3 | awarded | high |
| mem_1_2021 | final_result | 1/2021/DSI | *(name garbled → null)* | 150 664,00 | — | — | awarded | low (OCR) |
| auej_15_2019 | pv_extract | 15/AUEJ-SB/2019 | — | — | 0 | — | **infructueux** | high |
| uit_21_2025 | pv_extract | 21/PUITK/2025 | — | — | 0 | — | **infructueux** | high |

Every extracted winner / amount / count carries a short source `quote` in the
record's `extraction.evidence[]`.

### What the Extrait de PV template gives us (confirmed on real samples)
The standardized PV has label-anchored sections the parser keys off:
- `Liste des concurrents ayant déposé un pli` → **participants** (bulleted;
  `Néant` = 0).
- `Liste des concurrents évincés / écartés à l'issue de l'examen…` → **rejected**
  (kept as `status: rejected`, counted separately in `rejected_count`).
- `Liste des concurrents admis sans/avec réserve` → admissibility (informational).
- `Montant des actes d'engagement…` table → **per-bidder bid amounts** (the
  amount sits on the bidder's line or the next line).
- `Concurrent retenu` / `Soumissionnaire retenu` → **winner** (single line, or a
  per-lot table for multi-lot awards) + retained amount.
- `Justification du choix de l'attributaire` → marks the end of the winner block.
- `La commission déclare l'appel d'offres infructueux` → **no-award** (winner
  null, `outcome=infructueux`).

## Extraction rules honoured (see `backend/award_parser.py`)
- **No fabrication.** Anything the document does not support stays `null`; every
  scalar award field gets an evidence quote.
- **Amounts** normalized for space / non-breaking-space thousands, comma-or-dot
  decimals, and DH/MAD/DH TTC suffixes; decimals preserved; a 3-digit "decimal"
  after a dot is treated as a thousands group (`650.153` → 650153).
- **Company names** kept conservatively (original string; only a trailing
  "(3 lots)" annotation is stripped for the `name` field).
- **Multi-lot** awards are represented per lot in `lots[]`; a single scalar
  `losers_count` is intentionally `null` for multi-lot (not meaningful).
- **`losers_count` only when both** `participants_count` and winner count are
  known (single-lot).
- **Rejected ≠ all losers:** évincés are stored separately (`rejected_count` +
  `status: rejected`), never conflated with total losers.
- **Provenance/confidence:** `method` ∈ `html|pdf_text|ocr|manual_sample`; OCR is
  capped at `low`. The MEM résultat définitif is the OCR case — clean amount, but
  the winner name is only recoverable via OCR so it is left null at `pdf_text`
  fidelity and flagged low.

## Remaining unknowns / risks
- **Field completeness across buyers is unconfirmed at scale.** The 5 samples are
  representative but small; some buyers upload scanned (image-only) PVs where
  deterministic text extraction returns little → OCR frequency will be
  buyer-dependent and needs a larger sweep to quantify.
- **Winner ICE is essentially never present** in these documents (`winner_ice`
  stays null). ICE would have to come from a separate OMPIC/registry join
  (phase-2 seam noted in the eligibility work).
- **HTML-vs-PDF placement is settled: PDF.** No sampled surface exposed winner /
  montant in structured HTML; the row HTML is identity-only. Plan for PDF text +
  occasional OCR, not HTML scraping, for the award fields.
- **PRADO state fragility** (see Phase 1 gotchas) means the search driver is
  brittle; a headless browser or Atexo partnership would be more durable than
  replaying `PRADO_PAGESTATE` by hand at volume.
- **Terms / robots / redistribution:** portal serves no robots.txt; publication
  of award results is *mandatory* under Décret n°2-22-431 (public, corporate
  data → low risk), but the portal CGU + redistribution licence remain
  **unconfirmed** — confirm before large-scale scraping or resale, and prefer
  deep-linking the original document URL + retrieval date (compliance notes).
- **Personal data in PVs:** PVs can name committee members / signatories
  (natural persons) → Law 09-08 applies to those fields; keep OCR/redaction
  self-hosted (per the OCR decision in the research doc) and store company-level
  award data only.

## Reproduce
```bash
# Map both surfaces live (confirms URLs + counts + sample refs):
backend/.venv/bin/python scraping/award_probe.py map

# Rebuild the extraction sample JSONL from the real award PDFs:
backend/.venv/bin/python scraping/award_probe.py samples

# Run the offline, fixture-based parser tests:
cd backend && .venv/bin/python -m unittest test_award_parser
```
`pypdf` (deterministic PDF text) is the only extra dependency the probe needs;
the parser + tests are pure-Python and run on the saved `.txt` fixtures with no
network and no PDF library.
