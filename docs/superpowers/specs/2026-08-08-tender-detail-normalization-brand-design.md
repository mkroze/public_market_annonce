# Tender Detail Normalization and Brand Logo Design

Date: 2026-08-08

## Goal

Redesign the tender individual page so it stays useful when the source data is incomplete, duplicated, or poorly structured. The page should no longer trust raw scraped labels as presentation-ready content. It should show a clean decision-first view backed by derived display fields, while keeping the original source fields available for audit.

The work also defines a lightweight logo system for the current brand colors. The color palette is already acceptable and should not be replaced.

## Context

The current `TenderDetail.tsx` renders most fields directly from `tender.details` or the base tender row. Because the source portal data can repeat commune names, province names, buyer names, locations, and object fragments, the page can display redundant information in the title and supporting metadata.

The backend currently stores:

- Base tender fields in `tenders`
- Lazily scraped detail fields in `tender_details`
- `estimation` and `prix_plans` when available

It does not currently store a candidate/application count, awarded market price, or a confidence/source model for derived values. Local cached details are sparse, so the design must assume the bare minimum may be available.

## Product Position

The tender detail page is a decision page for SMEs. It should answer:

- Can I still apply?
- Is the opportunity financially relevant?
- What risk or upfront cost exists?
- Where is the work executed?
- Are documents available?
- Are there participation constraints?
- Is there any competition or market-price intelligence available?

It should not pretend missing values are known. Missing or weakly detected fields should be shown as missing, not silently hidden when they are central to the decision.

## Non-Goals

- Do not automatically refresh or re-scrape source data when the detail page opens.
- Do not overwrite raw scraped fields with normalized values.
- Do not present inferred application counts or market prices as authoritative unless the source is explicit.
- Do not redesign the entire app navigation or color palette.
- Do not create a government-looking emblem or anything that could imply official state affiliation.

## Recommended Approach

Use a backend normalized display contract, with raw source data preserved.

The API response for one tender should expose:

```ts
interface TenderDisplay {
  title: DisplayValue;
  buyer: DisplayValue;
  location: DisplayValue;
  procedure: DisplayValue;
  category: DisplayValue;
  deadline: DisplayValue;
  reference: DisplayValue;
}

interface TenderSignals {
  estimation: DisplayValue;
  caution: DisplayValue;
  plan_price: DisplayValue;
  dce_available: DisplayValue;
  applications_count: DisplayValue;
  market_price: DisplayValue;
}

interface DisplayValue {
  value: string | number | boolean | null;
  status: "detected" | "missing" | "not_applicable" | "needs_verification";
  source: "base" | "detail" | "regex" | "agent_import" | "computed" | "none";
  confidence: "high" | "medium" | "low" | "none";
  raw?: string;
}
```

The frontend should render from `display` and `signals` first, falling back to raw fields only in the collapsed raw-source section.

## Normalization Rules

### Text Cleanup

Apply a shared cleanup pass before display:

- Collapse repeated whitespace and line breaks.
- Trim punctuation at the beginning/end of strings.
- Normalize common currency spacing such as `MAD`, `DH`, and `DHS`.
- Preserve accents and original French text where meaningful.
- Keep raw strings available for inspection.

### Title/Object Selection

Choose the page title in this order:

1. `details.objet` if present and meaningfully different from generic metadata.
2. `tenders.title` if present.
3. Reference fallback: `Consultation <reference>`.

Remove redundant trailing location/buyer fragments when they duplicate canonical buyer or location fields. Examples:

- `- Commune de X`
- `, Commune de X`
- `Province de X`
- `Préfecture de X`
- `à la commune de X`, only when the object still remains understandable without it

Do not remove a location phrase when it is necessary to understand the actual work site, for example several douars, routes, schools, or named facilities.

### Buyer Selection

Choose buyer in this order:

1. `details.acheteur`
2. `tenders.entity`

If one version is a strict expansion of the other, show the fuller version once. Do not repeat the same buyer in both header and info cards.

### Location Selection

Choose location in this order:

1. `details.lieu_execution`
2. `tenders.location`
3. Location parsed from title/object

If the title contains the same commune/province as the chosen location, avoid repeating it in the header metadata. The page can still show the source title in the raw drawer.

### Monetary Extraction

Use regex extraction over all available stored text fields, not only the expected labeled field. Detect:

- Estimated value: labels such as `Estimation`, `Estimation TTC`, `montant estimatif`, `budget prévisionnel`.
- Provisional caution: labels such as `Caution provisoire`, `cautionnement provisoire`, `garantie provisoire`.
- Plan acquisition price: labels such as `Prix d'acquisition des plans`.
- Market/award price: labels such as `montant du marché`, `prix du marché`, `montant attribué`, `offre retenue`, `adjudicataire`, only if source/agent import clearly refers to award or result data.

Currencies should support Moroccan formats:

- `1 234 567,89 MAD`
- `1.234.567,89 DH`
- `1234567.89`
- `0,00 MAD`

`0,00 MAD` must not be treated as a useful commercial signal unless the field is known to legitimately be free, such as plan price.

### Application or Candidate Count Extraction

Detect candidate/application counts only when the text clearly indicates submissions or competitors:

- `nombre de plis`
- `nombre d'offres`
- `offres reçues`
- `soumissionnaires`
- `concurrents`
- `candidats`
- `dossiers déposés`

Avoid interpreting dates, article numbers, sector codes, or reference numbers as counts. If confidence is low, use `needs_verification`.

### No Auto Refresh

The detail page must not trigger source refreshes or live scraping to improve the displayed fields. It can use:

- Base tender row already stored
- Detail row already stored
- Previously cached detail row
- Imported enrichment data from another agent or offline process
- Regex extraction over stored raw text

If a detail row is missing, the page should still be useful with base fields only.

## Page Layout

### 1. Header

Show:

- Clean title/object
- Buyer
- Reference
- Procedure/category chips
- Clean location if available
- Deadline with urgency

The title should not include duplicated commune/province/buyer metadata when those are already visible nearby.

### 2. Priority KPI Strip

Show six decision signals in a compact strip:

- Deadline
- Budget or estimation
- Caution
- DCE
- Applications
- Market price

Each KPI has one of these states:

- Detected: show value strongly.
- Missing: show `Non détecté`.
- Needs verification: show value muted with a verification label.
- Not applicable: show a quiet state.

The visual emphasis should prioritize deadline, budget/estimation, caution, and DCE availability. Applications and market price are valuable but secondary unless explicitly present.

### 3. Primary Actions

Show only practical actions:

- Download DCE, when available
- View official source
- Export PDF

Errors should explain what failed and offer the official source as fallback.

### 4. Participation Requirements

Group:

- Allotissement
- Qualifications
- Agréments
- PME reservation
- Variante
- Site visit
- Meeting

This section should focus on requirements that can block a company from applying.

### 5. Operational Details

Group:

- Withdrawal address
- Submission address
- Opening place
- Contact

This should not compete visually with the KPI strip.

### 6. Raw Source Drawer

Add a collapsed section named `Données source`. It shows the raw scraped labels and values for audit/debugging. This keeps transparency without letting messy data dominate the page.

## Branding and Logo System

Keep the existing palette:

- Crimson primary
- Ivory background
- Charcoal text
- Gold accent

Create a simple independent product logo, not an official-government mark.

Required assets:

- `logo-full.svg`: mark plus `Marchés Publics Maroc`
- `logo-mark.svg`: compact standalone mark
- `logo-wordmark.svg`: text-only variant if useful
- `favicon.svg`: simplified mark
- Reversed variants for dark backgrounds

Recommended mark direction:

- Abstract document/page or tender notice shape
- Subtle grid/reference cue to suggest catalog/search
- Small Moroccan-inspired geometric detail through color and proportion, not state insignia

Avoid:

- Crown, official seal, coat of arms, national emblem, or ministry-like marks
- Overly decorative calligraphy
- Gradients or effects on the logo
- Changing the existing color direction

## Data Flow

```text
Stored raw tender fields
        |
        v
Backend normalization + regex extraction
        |
        v
display + signals API contract
        |
        v
TenderDetail renders decision-first UI
        |
        v
Raw source drawer preserves original fields
```

## Testing

Backend tests should cover:

- Title cleanup with duplicated commune/province fragments
- Buyer/location de-duplication
- Monetary parsing for Moroccan number formats
- Rejection of `0,00 MAD` as useful estimation
- Candidate count extraction from explicit labels only
- Missing-field behavior when only the base tender row exists

Frontend tests or build checks should cover:

- Rendering with full display/signals data
- Rendering with base tender only
- KPI states for detected, missing, needs verification, and not applicable
- Raw drawer remains available but collapsed by default

## Acceptance Criteria

- The detail page title is clean and does not repeat commune/province/buyer metadata unnecessarily.
- The first screen prioritizes deadline, budget/estimation, caution, DCE availability, applications, and market price.
- Missing values are explicit and professional.
- Raw source data is still accessible for audit.
- The page does not automatically refresh or scrape source data.
- Regex-derived values include confidence/source metadata.
- Logo assets exist for full, mark, favicon, and reversed usage.
- Navbar uses the new logo without changing the approved color palette.
