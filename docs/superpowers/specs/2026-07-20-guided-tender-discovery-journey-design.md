# Guided Tender Discovery Journey Design

Date: 2026-07-20

## Goal

Redesign the app's conceptual user journey for a beginner who says: "Je decouvre les marches publics."

The app should no longer feel like a collection of procurement features. It should feel like a guided path where real tender opportunities appear immediately, and the app teaches the user how to understand, compare, and act on them.

## Research Basis

This design uses the following UX principles from current reference material:

- Nielsen Norman Group defines a journey map around one actor, one scenario, phases, actions, mindsets, emotions, and opportunities: https://www.nngroup.com/articles/journey-mapping-101/
- NN/g distinguishes broad user journeys from granular product flows. This app needs both: a macro beginner procurement journey and focused flows for search, detail review, saving, and alert creation: https://www.nngroup.com/articles/user-journeys-vs-user-flows/
- NN/g list-page guidance says listing entries must show enough priority information to support scanning and comparison, without overwhelming the user or forcing repeated detail-page visits: https://www.nngroup.com/articles/list-entries/
- GOV.UK service guidance recommends mapping the user's whole problem and making the service coherent from start to finish, instead of shaping it around internal structures: https://www.gov.uk/service-manual/design/map-a-users-whole-problem
- GOV.UK user-needs guidance says service design should start with what people are trying to do, their frustrations, and what they need to achieve an outcome: https://www.gov.uk/service-manual/user-research/start-by-learning-user-needs

## Primary Actor

Beginner Moroccan SME owner or manager.

They may sell services, supplies, or works that could match public tenders, but they do not yet understand procurement vocabulary, procedure types, qualification requirements, DCE documents, cautions, or bid-preparation steps.

They are not primarily looking for analytics. They are trying to answer:

- Are there public opportunities for my business?
- Which ones are realistic for me?
- What does this tender require?
- What should I do next?
- How can I avoid missing similar opportunities later?

## Design Position

Use a hybrid of two approaches:

- Guided start: the product explains the path and asks simple beginner questions.
- Tender-first discovery: the product shows real active opportunities early, so the user sees value immediately.

The resulting product pattern is:

```text
Discover relevant tenders -> Understand them -> Decide if eligible -> Prepare the next step -> Track similar opportunities
```

## Journey Phases

### 1. Discover

User mindset:

"I want to know whether public tenders are relevant to my business."

Product responsibility:

- Show active opportunities immediately, not only stats or abstract sector lists.
- Ask simple questions before exposing procurement-specific filters.
- Use plain-language entry points:
  - "Que vendez-vous ?"
  - "Ou pouvez-vous intervenir ?"
  - "Combien de temps avez-vous pour repondre ?"
  - "Quel budget semble adapte a votre entreprise ?"

Current features absorbed into this phase:

- Overview
- Consultations
- Sectors
- Cities
- Regions

Primary UI idea:

The homepage becomes a guided discovery surface with a short filter assistant and a curated tender preview. Statistics can remain available, but they should support discovery rather than dominate the first screen.

### 2. Compare

User mindset:

"Which tenders should I open first?"

Product responsibility:

- Present tenders as beginner-readable cards or a simplified list before dense tables.
- Prioritize decision attributes consistently:
  - Tender title or object
  - Buyer
  - Location
  - Deadline and urgency
  - Estimated value when available
  - Sector/category
  - Document availability
  - Beginner guidance label
- Hide advanced filters until the user asks for them.
- Keep dense table/export behavior available as a secondary mode, not the default beginner experience.

Beginner guidance labels may include:

- "Bon delai pour verifier"
- "Delai court"
- "Budget a verifier"
- "Qualifications probablement requises"
- "Documents a telecharger"
- "Acheteur recurrent"

Current features absorbed into this phase:

- Tender table
- FilterBar
- Export
- Stats as secondary exploration

Primary UI idea:

Consultations becomes a workbench with two modes:

- Guided view: card/list with explanations and simple filters.
- Expert view: dense table, advanced filters, export.

The default for this journey is guided view.

### 3. Evaluate

User mindset:

"Can my company realistically respond to this tender?"

Product responsibility:

- Tender detail must lead with a decision checklist rather than a raw information dump.
- The page should translate procurement data into questions:
  - "Puis-je intervenir dans cette ville ou region ?"
  - "Le delai est-il realiste ?"
  - "Y a-t-il une estimation ou une caution ?"
  - "Des qualifications, agrements, echantillons, visite ou reunion sont-ils requis ?"
  - "Quels documents dois-je lire en premier ?"
- Show source data and legal/procedural detail below the checklist for trust and completeness.

Current features absorbed into this phase:

- Tender detail
- Eligibility
- Legal tooltips
- Compliance checklist
- Assistant seeded with tender context

Primary UI idea:

Tender detail becomes a "decision page" with:

- Top summary
- Beginner verdict area
- Requirement checklist
- Primary actions
- Full tender details

The page should not claim eligibility with false certainty. It should classify what is known, what is missing, and what the user must verify in the DCE.

### 4. Prepare

User mindset:

"I want to know the next practical step."

Product responsibility:

- Tools should appear from the tender context instead of as disconnected destinations.
- The app should recommend the next action based on the tender's data:
  - Download DCE
  - Ask assistant about this tender
  - Calculate caution or deadline
  - Read procedure explanation
  - Build a document checklist
  - Save for later if not ready

Current features absorbed into this phase:

- Guide
- Procedures
- Calculator
- Candidacy assistant
- Recours, only when relevant to a dispute or deadline issue

Primary UI idea:

The Guide page becomes a contextual preparation hub. It can still be browsed independently, but its strongest entry point is from a selected tender.

### 5. Track

User mindset:

"I do not want to lose this opportunity or miss similar ones."

Product responsibility:

- Saving and alerts should use beginner language.
- Alert creation should not require sector codes or procurement jargon.
- Alerts from tender context should be one action:
  - "Recevoir des opportunites similaires"
- Favorites should answer:
  - "What am I considering?"
  - "What requires action soon?"
  - "What did I reject or archive?"

Current features absorbed into this phase:

- Favorites
- Alerts
- Daily digest
- Login/register return intent

Primary UI idea:

Favorites and alerts become "Mes opportunites", organized by action state:

- A verifier
- A preparer
- Surveillees
- Archivees

## Information Architecture

Top-level navigation should be reduced around journey verbs:

- Decouvrir
- Mes opportunites
- Preparer
- Suivre

Recommended mapping:

- Decouvrir: overview, guided search, tender results, regions, cities, sectors
- Mes opportunites: saved tenders, recently viewed tenders, tender status groups
- Preparer: contextual guide, procedures, calculator, eligibility, assistant
- Suivre: alerts, digests, notification settings

Secondary/commercial content should move out of the main journey:

- Blog: support content linked contextually from Preparer or footer
- Pricing: account/commercial area, not a core beginner journey step
- Partners: trust/source page, likely footer or "About data" area
- Stats: secondary insight area inside Decouvrir, not a primary beginner nav item

## Page Role Changes

### Current Overview

New role:

Beginner launchpad and live opportunity preview.

First screen should include:

- Clear promise: find public tenders you can understand and evaluate.
- Simple guided filter starter.
- A small set of active tenders.
- Data freshness/status.
- "Voir plus de consultations" action.

It should not start with only category totals and sector grids.

### Current Consultations

New role:

Guided opportunity comparison.

Default presentation should support beginner scanning. Advanced filters, export, and dense table behavior should remain available but not dominate.

### Current Tender Detail

New role:

Decision and preparation page.

The page should answer "Should I pursue this?" before it asks the user to inspect raw fields.

### Current Guide And Tools

New role:

Contextual preparation support.

The user should mostly arrive here from a tender, with relevant context already attached.

### Current Favorites And Alerts

New role:

Opportunity tracking.

These pages should be part of the tender journey, not generic account utilities.

## Content Principles

- Use beginner-facing French labels for primary navigation and calls to action.
- Explain procurement terms only when the user meets them.
- Use progressive disclosure for advanced filters and legal detail.
- Keep expert affordances available but visually secondary.
- Always show system status: data freshness, loading, import state, action success, and failures.
- Avoid presenting all features as equal choices.

## Success Criteria

- A new user can start from the homepage and understand what to do next without reading a separate guide first.
- Real tender opportunities appear early enough that the app still feels data-driven.
- The default tender list is scannable and uses consistent priority information.
- Tender detail leads with a decision checklist and next actions.
- Guide/tools are reachable from tender context and feel like preparation support.
- Favorites and alerts are framed as opportunity tracking.
- Blog, pricing, partners, and stats no longer compete with the core beginner journey.
- Advanced table/filter/export workflows remain accessible for returning or power users.

## Implementation Decisions And Risks

- Consultation view mode should start as a per-session toggle. Persisting a preference can be added after the guided view proves useful.
- Beginner labels must only use fields the backend already exposes reliably. If a label depends on uncertain or missing data, it should be phrased as something to verify, not as a verdict.
- "Mes opportunites" should initially reframe existing favorites and alerts rather than merge their data models. A deeper merge can follow once the journey is validated.
- Tender cards should become the default beginner presentation on mobile and on the Overview preview. Desktop Consultations can keep the dense table available behind an expert view toggle.

## Recommended Next Step

Create an implementation plan that starts with information architecture and page-role changes before visual polishing:

1. Rework top-level navigation labels and grouping.
2. Rebuild Overview as guided discovery plus tender preview.
3. Add guided/default presentation to Consultations.
4. Reframe Tender Detail around decision checklist and next actions.
5. Connect Guide/tools from tender context.
6. Reframe Favorites/Alerts as opportunity tracking.
