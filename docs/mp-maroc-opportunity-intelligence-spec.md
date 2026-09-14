# MP Maroc — From Tender Catalog to Opportunity-Intelligence Platform

> Functional specification (D — Data / C — Context / E — Exploitation). No architecture, no code, no DB design — product behavior, user value, functional rules, and required information only. Companion to [`paywall-implementation-plan.md`](./paywall-implementation-plan.md).

## Context

MP Maroc today is a **discovery/search engine** for Moroccan public tenders: a scraped catalog (`tenders` + `tender_details`), search & filters, tender detail pages, member accounts, favorites, saved searches, sector/keyword/budget email alerts, a stats/directories layer, an admin control plane, and a *legal* AI assistant. This spec defines the evolution into an **actionable opportunity-intelligence** layer that reduces how much raw tender reading an SME must do before deciding whether an opportunity deserves attention. It does **not** rebuild the catalog — it sits on top of it.

**Why now:** the catalog answers "what tenders exist"; it does not answer "which are *mine*, why, and should I act." That gap is the paid-value gap.

### Grounding snapshot (what exists vs. what's missing) — drives every recommendation

| Capability | State today | Source of truth |
|---|---|---|
| Tender base record | `tenders`: reference, title, entity, entity_code, sector_code/name, category, deadline, publication_date, status, procedure_type, location | `backend/database.py` |
| Tender detail record | `tender_details`: objet, acheteur, procedure, categorie, allotissement, lieu_execution, estimation, domaines, adresse_retrait/depot, lieu_ouverture, caution_provisoire, **qualifications, agrements**, variante, reunion, visite_lieux, contact, documents_url, **dce_url**, avis_url, **reserved_pme**, prix_plans | `backend/database.py` |
| **Fact vs. inference model** | **Already built** — every field carries `status` (missing/detected/needs_verification), `source` (base/detail/regex/computed/none), `confidence` (none/low/med/high) | `backend/tender_display.py::build_tender_display` |
| Sector taxonomy | Fixed upstream list from the portal (`SECTORS`, `CATEGORIES`) — **not** derived from data | `backend/config.py`, `backend/scraper.py` |
| Alerts / matching | `alert_preferences`: sectors, regions, keywords, min/max budget, frequency — a **seed relevance engine** | `backend/database.py`, `backend/digest.py` |
| Company profile | **Only** a free-text `company` name on `users`. No sectors/activities/certs/geography. | `backend/database.py` (`users`) |
| Award / attribution data | **Does not exist.** No table, not scraped. Only the *legal* text mentions "attribution." A `market_price` regex signal exists but is best-effort, unverified. | grep: no award pipeline |
| DCE content | Downloaded as an **opaque ZIP** and cached on disk; **never parsed** into fields. `qualifications`/`agrements` come from the notice page, not the DCE docs. | `backend/dce_cache.py`, `dce_cache` table |
| AI assistant | Single-turn Q&A grounded **only** in a static legal decree prompt (2.22.431). Not tender/DCE/buyer/profile aware. | `backend/main.py::assistant_ask` |
| Stats / directories | Live dashboard + city/region/sector directories + map (Epic 2) — foundation for market intelligence | `frontend/src/pages/stats`, `Sectors/Regions/Cities` |
| Paywall | Entitlements design drafted (capabilities, `require_plan`, manual invoice activation, CMI later) | `docs/paywall-implementation-plan.md` |

### Working assumptions (all flagged; see Blocking Questions)
- **A1. Primary customer = Moroccan SME bidder without a dedicated procurement/veille team** (per brief). Not large groups, not the buyers themselves.
- **A2. Business-model lean = SaaS subscription (Model B) with premium alerts (Model C) as an entitlement inside it** — because a paywall/entitlements plan already exists and manual invoice activation is designed. *Flagged P0; the doc evaluates all three.*
- **A3. Sectors are inherited from the upstream portal taxonomy**; MP Maroc *ranks* them from data rather than inventing new ones.
- **A4. Award/attribution data IS available and public — P0 RESOLVED (research 2026-09-10).** The portal publishes award outcomes per-tender as **"Extrait de PV"** (committee minutes: attributaire, bidder list, exclusions, justification) + **"Résultats définitifs"**, and publication is **legally mandatory** under Décret n°2-22-431. Caveats: **no API/bulk/open-data feed** — it's HTML-per-tender with the winner/amount usually inside a **PDF PV extract**, so it needs scraping (which we already do) **plus PDF text extraction / occasional OCR**. Open data (data.gov.ma, OMCP/omcp.tgr.gov.ma) is a dead end for per-record awards. Third-party resellers (Datao, Novicore, Aljady, Sodipress) exist but ultimately re-derive from this same portal. So award-dependent features move from *blocked* → *build-vs-buy*. It is **not** collected today — still requires a new pipeline.
- **A5. DCE documents are retrievable (we already cache the ZIP)** but parsing CPS/RC/BPU/DQE into structured fields is unbuilt. *Flagged P1.*

### The four data-provenance classes (map onto the existing `source` field)
The brief requires distinguishing four kinds of information. MP Maroc's existing `display_value.source` already encodes three of them; the fourth is new:
1. **Published in the notice** → `source: base`
2. **Extracted from tender documents** → `source: detail` (today: notice detail page; *true DCE-doc extraction is unbuilt*)
3. **Inferred by the platform** → `source: regex | computed`, usually `status: needs_verification` (must be visibly labeled)
4. **Supplied by the user** → **new** (company profile) — does not exist yet

**Non-negotiable functional rules (apply everywhere below):**
- Never present inference as published fact — carry provenance to the UI.
- **Relevance ≠ eligibility.** A company can sell the thing and still be unable to bid.
- **Missing data is never negative evidence** — absence → "unknown," never "disqualified."
- Never fabricate requirements, dates, amounts, or award/legal conclusions.
- No monetary "you lost X MAD" claim unless substantiated by data we actually hold.

---

# D — DATA

### Feature D1 — Canonical tender record with full provenance
- **User action / revenue outcome:** Every downstream feature (summary, relevance, eligibility, assistant) can trust one record and show *why* each fact is stated → less manual re-reading; enables the paid intelligence layer.
- **Required data:** existing `tenders` + `tender_details`; add **derived** normalized fields: `amount_normalized` (numeric MAD from `estimation` via existing `parse_money`), `deadline_normalized` (date), `geo_normalized` (region/province/commune), `procurement_type` (works/supplies/services from procedure+category), `is_reserved_pme` (bool from `reserved_pme`).
- **Functional behavior:** Extend `build_tender_display` to emit **every** field with `status/source/confidence`. Classify fields into **mandatory** (reference, title, buyer, deadline, procedure_type, sector), **optional** (estimation, caution, lots, qualifications, agréments, addresses, contact), **derived** (normalized amount/date/geo, provenance flags). When a field is unavailable: render "Non précisé dans l'avis," never guess, never treat as a negative.
- **Dependencies:** none beyond current scrape — this is a labeling/normalization pass.
- **Assumptions:** normalization heuristics on French/MAD formats are good enough with `needs_verification` labeling for low-confidence parses.
- **Build recommendation: NOW.** Small, high-leverage, unblocks C & E; reuses code that already exists.

### Feature D2 — DCE extraction checklist (minimum "understood" set)
- **User action / revenue outcome:** Answers "what exactly does the buyer want and what will disqualify me" without opening a ZIP of PDFs → the single biggest reading-time saver; strong paid-tier justification.
- **Required data:** the cached DCE ZIP (already on disk) parsed into: **(1) object/scope of need** (relevance), **(2) required qualifications/agréments/certifications** (eligibility), **(3) required documents list** (eligibility), **(4) financial requirements** — caution, CA/turnover minimums (eligibility), **(5) key dates** — deadline, séance d'ouverture, visite/réunion (urgency), **(6) lots + per-lot amounts** (relevance + attractiveness), **(7) award/selection criteria** (attractiveness).
- **Functional behavior:** For each extracted item store what/why-it-matters + which axis it affects (relevance / eligibility / urgency / attractiveness) + provenance = `extracted` + confidence. A DCE is "sufficiently understood" only when items 1–5 are present; otherwise the record is flagged "DCE partiellement analysé." **Never invent a field the DCE doesn't contain.**
- **Dependencies:** a document-parsing pipeline (does not exist). D1. Company profile (D5) for eligibility matching to be meaningful.
- **Assumptions:** DCE formats are parseable at acceptable accuracy for the top sectors first; low-confidence extractions are labeled, not asserted.
- **Build recommendation: NEXT.** Highest-value new data, but it's a genuine new capability, not a labeling pass — sequence it after the profile+relevance loop proves demand.

### Feature D3 — Data-derived sector ranking
- **User action / revenue outcome:** "Which sectors actually have volume/value I should target" → better discovery + a credible market view; free-tier SEO magnet.
- **Required data:** `tenders.sector_code/name`, `amount_normalized`, `entity_code`, `publication_date`.
- **Functional behavior:** Keep the upstream sector list as the vocabulary; **rank** sectors by a transparent composite of: # tenders, total published value, avg contract value, # distinct contracting authorities, historical frequency. Show the ranking basis. Do **not** invent sectors.
- **Dependencies:** D1 (normalized amount). Stats dashboard already computes counts.
- **Assumptions:** estimation coverage is partial → value-based ranks show a coverage caveat.
- **Build recommendation: NOW.** Data + stats plumbing already exist; near-free.

### Feature D4 — Dynamic sector attributes (data-driven filters)
- **User action / revenue outcome:** Sector-appropriate filters (e.g. "agréments" for BTP, "caution" thresholds, "réservé PME") without bloating the UI for sectors that don't use them.
- **Required data:** field fill-rate distributions across `tender_details` per sector (qualifications, agrements, caution_provisoire, reserved_pme, lots…).
- **Functional behavior:** A sector attribute is promoted to a **first-class filter** only when it: (a) appears in ≥ a governance threshold of that sector's tenders, (b) materially changes eligibility/relevance, (c) extracts reliably, (d) is actually used. Process: measure fill-rate → propose candidate → validate discrimination → expose → monitor usage → demote if unused. **Rule stated, thresholds set with real data, not upfront.**
- **Dependencies:** D2 (reliable extraction) for anything beyond notice-page fields.
- **Assumptions:** filter governance is an admin-reviewed process, not fully automatic.
- **Build recommendation: LATER.** Premature before profiles + usage data exist to justify each filter.

### Feature D5 — Company relevance profile ★ keystone
- **User action / revenue outcome:** The precondition for *every* personalized feature — relevance, eligibility, recommendations, actionable alerts, missed-opportunity. Without it, MP Maroc stays a catalog.
- **Required data (staged):**
  - **Onboarding (minimal, required):** sectors of activity, geographic coverage (regions), keywords / products-services. *(Deliberately mirrors `alert_preferences` so the first alert = the profile.)*
  - **Optional enrichment:** certifications/agréments held, company size, contract-size range, excluded categories, preferred contracting authorities, preferred opportunity types.
  - **Learned from behavior:** viewed/saved/dismissed patterns, sectors of tenders opened.
- **Functional behavior:** Progressive profiling — never a wall of mandatory fields. Profile is `source: user`. Certifications feed eligibility (D2/C3); sectors+geo+keywords feed relevance (C2). Learned signals refine ranking but never override explicit profile.
- **Dependencies:** none technical; reuse the `alert_preferences` shape and the member shell.
- **Assumptions:** SMEs will give 3 fields at signup; deeper data is earned over time.
- **Build recommendation: NOW.** Nothing in C or E is personalizable until this exists.

---

# C — CONTEXT

### Feature C1 — Executive tender summary
- **User action / revenue outcome:** Decide "open or skip" in ~15s: what's bought, by whom, where, value, key dates, who seems eligible, main requirements, what could disqualify, which docs to open first, why it matters to *me*.
- **Required data:** D1 record; D2 DCE items (when available); D5 profile for the "why for you" line.
- **Functional behavior:** Two layers. **(a) Facts card (no LLM):** deterministic assembly from D1 with visible provenance — ship first. **(b) Plain-language summary (LLM):** grounded strictly in the record/DCE; **published facts and inferred conclusions are visually separated**; unknowns stated as unknown. No fabrication.
- **Dependencies:** D1 (now); C1b needs the grounded assistant (E7) + D2 for full richness.
- **Assumptions:** the facts card covers most decisions; LLM summary adds value mainly where DCE is parsed.
- **Build recommendation: NEXT** (facts card **NOW** as part of D1's detail view; LLM summary NEXT).

### Feature C2 — Opportunity relevance
- **User action / revenue outcome:** "This tender is probably relevant to your company" + why → the core discovery upgrade and the reason to log in / subscribe.
- **Required data:** D5 profile (sectors, geo, keywords, size range) × D1 record (sector, geo, amount, procurement_type, reserved_pme).
- **Functional behavior:** Combine signals (sector match, keyword/product match, geography, contract-size fit, reserved-PME fit) into **qualitative levels — Strong / Possible / Weak / Not enough information** — not a mysterious number. Show the **evidence chips** that produced the level ("Secteur BTP ✓, Région Casablanca ✓, montant dans votre fourchette ✓, mot-clé 'voirie' ✓"). "Not enough information" when the profile or record is too sparse — **never** downgrade for missing data. This is the existing alert-matching logic upgraded from binary to graded + explained.
- **Dependencies:** D5, D1.
- **Assumptions:** levels are defined from match-signal *coverage/strength*, not arbitrary cutoffs; thresholds tuned on real matches.
- **Build recommendation: NOW.** Extends `alert_preferences` matching; the headline value.

### Feature C3 — Eligibility / bidability (separate from relevance)
- **User action / revenue outcome:** "Can I actually bid?" → avoids wasted effort on tenders the company can sell but can't qualify for.
- **Required data:** D2 DCE requirements (qualifications, agréments, caution, financial minimums, documents) × D5 profile (certifications held, size, capacity).
- **Functional behavior:** Produce five buckets: **satisfied (confirmed)**, **likely satisfied**, **missing**, **unknown**, **blocking**. Wording is always hedged: *"Sur la base des informations disponibles, votre entreprise semble remplir…"* — **never** "vous êtes éligible." Missing requirement ≠ ineligible unless it's a hard blocking rule the data proves. If the DCE isn't parsed or the profile lacks certs → "Éligibilité non déterminable — informations insuffisantes."
- **Dependencies:** D2 (DCE parsing), D5 (certifications).
- **Assumptions:** legal eligibility is never asserted by the platform; output is decision-support only.
- **Build recommendation: NEXT.** Depends on D2; ship a conservative "requirements checklist vs. your profile" first.

### Feature C4 — Market-needs intelligence
- **User action / revenue outcome:** "What are public buyers actually buying, where, and is my sector growing?" → helps SMEs choose where to invest; commercial (not decorative) analytics.
- **Required data:** aggregated D1 (sector, geo, amount, publication_date, entity), D3 ranking.
- **Functional behavior:** Turn the existing stats dashboard from generic charts into **decisions**: growing demand categories, recurring/seasonal needs, geographic concentration, top buyers, high-value categories, frequently required capabilities/certs. Every figure links to the underlying tenders (drill-down = the action).
- **Dependencies:** D1, D3; stats/directories foundation exists.
- **Assumptions:** value figures carry an estimation-coverage caveat.
- **Build recommendation: SHOULD.** Strong free-tier acquisition + retention; builds on Epic 2.

### Feature C5 — Buyer intelligence
- **User action / revenue outcome:** Understand *how a buyer purchases* (not just a list): frequency, categories, typical values, recurrence, and — where data exists — who wins and at what amount.
- **Required data:** **Available now:** all tenders by `entity_code` → frequency, categories, chronology, typical estimation, recurring requirements. **Not available:** awarded suppliers, awarded amounts, repeat winners (**no award data**, see A4).
- **Functional behavior:** Ship a **buyer purchase-history** view from the catalog now (this authority's tenders over time, categories, typical size, recurring qualifications). Add **award/winner intelligence only after the award pipeline exists**, clearly labeled by provenance. Recurrence/"likely to re-publish" is **inference** and must be labeled as such.
- **Dependencies:** buyer history = D1 (now); award layer = new award pipeline (A4).
- **Assumptions:** award notices are obtainable from the source; until then, no winner claims.
- **Build recommendation:** buyer history **SHOULD**; award/repeat-winner intel **LATER** (blocked on data).

### Feature C6 — Tender chronology
- **User action / revenue outcome:** Know the timeline and never miss an event: publication → modifications → clarifications → deadline → séance d'ouverture → result.
- **Required data:** publication_date, deadline, lieu_ouverture/date (have); **modifications, clarifications, award events** (partially/not captured — needs re-scrape diffing + award pipeline).
- **Functional behavior:** Timeline on the tender page; flag which events warrant notification (deadline approaching, modification detected, result published). Events we can't detect are simply absent — not fabricated.
- **Dependencies:** modification detection (scrape diff), award pipeline for the final node.
- **Assumptions:** re-scrape cadence can detect notice modifications.
- **Build recommendation: SHOULD** (deadline/opening now; modification + award events after the pipelines).

---

# E — EXPLOITATION

### Feature E1 — Opportunity-first discovery
- **User action / revenue outcome:** Land on *your* opportunities, not a generic list → faster discovery, higher participation, core logged-in value.
- **Required data:** C2 relevance, D5 profile, favorites/behavior, D1 dates/amounts.
- **Functional behavior:** Add opportunity lenses on top of the catalog: **Recommended for you**, **New**, **Closing soon (urgent)**, **High value**, **Strong match**, **Saved/viewed**, **From followed buyers**, **Awarded** (when data exists). Sector-first browsing stays. **When to use each:** *Recommendations* = default logged-in landing (low-effort daily triage); *Filters* = the user has a precise known query; *Search* = ad-hoc keyword lookup. Recommendations never hide the full catalog.
- **Dependencies:** C2, D5.
- **Assumptions:** logged-out users still get the catalog + market intel (SEO); personalization is the logged-in upgrade.
- **Build recommendation: NEXT** (right after C2 + D5).

### Feature E2 — Member space as an operational workspace
- **User action / revenue outcome:** A place to *act*, not a passive dashboard. Today `MemberOverview` shows counts + a "coming soon" saved-searches box — it's passive.
- **Required data:** favorites, alerts, saved searches, C2 relevance, followed buyers, behavior.
- **Functional behavior:** Every panel answers "what do I do from here?": **Relevant opportunities** (→ open/save/dismiss), **Saved/followed tenders** (→ track deadline), **Followed buyers** (→ see new), **Alert config** (→ tune), **History** (→ revisit), **Dismissed** (→ undo), optional **bid status** (→ advance). Replace the passive tiles with next-action CTAs.
- **Dependencies:** E1, C2; "followed buyers" needs a follow model (small).
- **Assumptions:** bid-workflow tracking is optional (see Q11) — don't build a CRM.
- **Build recommendation: SHOULD** (shell exists; make it action-oriented).

### Feature E3 — Transparent multi-dimension prioritization
- **User action / revenue outcome:** Decide what to open first without trusting a black-box score.
- **Required data:** C2 relevance, C3 eligibility, D1 value, D1 urgency (deadline), C5 buyer relevance.
- **Functional behavior:** Show **separate dimensions** (Relevance / Eligibility / Value / Urgency / Strategic buyer) as labeled chips, **not** one fused AI score. Sort by any dimension. Uncertainty shown explicitly ("Éligibilité: à vérifier"). A missing dimension is blank, never a zero that penalizes.
- **Dependencies:** C2, C3.
- **Assumptions:** users trust transparent axes more than a single number (matches the existing provenance philosophy).
- **Build recommendation: SHOULD** (after relevance + eligibility exist).

### Feature E4 — KPIs (minimal, decision-linked)
| KPI | Who uses it | Decision it supports | Verdict |
|---|---|---|---|
| Relevant opportunities detected (this week) | Member | "Is it worth logging in?" | **MVP** |
| Strong-match tender value (addressable) | Member | "How big is my pipeline?" | **MVP** |
| Opportunities viewed / saved | Member + MP Maroc | engagement, retention | **MVP** |
| Opportunities dismissed | MP Maroc | relevance tuning | **MVP** |
| Total addressable tender value (sector) | Member | market sizing | Later |
| Estimated missed-opportunity value | Member | urgency to subscribe | **Later** (needs award + strict substantiation; see E6) |
| Buyer activity / sector demand growth | Member | targeting | Later |
| Awarded-market value / repeat-winning suppliers | Member | competitive intel | Later (blocked on award data) |
- **Build recommendation:** MVP set **NOW/NEXT**; value-of-missed and award KPIs **LATER**; vanity metrics **CUT**.

### Feature E5 — Actionable email alerts
- **User action / revenue outcome:** Emails that prompt a decision, not tender dumps → participation + retention; premium-alert monetization (Model C).
- **Required data:** C2 relevance, D5 profile, favorites, deadlines; digest dedup already exists (`digest_log`).

| Trigger | Segment | Urgency | Frequency | Batching | Cap | Opt-out |
|---|---|---|---|---|---|---|
| New **strong-match** tender | matching profile | High | Daily digest (instant = premium) | Batched | 1 email/day default | per-alert + global |
| Deadline approaching (saved/followed) | owner | High | Event | Single | dedup per tender | per-alert |
| Followed tender modified | owner | Med | Event | Single | dedup | per-alert |
| Followed **buyer** publishes | follower | Med | Daily | Batched | 1/day | per-follow |
| **Award result** published | prior interested | Low | Weekly | Batched | 1/week | global |

- **Functional behavior:** Extend the current digest from "sectors/keywords match" to "**strong-match + why**." Respect frequency, batching, per-alert + global caps, one-click unsubscribe. **Award framing** may be commercial — *"Un marché de X MAD dans votre secteur vient d'être attribué"* — but **never** "vous avez perdu X MAD" unless substantiated.
- **Dependencies:** C2 (match), award pipeline for the award trigger.
- **Assumptions:** the existing `digest.py` is the base; instant delivery is a premium lever.
- **Build recommendation:** strong-match + deadline alerts **NOW/NEXT**; buyer-publish & award **LATER**.

### Feature E6 — Missed-opportunity intelligence
- **User action / revenue outcome:** A truthful "you may be leaving money on the table" nudge → retention + upgrade — but credibility-critical.
- **Required data:** behavior (matched-but-not-viewed, viewed-not-saved, followed-but-lapsed), award data for the strongest framing.
- **Functional behavior:** Define tiers precisely: **(1)** matched to profile but never viewed; **(2)** viewed, not saved; **(3)** followed, deadline passed; **(4)** awarded to another supplier (needs award data). Monetary value may be shown **only** for genuinely addressable opportunities where an amount exists — labeled "valeur estimée du marché," **not** "revenu perdu." Similar-but-not-addressable tenders are never counted as missed money.
- **Dependencies:** behavior tracking, award pipeline for tier 4.
- **Assumptions:** conservative framing protects trust; over-claiming here would poison the brand.
- **Build recommendation: LATER.** Needs behavior history + award data; do it once, honestly.

### Feature E7 — Grounded AI tender assistant
- **User action / revenue outcome:** A shortcut to the intelligence above in natural language ("Quels marchés me correspondent cette semaine ?", "Résume le CPS", "Suis-je éligible ?", "Qui gagne ces marchés ?") → premium anchor (carries real Anthropic cost, so gating protects margin per the paywall plan).
- **Required data / grounding sources:** D1 records, D2 DCE extractions, C5 buyer history, D5 profile, C4 market data. **Today the assistant is grounded only in a static legal decree** — this is the main expansion.
- **Functional behavior:**
  - **Allowed scope:** questions answerable from the grounded sources above + procurement legal context. Refuse/deflect out-of-scope.
  - **Citations:** every factual claim links to its source tender/field/DCE section; provenance shown (published vs. extracted vs. inferred).
  - **Uncertainty:** if data is missing, say so — never fill gaps. Missing DCE → "Le DCE n'a pas encore été analysé."
  - **Refusal:** never fabricate requirements, dates, amounts, award results, or legal eligibility conclusions; no "vous êtes éligible" verdicts.
  - **Fact vs. inference:** explicitly labeled in every answer, mirroring the `display_value` model.
- **Dependencies:** D1 (now), D5, C2 for personalized answers; D2 & award pipeline for DCE/winner answers; retrieval over the record.
- **Assumptions:** reuses the existing `/api/assistant/ask` + `RequirePlan` from the paywall plan; ANTHROPIC_API_KEY on the server.
- **Build recommendation: NEXT** (record + profile grounding first; DCE/award grounding **LATER** with those pipelines).

### Feature E8 — Business-model alignment ★ P0 DECISION (not decided here)
| Feature | (A) Free discovery + lead-gen | (B) SaaS subscription *(working assumption)* | (C) Premium alerts/intel |
|---|---|---|---|
| Catalog, search, sector ranking, market intel | **Free** (SEO funnel) | Free tier | Free |
| Company profile + relevance levels | Free (capture) | **Free→paid depth** | Teaser free |
| Actionable alerts (strong-match) | Lead magnet | **Paid** (limits on free) | **Core paid** |
| Instant vs. daily alerts | Daily free | Daily free / **instant paid** | **Instant = the product** |
| Eligibility assessment (C3) | — | **Paid** | Paid |
| DCE summary / "Résume le CPS" | — | **Paid** | Paid |
| AI assistant (E7) | Teaser | **Paid** (margin protection) | Paid |
| Buyer/award intelligence | — | **Paid** | Paid |

- **Behavior:** keep the catalog + market intel generous & free (growth/SEO); paywall the **personalized decision layer** (relevance depth, eligibility, DCE summary, assistant, instant alerts). This matches the drafted entitlements plan. **Flagged as the central product decision — see Q14.**
- **Build recommendation:** decide model **NOW** (blocks paywall lines); entitlement enforcement per the existing paywall plan.

---

# FINAL PRIORITIZED BACKLOG

## MUST — turns the catalog into an opportunity-intelligence product
1. **D5 Company relevance profile (minimal: sectors + regions + keywords)** — nothing personalizes without it; reuse `alert_preferences` shape.
2. **D1 Canonical record with full provenance + normalized amount/date/geo** — one trustworthy record; extends existing `build_tender_display`.
3. **C2 Opportunity relevance with levels + evidence** — the headline value; upgrades existing binary alert-matching to graded + explained.
4. **E5 (core) Strong-match + deadline alerts** — turns the existing digest into decisions; retention engine.
5. **Business-model decision + entitlement lines (E8)** — unblocks the whole paid layer.

## SHOULD — high value once the core loop works
6. **E1 Opportunity-first discovery lenses** — makes the value visible daily; needs C2+D5.
7. **C1 Executive tender summary (facts card now, LLM next)** — the reading-time saver.
8. **E7 Assistant grounded in records + profile** — premium anchor; big lift, sequence after C2.
9. **E2 Member space as action workspace** — replace passive tiles with next-action CTAs.
10. **C4 Market-needs intelligence (commercial framing of stats)** — acquisition + retention on an existing foundation.
11. **D3 Data-derived sector ranking** — near-free on existing data.
12. **E3 Transparent multi-dimension prioritization** — after relevance + eligibility.
13. **C5 (buyer history) + C6 (chronology core)** — from catalog data we already hold.

## LATER — differentiation, premature before usage/data validates it
14. **D2 DCE extraction pipeline** — highest-value new *data*, but a real new capability; validate demand first.
15. **C3 Eligibility/bidability** — needs D2 + profile certifications.
16. **Award/attribution pipeline → C5 winner intel, E5 award alerts, E6 tier-4 missed value** — *no longer blocked on availability* (A4 resolved); now a build-vs-buy call: scrape+parse PV PDFs from the portal, or subscribe to a reseller (Datao/Novicore) to launch fast. Still LATER because it needs its own pipeline + PDF parsing.
17. **E6 Missed-opportunity intelligence** — needs behavior history + award data; must be truthful.
18. **D4 Dynamic sector attributes** — needs fill-rate data + usage to justify each filter.

## CUT — impressive-sounding, not worth the cost now
- **Single fused "AI opportunity score"** — contradicts the transparent, provenance-first philosophy; use separate dimensions (E3) instead.
- **"You lost X MAD" loss framing** — unsubstantiable and brand-damaging; violates the no-false-claims rule.
- **Full bid/tender CRM & document management** — out of scope for an intelligence layer; SMEs won't switch their bid workflow here (revisit via Q11).
- **Predictive "who will win / winning price" modeling** — no award data, high error, legal/ethical risk; not now.
- **Fabricated eligibility verdicts** — the platform must never assert legal eligibility.

**Prioritization rationale:** every MUST item is high-frequency (used per browsing session or daily email), directly cuts manual reading, and is buildable on existing plumbing — maximizing retention and paid-plan justification per SME value. LATER items are gated on data/pipelines that don't exist yet, so building them now is speculative.

---

# BLOCKING CLIENT QUESTIONS

### P0 — changes the architecture of the product
1. **Business model (Q14):** SaaS subscription (working assumption, matches the paywall plan), premium alerts, free lead-gen, or hybrid? Decides every paywall line.
2. **Award/attribution data — RESOLVED (2026-09-10):** Yes. Winner + amount are legally-mandated public disclosures (Extrait de PV + Résultats définitifs on the portal). No API/open-data — direct route is scrape closed consultations + parse PV PDFs; fast-start alternative is a paid reseller (Datao ~490–790 MAD/mo, has a **Claude MCP**; Novicore free–500 MAD/mo, explicitly exposes *soumissionnaire retenu* + *montant attribué*). **Remaining decision is build (scrape+PDF parse) vs. buy (provider), not availability.** See [`award-data-source-research.md`](./award-data-source-research.md) if archived.
3. **Primary customer (Q2):** Confirm SME bidder without a veille team (assumed) vs. large firms / resellers / the buyers themselves — reshapes profile, relevance, and pricing.
4. **DCE realism (Q3):** What can we reliably extract from DCEs *today* across the top sectors? Determines whether C3/D2 are NEXT or LATER.
5. **Single success metric (Q15):** What one measurable outcome proves this layer works? *Proposed:* **% of logged-in members who open ≥1 "Strong-match" opportunity per week** (relevance is landing) — or strong-match→save conversion.

### P1 — materially changes UX / features
6. **Relevant opportunity definition (Q5):** What counts as "Strong match"? Which signals are mandatory (sector? geo? keyword?) to reach it?
7. **Profile depth (Q4):** Onboard with products/services, capabilities, certifications, or all three — and how much is mandatory vs. progressive?
8. **Missed opportunity definition (Q6):** Which of the four tiers do we surface, and when may a MAD figure appear?
9. **Per-sector required filters (Q7):** For the top 2–3 sectors, which filters are genuinely needed (drives D4 governance)?
10. **Notification aggressiveness (Q8):** How commercial can award/urgency language be while staying truthful?
11. **Assistant scope (Q9):** Records + profile only, or also DCE + buyer/award history? Confirms E7 phasing.
12. **"Requester" definition (Q10):** Does MP Maroc key buyer intelligence on contracting authority, department, organization, or individual? Affects C5 grouping (`entity` vs `entity_code`).

### P2 — can be decided later
13. **Priority sectors (Q1):** Which 2–3 sectors to optimize first (proposed: rank by D3, likely BTP + IT/services)?
14. **Bid-workflow tracking (Q11):** Track the user's actual application/bid status, or stop at "followed"? (Leaning: stop at followed — not a CRM.)
15. **Member-space vs. tender-page split (Q12):** Personalized intelligence (relevance/eligibility/actions) in the member workspace; objective facts on the public tender page — confirm the boundary.
16. **What stays free (Q13):** Confirm catalog + market intel free; personalized decision layer paid.

---

# Verification — how we'll know the layer works (end-to-end)

Because this is a product/functional spec (no code here), verification is defined per shipped increment:
1. **D1/D5 loop:** create a test SME profile (sectors+regions+keywords) → confirm the catalog surfaces graded relevance with correct **evidence chips** and correct provenance labels on tender fields (`base`/`detail`/`regex`/`user`). Backend: extend `test_tender_display.py`; add profile + relevance API surface tests to `test_v1_api_surface.py`.
2. **C2 relevance:** seed tenders that should be Strong/Possible/Weak/Not-enough-info for the test profile → assert levels + that **missing data yields "Not enough info," never a downgrade**.
3. **E5 alerts:** run the digest against the test profile → assert only strong-match tenders are emailed, dedup via `digest_log` holds, caps/opt-out respected (extend `test_digest.py`, `test_alerts_api.py`).
4. **E7 assistant:** ask "pourquoi ce marché est-il pertinent ?" → assert answer cites the record fields and **refuses to assert eligibility**; grounded-source citations present.
5. **Success metric (Q15):** instrument weekly **strong-match open rate** and strong-match→save conversion as the proof-of-value dashboard (admin).
6. **Guardrail tests:** no fabricated award/eligibility claims; every inferred field renders with a `needs_verification` marker in the UI.

---

*Recommended sequencing on sign-off: resolve the P0 questions, then build the MUST loop in order — D5 → D1 → C2 → E5 — before touching any award-dependent item.*
