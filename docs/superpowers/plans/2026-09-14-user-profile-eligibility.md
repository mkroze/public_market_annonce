# User Profile & Eligibility-Aware Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for every task, and superpowers:subagent-driven-development or superpowers:executing-plans to work task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Design: [`../specs/2026-09-14-user-profile-eligibility-design.md`](../specs/2026-09-14-user-profile-eligibility-design.md).

**Goal:** Capture a structured, optional **company profile** on the member account and add a conservative, **opt-in eligibility filter** (`eligible_only`) to the catalog that hides only tenders a company is provably unable to bid on. Fully additive and backward-compatible: empty profiles and anonymous callers see the catalog unchanged.

**Architecture:** Add profile columns to `users` via the existing `_add_column_if_missing` migration path. Keep the eligibility rule set in a small, pure, unit-tested module (`backend/eligibility.py`). Extend the already-allowlisted `/api/account` surface with a `PATCH /api/account/profile` endpoint and enrich `GET /api/account`. Add an optional `eligible_only` param to `GET /api/tenders` that applies the rule set post-query when a valid token + non-empty profile are present. Wire the frontend `AccountProfile` type, an API helper, and a "Profil entreprise" section in `MemberAccount.tsx`.

**Tech Stack:** FastAPI, Pydantic v2, aiosqlite, SQLite, React 19, TypeScript, React Router, lucide-react, Tailwind/DaisyUI classes, unittest/TestClient.

## Global Constraints

- **Every** schema change is additive (`_add_column_if_missing`); no `NOT NULL`, no backfill, no table rewrite.
- **No new surface-guard branch:** `/api/account/profile` is covered by the existing `/api/account/` allowlist; `/api/tenders` stays a public read. Only add a lock-in case to `test_v1_api_surface.py`.
- **Backward-compatible catalog:** `eligible_only` defaults off; empty profile or anonymous caller → identical to today's `/api/tenders`.
- **Conservative eligibility:** hide only on a hard, data-backed exclusion; on missing tender data or missing profile data, **keep** the tender.
- Profile fields are **private to the owner**, `source: user`, unverified; never exposed on public reads.
- List-valued fields stored as **JSON text** columns (mirrors `saved_searches.criteria`).
- The platform never asserts legal eligibility; this is decision-support only.
- Do not commit or push.

---

## File Structure

- Modify `backend/database.py`: add profile columns to `users` in the `init_db` migrations block.
- Create `backend/eligibility.py`: profile parsing helpers + the pure `evaluate(tender_row, detail_row, profile)` rule set + `reserved_pme` parse + band constants.
- Modify `backend/main.py`: extend `account_view` with a `profile` block; add `ProfileUpdate` model + `PATCH /api/account/profile`; add `eligible_only` param to `list_tenders` and apply the filter.
- Create `backend/test_company_profile.py`: schema, account read, profile update (validation, progressive, auth) coverage.
- Create `backend/test_eligibility.py`: pure rule-set unit tests + `eligible_only` catalog integration tests.
- Modify `backend/test_v1_api_surface.py`: assert `/api/account/profile` reachable-but-gated.
- Modify `frontend/src/lib/types.ts`: add `CompanyProfile` interface; add `profile?` to `AccountProfile`; add `eligible_only?` to `TenderFilters`.
- Modify `frontend/src/lib/api.ts`: add `updateAccountProfile`; pass `eligible_only` through `getTenders`.
- Modify `frontend/src/pages/member/MemberAccount.tsx`: add the "Profil entreprise" section.

---

### Task 1: Schema — company-profile columns on `users`

**Files:** Modify `backend/database.py` (users migrations block, ~line 285–293). Create `backend/test_company_profile.py`.

**Interfaces:** Consumes `database.init_db()`, `_add_column_if_missing`. Produces the new `users` columns.

- [ ] **Step 1 — Failing schema test.** In `backend/test_company_profile.py`, follow the `test_account.py` setup (temp DB, `database.DB_PATH`, `init_db`). Assert `PRAGMA table_info(users)` contains: `legal_form`, `ice`, `rc_number`, `rc_city`, `if_number`, `cnss_number`, `patente_number`, `hq_city`, `profile_sectors_json`, `profile_categories_json`, `qualifications_json`, `certifications_json`, `coverage_regions_json`, `profile_keywords`, `size_band`, `revenue_band`, `contract_min`, `contract_max`, `bids_in_groupement`, `preferred_procedures_json`, `eligibility_filter_default`. Run → red.
- [ ] **Step 2 — Add columns.** In `database.py`, after the existing `users` migrations, add one `_add_column_if_missing` per column. Text columns `DEFAULT ''` (except identifiers which may stay `NULL`), `contract_min`/`contract_max` `INTEGER` (nullable), `bids_in_groupement`/`eligibility_filter_default` `INTEGER DEFAULT 0`, JSON columns `TEXT DEFAULT '[]'`. Run → green.

**Verification:** `.venv/bin/python -m unittest test_company_profile` passes; full suite still green.

---

### Task 2: Eligibility rule module (pure, unit-tested)

**Files:** Create `backend/eligibility.py`, `backend/test_eligibility.py`.

**Interfaces:** Produces `LEGAL_FORMS`, `SIZE_BANDS`, `REVENUE_BANDS` constants; `parse_profile(user_row) -> dict`; `is_reserved_pme(text) -> bool`; `evaluate(tender_row, detail_row, profile) -> {"hidden": bool, "reasons": [str]}`; `profile_is_empty(profile) -> bool`.

- [ ] **Step 1 — Failing rule tests.** In `test_eligibility.py` cover: reserved-PME tender + `size_band="grande"` → `hidden=True`; + `size_band="pme"` → `hidden=False`; + `grande` but `bids_in_groupement=1` → `hidden=False`; category `"Fournitures"` with profile categories `["Travaux"]` → hidden; empty tender category → kept; empty profile → `hidden=False` for everything; `is_reserved_pme` true for `"Oui"`/`"Réservé PME"`/positive Arabic-or-French phrasings and false for `""`/`"Non"`. Run → red.
- [ ] **Step 2 — Implement.** Constants + a defensive `is_reserved_pme` (empty/"non"/"no" → False; explicit positive markers → True), `parse_profile` (JSON-load the `_json` columns, coerce `0/1`, tolerate `None`), `profile_is_empty`, and `evaluate` applying the two rules from the design (reserved-PME hard hide, category soft hide) with a keep-on-doubt default. Run → green.

**Verification:** `.venv/bin/python -m unittest test_eligibility` passes.

---

### Task 3: Account API — read + update profile

**Files:** Modify `backend/main.py` (`account_view`, new `ProfileUpdate` + `PATCH /api/account/profile`). Extend `backend/test_company_profile.py`.

**Interfaces:** Consumes `require_user`, `eligibility.parse_profile`, `account_view`. Produces the `profile` block on `GET /api/account` and the `PATCH /api/account/profile` route.

- [ ] **Step 1 — Failing API tests.** Assert: `GET /api/account` (via `main.get_account`) returns `account["profile"]` with empty defaults (`sectors == []`, `legal_form == ""`, `bids_in_groupement is False`); `PATCH` a subset (`legal_form`, `sectors`, `size_band`) round-trips (`sectors` back as a list) and leaves omitted fields untouched on a second partial patch (progressive); invalid `legal_form="wizard"` → 422; invalid `size_band` → 422; unauth → 401; non-active → 403. Run → red.
- [ ] **Step 2 — Extend `account_view`.** Add `"profile": eligibility.parse_profile(user)` to the returned dict (existing keys unchanged). Run the profile-read test → green.
- [ ] **Step 3 — Add `ProfileUpdate` + route.** Pydantic model with all fields `Optional` (default `None`); validate `legal_form`/`size_band`/`revenue_band` against the `eligibility` allowlists (empty string allowed), list fields as `list`. Build a dynamic `UPDATE users SET col = ? …` from **only the provided** keys (JSON-dumping list fields), `WHERE id = ?`; re-fetch and return `account_view`. Register `@app.patch("/api/account/profile")` with `require_user`. Run update tests → green.

**Verification:** `test_company_profile` fully green; full suite green.

---

### Task 4: Catalog — opt-in `eligible_only` filter

**Files:** Modify `backend/main.py` (`list_tenders`). Extend `backend/test_eligibility.py`.

**Interfaces:** Consumes `get_current_user`, `eligibility.evaluate`/`parse_profile`/`profile_is_empty`. Produces the `eligible_only` behavior.

- [ ] **Step 1 — Failing integration tests.** Seed a PME-reserved tender + a normal tender + `tender_details`. With a `grande`-profile user and `eligible_only=1`: reserved tender absent, `total` reflects the filtered count. With empty profile + `eligible_only=1`: result count equals the unfiltered count. Anonymous + `eligible_only=1`: unfiltered. Run → red.
- [ ] **Step 2 — Implement.** Add `eligible_only: bool = Query(False)` and an `authorization: str | None = Header(None)` param to `list_tenders`. When `eligible_only` and a valid user with a non-empty profile: after fetching the page rows (the query already LEFT JOINs `tender_details`, exposing `estimation`/`caution_provisoire`; also select `reserved_pme`, `category`), run `eligibility.evaluate` per row and drop hidden ones, recomputing `total`/`pages` from the filtered set. **Important:** because filtering is post-query, compute the filtered total over the full matching set (not just the page) — simplest correct approach: when `eligible_only` is active, fetch all matching rows (bounded, as export already does with a 10000 cap), filter, then paginate in Python. When inactive → the existing SQL path untouched. Run → green.

**Verification:** `test_eligibility` green; `test_v1_api_surface` still green (public read unchanged).

---

### Task 5: Surface-guard lock-in

**Files:** Modify `backend/test_v1_api_surface.py`.

- [ ] **Step 1.** Add a case asserting `main.is_v1_catalog_api_path("/api/account/profile")` is True and an unauthenticated `PATCH /api/account/profile` returns 401 (reachable-but-gated, not surface-404). Run → green (no `main.py` surface change needed).

**Verification:** `test_v1_api_surface` green.

---

### Task 6: Frontend types + API helper

**Files:** Modify `frontend/src/lib/types.ts`, `frontend/src/lib/api.ts`.

- [ ] **Step 1 — Types.** Add `CompanyProfile` interface (mirror the API `profile` shape; all optional). Add `profile?: CompanyProfile` to `AccountProfile`. Add `eligible_only?: boolean` to `TenderFilters`.
- [ ] **Step 2 — Helpers.** `updateAccountProfile(data: Partial<CompanyProfile>): Promise<AccountProfile>` → `mutateJSON(PATCH /api/account/profile)`. In `getTenders`, add `if (filters.eligible_only) params.eligible_only = "1";`.

**Verification:** `cd frontend && npx tsc --noEmit` (or the project's typecheck) passes.

---

### Task 7: MemberAccount "Profil entreprise" section

**Files:** Modify `frontend/src/pages/member/MemberAccount.tsx`.

- [ ] **Step 1.** Add a new `<section>` (below "Aperçu du compte") titled "Profil entreprise" with progressive controls: `legal_form` (select from the enum), a collapsible "Identifiants légaux" group (ICE/RC/IF/CNSS/patente/ville text inputs), secteurs/catégories/régions (comma inputs or the alerts multi-select pattern), `size_band`/`revenue_band` selects, `bids_in_groupement` + `eligibility_filter_default` toggles. Local draft state seeded from `account.profile`; a "Enregistrer le profil" button calls `updateAccountProfile` with the draft, updates `account`/`updateUser`, shows the same success/error feedback pattern as the theme section. Keep it visually quiet (reuse existing `institutional-control`/border tokens).

**Verification:** Section renders behind auth, saves without console errors, TypeScript build passes. (Catalog `eligible_only` toggle is optional in this slice — see design Open Decision 5.)

---

## Test Plan (run before finishing)

```
cd backend && ADMIN_EMAILS="" .venv/bin/python -m unittest discover -p "test_*.py"
cd frontend && <project typecheck>   # e.g. npx tsc --noEmit
```

All new tests green; baseline 224-test suite still green.

## Rollback

Revert the app code; the additive `users` columns stay dormant and harmless. No data migration to undo.
