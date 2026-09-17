# Eligibility Classification & Low-Friction Onboarding — Design Spec

> Date: 2026-09-15. Status: **implemented** (backend + member wizard + admin view).
> Builds directly on [`2026-09-14-user-profile-eligibility-design.md`](./2026-09-14-user-profile-eligibility-design.md)
> (the 21-column company profile + conservative catalog hide rules). This slice
> adds the **classification/derivation layer** ("create it for them"), a member
> **onboarding wizard**, and surfaces both in the **admin space**.

## Problem

The company profile was captured but three gaps remained:

1. **Admin blindness** — `GET /api/admin/users` + `Users.tsx` returned only
   identity/role/status. None of the legal/eligibility data users provided was
   visible to admins, so it couldn't be triaged or corrected.
2. **High friction** — the profile is 21 fields. Most users won't fill it, so
   the eligibility-aware catalog never activates.
3. **No synthesis** — the raw fields were stored but never reduced to the
   *logical* eligibility-determining picture the assistant-legal domain implies.

## The classification (grounded in the assistant-legal content)

Article 27 of décret n° 2.22.431 (mirrored in `frontend/src/lib/procedures.ts`
`ELIGIBILITY_QUESTIONS` + `PROCEDURES`) reduces "can this company bid on this
tender" to **five groups**. Each maps to a gate, existing column(s), and a
friction-reduction derivation:

| Group | Determines | Primary field(s) | Derived (rule-based) |
|---|---|---|---|
| **1. Legal identity** | legal capacity (art. 27); attestations | `legal_form`, `ice`/`rc`/`if`/`cnss`/`patente`, `hq_city` | `hq_region` (city→région) |
| **2. Activity fit** | "activité en rapport avec l'objet"; category soft-hide | `sectors` | `categories` (Travaux/Fournitures/Services from the `1/2/3.x` prefix) |
| **3. Capacity scale** | PME-reserved lots; financial fit | `size_band` | `revenue_band`, `contract_ceiling`, `is_pme` (+ auto-entrepreneur ceiling from `legal_form`) |
| **4. Qualifications** | agrément/classification gate (BTP, études) | `qualifications`, `certifications` | `candidate_families` (hints from sector/category) |
| **5. Standing** | hard exclusions (art. 27 / 152 / 162) | `standing` (questionnaire answers) | `verdict`: clear / risk / blocked / unknown |

**The friction insight:** only **four primary declarations** are needed —
`legal_form`, `sectors`, `size_band`, and the art. 27 questionnaire. Groups 2–4
(categories, revenue band, contract ceiling, PME status, HQ region, candidate
qualifications) are **derived by pure rules**. That is the "create it for them".

## Implementation

### Backend — `eligibility.py` (pure, unit-tested)
- `sector_category` / `derive_categories` — category from the sector-code prefix.
- `_SIZE_DEFAULTS` — `size_band` → (revenue band, contract ceiling, is_pme).
- `AUTO_ENTREPRENEUR_CEILING` + `_PME_LEGAL_FORMS` — legal-form overrides.
- `derive_region` — Moroccan city → 2015 12-région découpage (accent-tolerant).
- `qualification_hints` — candidate agrément families from activity.
- `STANDING_QUESTIONS` + `evaluate_standing` — art. 27 answers → verdict
  (mirrors the frontend verdict logic; ids kept in sync with `procedures.ts`).
- `classify(profile)` — the keystone: returns the 5 groups, per-value
  `*_source` provenance (`user` | `derived` | `none`), a `derived` dict of
  proposals to persist (only for fields the user hasn't set), `completeness`
  (0–1 over the 5 groups), and a one-line `summary`. **Non-mutating.**
- `PROFILE_COLUMN_MAP` + `serialize_profile_update` — one source of truth for
  the partial-profile write, shared by the member PATCH and the admin override.
- `enrich_profile_from_registry` — the **phase-2 seam** (see below).
- New column `users.standing_json` (additive, `_add_column_if_missing`).

### API
- `GET /api/account` / `PATCH /api/account/profile` now return `classification`
  and accept `standing`.
- `GET /api/admin/users` — each row carries a compact `classification` summary.
- `GET /api/admin/users/{id}` — full profile + classification.
- `PATCH /api/admin/users/{id}/profile` — admin override, gated by the new
  `users.edit_profile` permission (owner + admin), audit-logged as
  `user.profile_edit`.

### Frontend
- **Member**: `EligibilityWizard` (4 steps → save → derived classification
  preview → one-click "apply derived to profile") + reusable `ClassificationCard`,
  mounted atop `MemberAccount` above the detailed edit form. `lib/sectors.ts`
  provides the static sector taxonomy.
- **Admin**: `Users.tsx` gains an "Éligibilité" column (completeness %, PME,
  categories) that expands to `UserClassificationDetail` — full classification +
  an override form (legal form, size, sectors, categories, groupement).

## Conservative boundaries (unchanged)
- Derived values are **decision-support only**, always labelled `derived`; they
  never assert legal eligibility.
- The catalog hide rule (`eligibility.evaluate`) is **unchanged** — it still only
  hides on the reserved-PME size rule and an explicit category declaration.
  Derived categories are **not** auto-persisted into the hard filter; the member
  must explicitly "apply derived" to opt in. *Innocent until proven ineligible.*

## Phase 2 — ICE/RC registry enrichment (seam, not built)
`enrich_profile_from_registry(profile)` is wired into `classify` as an identity
function today. When an OMPIC / registre-de-commerce / portail feed is available,
populate the *missing* identity/activity fields from the declared ICE/RC there —
declared values win, the registry fills gaps — and mark enriched fields
`source: "registry"`. Every classification read benefits at once; no other code
changes. Build-vs-buy tracked alongside the award-data research.

## Testing
- Backend: `test_eligibility.py` (+20 cases: sector/category, region, standing,
  classify), `test_company_profile.py` (classification exposure, standing
  round-trip, `standing_json` migration), `test_admin.py` (list summary, detail,
  override, permission gate). Full suite: **286 tests green**.
- Frontend: `tsc -b` clean; vitest 22 green.
