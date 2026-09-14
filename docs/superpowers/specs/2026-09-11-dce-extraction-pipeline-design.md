# DCE Extraction Pipeline — Design Spec

> Date: 2026-09-11. Status: design approved, pending spec review → implementation plan.
> Implements **Feature D2** (DCE extraction checklist) and lays the substrate for **C1** (executive summary), **C3** (eligibility), and **E7** (assistant) from [`../../mp-maroc-opportunity-intelligence-spec.md`](../../mp-maroc-opportunity-intelligence-spec.md). Award-data / OCR compliance context in [`../../award-data-source-research.md`](../../award-data-source-research.md).

## Context & problem

Each tender's DCE is currently downloaded as an **opaque ZIP** cached on `/app/data` (`backend/dce_cache.py`, `dce_cache` table) and is **never parsed**. DCEs are long, boring, heterogeneous documents, frequently in Arabic or mixed FR/AR, with **no consistent structure** ("no norms"). Members must read them to decide whether an opportunity is worth pursuing.

This pipeline turns each cached DCE ZIP into **shared, per-tender intelligence**: flexible structured signals + an open notes section + adaptive tags + a recap-ready markdown context file — without leaking personal data to foreign services.

## Goal (v1)

For every tender that has a cached DCE, produce:
1. A **flexible structured extraction** (core fields where present + open `key_points` + emergent `tags`).
2. A **`context-dce-{id}.md`** recap substrate on `/app/data`.
3. Admin observability (warm-all run log) + lazy on-view trigger.

Extraction is **company-agnostic** (one shared result per tender). Personalization (relevance/eligibility) is applied at read-time from the company profile — out of scope here.

## Non-goals (Phase 2 / later)
- **Video overview "reel"** per DCE — the flagship follow-on; consumes `context-dce-{id}.md`. (Text/audio recap intentionally skipped per product owner.)
- Grounded **AI assistant** over DCEs (E7).
- **Tag → filter promotion UI** (D4 governance) — v1 only stores tags + a frequency view.
- **Eligibility verdicts** (C3) — computed at read-time from the company profile.
- Any personalization inside extraction.

## Decisions log (from brainstorming, 2026-09-11)
| Decision | Choice | Rationale |
|---|---|---|
| Primary job | Structured extraction now; assistant later | Extraction powers the MUST-loop features and is automatable |
| Extraction LLM | **Foreign API (OpenRouter) + local redaction** | Better models + cheap infra; redaction keeps it legal |
| Orchestration | **n8n + OpenRouter** | Visual, iterable prompt/model routing |
| Categorization | **Flexible/adaptive** (open notes + emergent tags) | DCEs have no norms; don't force a taxonomy |
| Recap format | Structured extraction v1; **video reel** as Phase-2 flagship | Substrate first, wow-feature after |
| Pipeline approach | **A — core fields + open notes, DB-stored** | Structure + flexibility; reuses existing DCE batch machinery |

## Architecture & components

| Component | Host | Responsibility | Sees raw PII? |
|---|---|---|---|
| **App backend** | Render (existing) | Trigger + queue, persistence, secured callback. Already holds the ZIP in `dce_cache`. | **No** |
| **OCR + redaction service** | New GPU box (MO/EU, self-host) | Fetch ZIP via signed URL → OCR every file (DeepSeek-OCR, FR/AR) → **redact PII** → return **redacted markdown + doc-type labels + metadata only**. | **Yes — and only here** |
| **n8n** | Self-host or **EU** cloud | Orchestrate: tell OCR box "process tender X" → receive redacted markdown → call OpenRouter → post results to backend callback. | No (redacted only) |
| **OpenRouter** | Foreign | Extraction LLM on redacted markdown → core fields + key_points + tags. | No (redacted only) |

**Compliance invariant:** raw OCR text (names, signatures) is confined to the GPU box; everything downstream (n8n, OpenRouter, storage) is **redacted-only**. This is what makes a foreign extraction API legal under Law 09-08 (see Compliance).

## Data flow (per DCE)
```
backend enqueues tender_id ──webhook──► n8n
  │                                        │ (1) signed ZIP URL (short-lived)
  │                                        ▼
  │                          GPU box: OCR (FR/AR) → redact  [raw text stays here]
  │                                        │ returns: redacted .md + doc_types + ocr/redaction metadata
  │                                        ▼
  │                          n8n → OpenRouter (redacted .md + extraction prompt)
  │                                        │ returns: {core, key_points, tags}
  │        authenticated callback ◄────────┘
  ▼
backend writes: dce_extraction row  +  context-dce-{id}.md on /app/data  +  dce_extraction_log
```

## Data model
- **`dce_extraction`** (one row per tender): `tender_id` PK → `tenders.id`; `core_json` (object, key dates, qualifications, agréments, required documents, financial reqs, lots+amounts, award criteria — each `{value, confidence, source_doc, quote}`, `not_found` allowed); `key_points_json`; `tags_json`; `doc_types_json`; `ocr_lang`; `zip_hash`; `model`; `status` (`ok|partial|failed`); `redaction_stats`; `error`; `extracted_at`.
- **`context-dce-{id}.md`** on `/app/data` — filename via a `hashlib.sha1(tender_id)`-style path (mirror `dce_cache._disk_path`); the recap/reel substrate.
- **`dce_extraction_log`** — mirrors `dce_cache_log` (total/done/skipped/failed/status/actor_email) for admin warm-all observability + resumability.
- Reuse `dce_cache.get_cached` / `ensure_dce_cached` to obtain the ZIP; unzip into a temp dir on the GPU box.
- New `/api` paths (callback + read) added to `restrict_v1_api_surface` allowlist **and** `test_v1_api_surface.py`.

## Extraction contract
- **Core fields (all optional; `not_found` valid; never infer):** object/scope, key dates (deadline, séance d'ouverture, visite/réunion), required qualifications & agréments, required documents, financial requirements (caution, CA min), lots + per-lot amounts, award/selection criteria. Each: `{value, confidence: high|med|low, source_doc, quote}`.
- **`key_points`:** free-form notable clauses/risks (absorbs the unstructured messiness).
- **`tags`:** LLM-proposed themes/keywords; stored free-form; frequency view in admin. Promotion to a real filter is a **manual** admin action later (D4).
- **Provenance:** results tagged `source: dce` (distinct from notice-page `detail`), slotting into the existing `tender_display.display_value` model (`status/source/confidence`). Core items present → `status: ok`; sparse → `partial` ("DCE partiellement analysé").
- **Language:** OCR emits FR/AR; extraction normalizes **output** to French but preserves original-language `quote`s.
- **Rule:** the prompt instructs extract-only-what's-present, mark `not_found`, never fabricate a requirement/date/amount, always attach a grounding `quote`.

## Redaction contract (compliance linchpin)
- **Mask:** individuals' names (gérant, signatories, committee members), CIN, personal phone/email, signature blocks.
- **Keep:** company names, ICE, amounts, dates, technical/qualification text (corporate/non-personal).
- **Method:** local multilingual (FR+AR) NER + regex (CIN/phone/email) on the GPU box. **Conservative: when unsure, mask.**
- **Fail-safe:** redactor error or low confidence → doc is **not** sent onward → `status: failed (redaction_blocked)`. A leak is never the failure mode.
- `redaction_stats` (masked-entity counts) stored for audit.

## Orchestration & trigger
- **n8n** self-hosted (Docker) or on **EU** cloud (CNDP-adequate) — never non-EU hosting.
- **Trigger model (reuse `cache_all_dces` patterns):**
  - **Warm-all batch:** admin-run sweep over tenders with a cached DCE; async workers; **skips already-extracted** (resumable); logs to `dce_extraction_log`; per-run **cost cap**; throttled.
  - **Lazy on-view:** first time a member opens a tender whose DCE isn't yet extracted, enqueue it.
- **Idempotency:** keyed by `tender_id` + `zip_hash`; unchanged DCEs are skipped; re-runs `INSERT OR REPLACE`.
- **Failures:** OpenRouter → n8n retry/backoff → `failed`; some-fields-only → `partial`; long DCEs → chunk + map-reduce; OCR non-parseable → `failed` with reason; no `dce_url` → skip.
- **Callback security:** authenticated (shared secret/signature), validates `tender_id`, allowlisted path.

## Compliance (Law 09-08 / CNDP)
- Cross-border transfer of **personal data** to a non-adequate country needs CNDP authorization (penalty ≤ 300k MAD). DCE PDFs contain personal data (signatories etc.).
- **Design avoids this** by confining raw text to the GPU box and transmitting **only redacted** text to n8n/OpenRouter. n8n hosted in MO/EU (adequate). Company names + amounts are corporate (non-personal), so redacted output is low-risk.
- Separately (not 09-08): confirm the source portal's ToS/robots on scraping + redistribution before scaling (open item, tracked in the award-data research doc).

## Testing & verification
- **Redaction golden-set (compliance-critical):** FR/AR snippets with known PII → assert names/CIN/phone/signatures masked; company/ICE/amounts kept.
- **Extraction contract:** mocked OpenRouter response → assert stored shape, `not_found` handling, **no field without a grounding quote**, no fabrication when absent.
- **End-to-end on 5–10 real DCEs** (the award-research "verify next" sample) → confirm core fields + provenance; **manually validate Arabic OCR quality** on real Moroccan scans before scaling (biggest unknown).
- **Surface test** for callback/read endpoints in `test_v1_api_surface.py`.
- **Guardrail:** assert redaction-blocked items are never sent to OpenRouter.

## Risks & open items
- **Arabic OCR quality** on real (often poorly-scanned) Moroccan DCEs — validate early on samples; may need OCR tuning.
- **Redaction recall** on Arabic PII — the compliance risk; golden-set + conservative masking mitigate.
- **New infra** (GPU box + n8n) is a real ops step for a small team — size the GPU (≥16 GB VRAM for DeepSeek-OCR) and decide n8n hosting.
- **Portal ToS/robots** for scraping+redistribution — confirm.
- **Cost** of extraction at catalog scale — per-run cap + skip-unchanged mitigate; measure on the first warm-all.
