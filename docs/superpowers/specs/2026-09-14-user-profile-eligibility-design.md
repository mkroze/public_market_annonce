# User Profile & Eligibility-Aware Catalog — Design Spec

> Date: 2026-09-14. Status: design approved, pending implementation.
> Implements the product todo **"Informations user"** — *"Informations à retenir des users qui peuvent faciliter les procédures légales. Et aussi filtrer par les types de candidats acceptés. Type d'entreprise. Scrap des données intéressantes depuis un portail ?"*
> This is **Feature D5 (Company relevance profile — keystone)** from [`../../mp-maroc-opportunity-intelligence-spec.md`](../../mp-maroc-opportunity-intelligence-spec.md), plus the first conservative cut of **C3 (eligibility / bidability)**. Downstream of the DCE extraction substrate ([`2026-09-11-dce-extraction-pipeline-design.md`](./2026-09-11-dce-extraction-pipeline-design.md)) which will later supply per-tender eligibility requirements.

## Context & problem

Today the app knows almost nothing about the companies that register. `users` holds a free-text `company` name and nothing else — no legal form, no identifiers (ICE/RC/IF), no sectors of activity, no qualifications/agréments, no size, no geographic coverage. Registration collects only name, email, password, and company.

Moroccan public procurement is **eligibility-gated**: a tender/lot expresses *who may bid* through several mechanisms (procédure ouverte vs. restreinte/concours, catégorie de prestation, **qualifications & agréments** requis — especially for BTP, caution/CA minimums, allotissement, and **lots réservés à la PME/auto-entrepreneur/coopérative** per the "20% réservé PME" rule of décret 2-12-349 / loi 2-14-46 on the PME). A company that *can sell the thing* is often still unable to bid because it lacks the required agrément class or size profile. Relevance ≠ eligibility.

Without a structured company profile the catalog cannot be **"épuré"** — filtered down to what a given company is actually eligible for — and every downstream personalized feature (graded relevance C2, eligibility verdicts C3, actionable alerts C7, missed-opportunity) stays impossible.

This slice builds the **additive, backward-compatible company-profile substrate** and a **first-cut, opt-in eligibility filter** on the catalog. It deliberately does *not* assert legal eligibility — the platform is decision-support only.

## Goal (v1)

1. Capture a structured **company profile** on the member account: legal form, Moroccan identifiers, sectors of activity, qualifications/agréments held, size band, geographic coverage, groupement willingness, and a "procedures I want" preference — all **optional** and progressively fillable.
2. Read/update it through the existing `/api/account` surface (no new top-level namespace, no new surface-guard branch).
3. Add an **opt-in eligibility filter** to `GET /api/tenders` (`eligible_only=1`) that, using the caller's profile, hides tenders the company is provably unable to bid on — conservatively, hiding **only** on hard, data-backed exclusions.
4. Keep everything **backward-compatible**: users with an empty profile see the catalog exactly as today; `eligible_only` defaults off.

## Non-goals (later phases)

- **Per-tender eligibility verdict UI** (C3 five-buckets: satisfied / likely / missing / unknown / blocking). Needs parsed DCE requirements (D2) — deferred.
- **Graded relevance scoring** (C2 Strong/Possible/Weak). Deferred; this slice is a boolean *hide-if-provably-ineligible* filter, not a ranker.
- **Portal scraping / auto-enrichment** of profile data (ICE→RC→agréments lookup). Documented as an open item; not built.
- **Verification** of declared identifiers/agréments (we store what the user declares, `source: user`, unverified).
- **Groupement modelling** beyond a single "je peux candidater en groupement" flag.
- MFA, billing, or any account-lifecycle change beyond the new fields.

## Decisions log (Moroccan-procurement defaults, chosen not blocked)

| Decision | Choice | Rationale |
|---|---|---|
| Where to store | **Extend `users`** via `_add_column_if_missing`, not a new `company_profiles` table | One company per account today; additive columns are the lowest-risk, mirrors how `role/status/theme/phone` were added. A 1-N table is premature. |
| List-valued fields (sectors, agréments, regions) | Store as **JSON text** columns (`profile_sectors_json`, etc.), same pattern as `saved_searches.criteria` / `dce_extraction.*_json` | SQLite has no array type; JSON round-trips cleanly and matches existing precedent. |
| API namespace | Reuse **`/api/account`**: `GET` returns profile, new **`PATCH /api/account/profile`** updates it | Already allowlisted (`/api/account/*`), already auth-gated, already tested — no new surface-guard branch, minimal `test_v1_api_surface.py` churn. |
| Eligibility filter default | **Off** (`eligible_only` absent/`0`) | Backward-compatible; empty profiles and anonymous callers are unaffected. |
| Filter semantics | **Hide only on hard, data-backed exclusion** ("innocent until proven ineligible") | Moroccan tender data is thin; false-hiding a winnable tender is worse than showing a marginal one. Missing tender data or missing profile data → **keep** the tender. |
| Reserved-PME rule | If a tender `reserved_pme` clearly marks it PME/auto-entrepreneur-reserved **and** the profile declares a size band above the PME ceiling, hide it | The one exclusion the current catalog data actually supports (loi PME 2-14-46 20%-réservé). |
| Legal-form / identifiers | Captured for **facilitating legal procedures** (auto-fill candidacy dossier, D1/assistant), **not** used as a hide rule in v1 | We can't reliably map notice-page text to a required legal form yet. |
| Confidentiality | Profile fields are **private to the owner**; never exposed on public reads or to other users | Contains commercial identifiers (ICE/RC/IF/CNSS). |

## Company profile fields (the data model)

All fields **optional**, all `source: user`, all default to empty. Grouped by purpose:

### A. Identity & legal — *facilitates legal procedures (dossier auto-fill), not a hide rule*
| Field | Column | Type | Notes |
|---|---|---|---|
| Forme juridique | `legal_form` | TEXT | Enum-ish: `auto_entrepreneur`, `personne_physique`, `sarl`, `sarl_au`, `sa`, `sas`, `snc`, `cooperative`, `gie`, `association`, `autre`. Stored as string; validated against an allowlist. |
| ICE | `ice` | TEXT | Identifiant Commun de l'Entreprise (15 digits). Stored as declared, not verified. |
| Registre de Commerce (RC) | `rc_number` | TEXT | + `rc_city` free text. |
| Identifiant Fiscal (IF) | `if_number` | TEXT | |
| N° CNSS | `cnss_number` | TEXT | |
| N° Patente / TP | `patente_number` | TEXT | |
| Ville / siège | `hq_city` | TEXT | |

### B. Activity & eligibility drivers — *feed relevance + the eligibility filter*
| Field | Column | Type | Notes |
|---|---|---|---|
| Secteurs d'activité | `profile_sectors_json` | TEXT (JSON array of sector codes) | Mirrors `tenders.sector_code` / `alert_preferences.sectors`. |
| Types de prestation | `profile_categories_json` | TEXT (JSON array) | Subset of `{Travaux, Fournitures, Services}` (maps to `tenders.category`). |
| Qualifications & agréments détenus | `qualifications_json` | TEXT (JSON array of `{secteur, secteur_activite, classe, qualification}` objects) | Free-form but structured; the BTP agrément/qualification-classification system. Declared, unverified. |
| Certifications | `certifications_json` | TEXT (JSON array of strings, e.g. `ISO 9001`, `CMMI`) | |
| Couverture géographique | `coverage_regions_json` | TEXT (JSON array of region names) | Mirrors `alert_preferences.regions`. Empty = national. |
| Mots-clés / produits | `profile_keywords` | TEXT | Comma-separated, mirrors `alert_preferences.keywords`. |

### C. Size & capacity — *feeds the reserved-PME rule + future contract-size fit*
| Field | Column | Type | Notes |
|---|---|---|---|
| Effectif (band) | `size_band` | TEXT | Enum: `micro` (<10), `tpe` (auto-ent./TPE), `pme` (10–200), `eti`, `grande`. |
| Chiffre d'affaires annuel (band, MAD) | `revenue_band` | TEXT | Enum: `lt_1m`, `1m_10m`, `10m_50m`, `50m_200m`, `gt_200m`. Bands, never an exact figure — privacy + it's all the reserved-PME rule needs. |
| Fourchette de marché visée (MAD) | `contract_min` / `contract_max` | INTEGER (minor units or MAD; store MAD integer) | Preferred contract size; future C2 fit, not a v1 hide rule. |

### D. Bidding preferences
| Field | Column | Type | Notes |
|---|---|---|---|
| Candidature en groupement | `bids_in_groupement` | INTEGER (0/1) | If 1, size/agrément exclusions relax (a groupement can pool capacity) — in v1 this simply **disables** the reserved-PME hide, since a groupement can include a PME. |
| Types de procédure préférés | `preferred_procedures_json` | TEXT (JSON array) | e.g. `AOO`, `AOR`, `AMI`, `concours`. Preference/relevance signal, not a hide rule. |
| Filtre "épuré" activé par défaut | `eligibility_filter_default` | INTEGER (0/1) | Persisted UI preference; the catalog reads it to pre-check `eligible_only`. Default 0. |

> **Migration:** every column added idempotently via `_add_column_if_missing(db, "users", …)` in `init_db()`, right after the existing `users` migrations. No table rewrite, no data backfill, no `NOT NULL`.

## How tenders express "who they accept" (the matching surface)

Mapped to what we already store (thin) vs. what needs DCE/portal enrichment:

| Eligibility mechanism | Where in our data today | Usable for v1 filter? |
|---|---|---|
| Type de prestation (Travaux/Fournitures/Services) | `tenders.category` | **Yes** (weak filter: keep if profile has no categories, else require overlap — opt-in only) |
| Secteur | `tenders.sector_code` | Relevance signal, **not** a hide rule (a company may bid outside its declared sectors) |
| Lots réservés PME / auto-entrepreneur | `tender_details.reserved_pme` (free text, notice-page) | **Yes** — the one hard, data-backed hide (size-band vs. reserved flag) |
| Qualifications & agréments requis | `tender_details.qualifications`, `tender_details.agrements` (free text, notice-page — often empty) | **Not yet** as a hide rule — text is unstructured & sparse; deferred to DCE extraction (D2) which normalizes them. Stored profile side is ready. |
| Caution / CA minimum | `tender_details.caution_provisoire` (text) + DCE | **Not yet** — needs parsed numeric minimums (D2) |
| Procédure ouverte vs. restreinte | `tenders.procedure_type` | Preference/relevance only, not a hide rule |
| Allotissement | `tender_details.allotissement` (text) | Deferred — per-lot eligibility needs lot parsing (D2) |

**Where our data is thin / needs scraping:** `qualifications`, `agrements`, `caution_provisoire`, and per-lot / reserved-PME detail come from the **notice page** and are frequently empty or free-text. Reliable eligibility matching on agréments and financial minimums requires the **DCE extraction pipeline** (D2, already designed) to turn the DCE ZIP into normalized `{qualifications, agréments, caution, CA min, lots}` fields — and/or a **portal scrape** that pulls the structured "conditions de participation" block where the source exposes it. Until then, the v1 filter is deliberately limited to the reserved-PME size rule (+ optional category overlap), and the richer profile fields (agréments held, certifications) are captured now so they're ready the moment D2 lands.

## Eligibility-matching rules (v1 — conservative)

Applied **only** when the caller is authenticated **and** passes `eligible_only=1`. Principle: *hide only on a hard, data-backed exclusion; on any doubt or missing data, keep the tender.*

For each tender the filter evaluates:

1. **Reserved-PME exclusion (hard hide).**
   Hide the tender iff **all** of: `tender_details.reserved_pme` clearly indicates PME/auto-entrepreneur reservation (positive parse, not empty/"non"), **and** the profile's `size_band` is above the PME ceiling (`eti` or `grande`), **and** `bids_in_groupement` is not set. Otherwise keep. (Loi 2-14-46 reserves ≥20% to PME; a large company cannot bid the reserved lot alone, but a groupement including a PME can.)

2. **Category overlap (soft hide, only if profile declares categories).**
   If `profile_categories_json` is non-empty **and** the tender's `category` is set **and** not in the profile's categories → hide. If the profile declares no categories, or the tender has no category → keep. (This lets a "Travaux-only" company hide pure Fournitures noise, but never hides on missing data.)

3. **Everything else → keep.** No agrément/qualification/caution/CA hiding in v1 (data too thin). No sector hide (a company may bid outside declared sectors).

The rule set lives in a small, pure, unit-tested function `eligibility.evaluate(tender_row, detail_row, profile) -> {"hidden": bool, "reasons": [...]}` so it's testable in isolation and reusable by future C2/C3 features. The catalog query fetches candidate rows (already LEFT JOINs `tender_details`) and filters in Python for v1 — the reserved-PME parse is not expressible in portable SQL and the result set is already paginated-from-a-modest catalog. (If profiling shows this is too costly at scale, promote the size rule to a SQL predicate later.)

## API changes

All under the already-allowlisted, already-auth-gated `/api/account` + `/api/tenders` surface — **no new surface-guard branch**, only test additions.

### `GET /api/account` — extended response
`account_view(user)` gains a `profile` object (all new fields, JSON columns parsed to arrays). Existing keys unchanged, so existing frontend/tests keep working.

```json
{
  "id": 1, "email": "...", "name": "...", "company": "...", "phone": "...",
  "plan": "free", "role": "user", "status": "active", "theme": "system",
  "email_verified": true, "created_at": "...", "last_login": "...",
  "profile": {
    "legal_form": "sarl", "ice": "", "rc_number": "", "rc_city": "",
    "if_number": "", "cnss_number": "", "patente_number": "", "hq_city": "",
    "sectors": ["1.12"], "categories": ["Travaux"],
    "qualifications": [{"secteur":"Bâtiment","classe":"3","qualification":"..."}],
    "certifications": ["ISO 9001"], "coverage_regions": ["Casablanca-Settat"],
    "keywords": "voirie, assainissement",
    "size_band": "pme", "revenue_band": "10m_50m",
    "contract_min": null, "contract_max": null,
    "bids_in_groupement": false, "preferred_procedures": ["AOO"],
    "eligibility_filter_default": false
  }
}
```

### `PATCH /api/account/profile` — new
Accepts a partial `ProfileUpdate` (all fields optional; only provided keys are written — progressive profiling). Validates: `legal_form` ∈ allowlist (or empty), `size_band` ∈ allowlist, `revenue_band` ∈ allowlist, list fields are arrays of strings/objects, `ice` is digits-only if provided. Serializes list fields to JSON, writes with `_dynamic UPDATE users SET … WHERE id`, returns the full extended `account_view`. Auth-gated via `require_user`; requires `status == active`.

### `GET /api/tenders?eligible_only=1` — extended
New optional query param `eligible_only: bool = False`. When true **and** the request carries a valid bearer token with a non-empty profile, the handler loads the caller's profile and applies `eligibility.evaluate` post-query, adjusting `total`/`pages` to the filtered count. When false, or the caller is anonymous, or the profile is empty → **identical behavior to today**. (No auth is *added* to `/api/tenders` — it stays a public read; the param is simply ignored without a usable token/profile.)

### Surface guard
No new paths need allowlisting — `/api/account/profile` is covered by the existing `path.startswith("/api/account/")` branch, and `/api/tenders` is already public. `test_v1_api_surface.py` gains a case asserting `/api/account/profile` is reachable-but-gated (401 unauth), to lock the behavior in.

## Frontend changes

- **`AccountProfile` type** (`frontend/src/lib/types.ts`) gains an optional `profile?: CompanyProfile` with a new `CompanyProfile` interface mirroring the API shape.
- **API helpers** (`frontend/src/lib/api.ts`): `updateAccountProfile(data: Partial<CompanyProfile>): Promise<AccountProfile>` → `PATCH /api/account/profile`. `getTenders` gains an optional `eligible_only` passthrough on `TenderFilters`.
- **`MemberAccount.tsx`** gains a new **"Profil entreprise"** section (below "Aperçu du compte") with progressive fields: forme juridique (select), identifiers (text inputs, collapsible "identifiants légaux"), secteurs/catégories/régions (multi-select or comma inputs reusing the alerts UI patterns), size/revenue bands (selects), groupement + eligibility-default toggles. Saves independently via `updateAccountProfile`, same feedback pattern as the theme/password sections.
- **Catalog page** (later / optional in this slice): an "Afficher uniquement les consultations éligibles" toggle that sets `eligible_only`, defaulted from `profile.eligibility_filter_default`. The backend filter is the load-bearing part; the toggle is a thin wiring step.

## Migration strategy

- **Purely additive.** All new columns via `_add_column_if_missing`; no existing column changed; no `NOT NULL`; every new column has an empty/`NULL`/`0` default.
- **No backfill.** Existing users get empty profiles → `eligible_only` is a no-op for them → catalog unchanged.
- **Idempotent.** Re-running `init_db()` is safe (that's the whole point of the helper).
- **Rollback-safe.** SQLite keeps unused columns harmlessly; reverting the app code leaves the columns dormant.

## Testing & verification

Backend (unittest, run via `.venv/bin/python -m unittest`):
- **Schema:** `init_db` adds every new `users` column (`PRAGMA table_info`).
- **`GET /api/account`** returns a `profile` object with empty defaults for a fresh user; no `password_hash`.
- **`PATCH /api/account/profile`**: writes a subset, round-trips arrays as arrays, leaves omitted fields untouched (progressive), rejects invalid `legal_form`/`size_band` (422), requires auth (401), rejects non-active (403).
- **`eligibility.evaluate` (pure unit tests):** reserved-PME + large size → hidden; reserved-PME + PME size → kept; reserved-PME + groupement → kept; category mismatch with declared categories → hidden; empty profile → nothing hidden; missing tender data → kept.
- **`GET /api/tenders?eligible_only=1`:** empty profile → same result count as unfiltered; PME-reserved tender hidden for a `grande` profile; `total`/`pages` reflect the filtered set; anonymous caller with the param → unfiltered.
- **Surface:** `/api/account/profile` reachable-but-gated in `test_v1_api_surface.py`.
- **Regression:** full existing suite still green (baseline 224 tests).

Frontend:
- TypeScript build passes with the new `CompanyProfile` type + helper.
- (Manual) profile section renders and saves; catalog toggle passes `eligible_only`.

## Open decisions for the user

1. **`company_profiles` table vs. columns on `users`.** Chosen: columns on `users` (one company per account, lowest risk). If you later need multi-company accounts or an audit trail of profile changes, migrate to a 1-N table. *Default taken; flag if multi-company is on the near roadmap.*
2. **Exact size/revenue band cut-offs.** Used the loi-PME-adjacent bands (`micro/tpe/pme/eti/grande`; revenue `<1M / 1–10M / 10–50M / 50–200M / >200M` MAD). The only band that drives a rule today is "above PME" for reserved lots. *Confirm the PME ceiling you want to treat as the reserved-lot cut (default: `eti` and `grande` are excluded from PME-reserved lots; `micro/tpe/pme` are eligible).*
3. **Category-overlap soft hide.** v1 hides pure-category mismatches only when the profile explicitly declares categories. *Confirm you want this on, or restrict `eligible_only` to the reserved-PME rule alone for maximum caution.*
4. **Identifier verification.** We store ICE/RC/IF/CNSS/patente as **declared, unverified**. Real verification (or auto-fill) needs a portal/registry integration (see below). *Confirm "declared, unverified, private" is acceptable for launch.*
5. **Where the eligibility toggle lives.** Backend is built either way; confirm whether the catalog toggle ships in this slice or waits for the profile to be populated first.

## What still requires portal scraping / DCE extraction

- **Agrément/qualification matching** (the real BTP eligibility gate): needs normalized *required* qualifications/agréments per tender — either the **DCE extraction pipeline (D2)** parsing the CPS, or a **portal scrape** of the structured "conditions de participation / qualifications requises" block. Notice-page `qualifications`/`agrements` are too sparse/free-text to gate on.
- **Financial minimums** (caution provisoire numeric, CA minimum): same — needs D2 to parse numeric thresholds from the DCE.
- **Per-lot eligibility & precise reserved-lot boundaries** (allotissement, which lots are réservés): needs lot-level parsing from the DCE/portal.
- **Identifier auto-enrichment** (ICE → RC/IF/agréments): would need an OMPIC/registre-de-commerce or portal-des-marchés integration; out of scope, flagged for build-vs-buy alongside the award-data research.
- The v1 profile schema is **forward-compatible** with all of the above: `qualifications_json` / `certifications_json` / `contract_min-max` already exist on the profile side, so when D2 lands the matching layer only needs the tender side.
