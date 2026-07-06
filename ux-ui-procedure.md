# UX/UI features based on the public procurement procedure analysis

This document summarizes product features that would help users understand and act on Moroccan public procurement procedures, based on `analyse_juridique_commissions_procedure.pdf`.

## Highest-value features

### 1. Procedure badge and legal stage

Show the procurement mode clearly on tender cards and detail pages:

- Appel d'offres ouvert
- Appel d'offres ouvert simplifie
- Appel d'offres restreint
- Appel d'offres avec preselection
- Concours
- Dialogue competitif
- Procedure negociee

Also expose the current legal stage where possible:

- Publication
- Candidature
- Ouverture des plis
- Evaluation
- Proposition d'attribution
- Delai d'attente
- Approbation

Important wording: avoid labeling the process as handled by a separate "commission d'attribution". The commission proposes an offer to the maitre d'ouvrage; final approval is a separate step handled by the competent authority.

### 2. Deadline timeline

Add a visual timeline for each tender with key procedural dates and legal windows.

Useful deadline rules include:

- 10 days minimum for appel d'offres ouvert simplifie and some negotiated procedures with publicity.
- 15 days minimum for preselection, dialogue competitive candidatures, and related admission phases.
- 21 days minimum for standard appel d'offres ouvert.
- 30 days minimum for final offers after dialogue competitif invitation.
- 40 days minimum for certain higher-value procedures.
- 60 days for offer validity / approval notification windows where applicable.

Recommended states:

- Submission closes soon
- Appeal window active
- Waiting period before approval
- Approval deadline approaching
- Procedure closed

### 3. Procedure-specific document checklist

Generate a checklist based on the procedure type and tender requirements.

Common checklist items:

- Dossier administratif
- Dossier technique
- Declaration sur l'honneur
- Offre financiere
- Offre technique, if required
- CPS signed and initialed
- Reglement de consultation signed and initialed
- Groupement agreement, if applicable
- Tax certificate, when required
- CNSS or equivalent social certificate, when required
- Qualification, classification, or approval certificates, when applicable
- Attestations de reference, except where the simplified procedure removes them
- Plan de charge, if required

The checklist should distinguish between:

- Documents required at initial submission
- Documents required only if attribution is being considered
- Documents that depend on the regulation/consultation file

### 4. Eligibility checker

Add a guided eligibility panel for suppliers.

Core checks:

- Legal capacity
- Technical capacity
- Financial capacity
- Fiscal regularity
- Social security regularity
- Activity related to the contract object
- No liquidation judiciaire
- No unauthorized redressement judiciaire
- No temporary or definitive exclusion
- No conflict of interest
- Did not participate in preparing the tender file
- Not representing multiple competitors in the same market or lot

The output should be practical:

- Eligible
- Probably eligible, missing proof
- Risk detected
- Not eligible based on declared information

### 5. Appeal and recourse assistant

Add a module explaining administrative remedies and CNCP referral options.

The assistant should help users identify:

- Whether they can complain about a procedural defect
- Whether clauses look discriminatory or disproportionate
- Whether a conflict of interest may exist
- Whether they can challenge rejection reasons
- The deadline to complain
- The correct authority to contact
- Whether CNCP referral is still possible
- Whether a suspension request may apply

Useful UI states:

- Recourse window open
- Recourse window closing soon
- Recourse window expired
- CNCP referral possible
- Judicial route may affect CNCP instruction

### 6. Price risk indicator

Provide a calculator that compares the user's intended offer against the estimated contract amount.

Flag potential risks:

- Excessive offer: above 20% of the estimated cost for works, supplies, and services other than studies.
- Abnormally low offer for works: below 20% of the estimated cost.
- Abnormally low offer for supplies/services other than studies: below 25% of the estimated cost.

The UI should explain that these are risk indicators and that the commission may request justifications.

### 7. Commission and organ information

Show which body examines the procedure:

- Commission d'appel d'offres
- Commission d'appel d'offres ouvert simplifie
- Commission d'appel d'offres avec preselection
- Jury du concours
- Commission de negociation
- Dialogue competitif admission commission
- Dialogue competitif final opening and examination commission

For dialogue competitif, note that the dialogue phase itself is conducted by the maitre d'ouvrage assisted by at least two representatives, rather than by a separate "commission de dialogue" expressly created by the text.

### 8. Legal source chips

Display small, non-intrusive legal references next to procedural rules.

Examples:

- Art. 27: eligibility conditions
- Art. 28: administrative and technical files
- Art. 29: declaration sur l'honneur
- Art. 30: submission file contents
- Art. 38: commission d'appel d'offres
- Art. 53: preselection/admission logic
- Art. 87-90: negotiated procedure
- Art. 142-143: approval and deadlines
- Art. 152: coercive measures and exclusions
- Art. 162: conflict of interest
- Art. 163-164: complaints and CNCP referral

These references should support trust without turning the interface into a legal document.

### 9. Legal-risk filters

Extend tender filters beyond category, sector, entity, location, and status.

Recommended filters:

- Procedure type
- Deadline window
- Requires technical offer
- Simplified procedure
- Preselection required
- Negotiated procedure
- High-value tender
- Appeal window active
- Waiting period active
- Missing detail data
- Estimated price available

### 10. Tender detail compliance panel

Add a right-side compliance panel on the tender detail page.

Suggested sections:

- Procedure type
- Current stage
- Key dates
- Required documents
- Eligibility risks
- Price risk
- Appeal rights
- Relevant legal references
- Link to original portal notice

This panel should be scannable and action-oriented, not a long legal explanation.

## Recommended implementation order

1. Add procedure badges and legal-stage labels.
2. Add deadline timeline and warning states.
3. Add procedure-specific document checklists.
4. Add tender detail compliance panel.
5. Add eligibility checker.
6. Add price risk calculator.
7. Add appeal and CNCP assistant.
8. Add legal source chips.
9. Add advanced legal-risk filters.

## Design principles

- Keep legal guidance contextual and close to the user action.
- Use plain procedural labels, with legal article references available as secondary metadata.
- Separate confirmed data from inferred guidance.
- Clearly mark fields that depend on the consultation regulation or missing portal data.
- Avoid implying final attribution before approval by the competent authority.
- Prioritize deadline visibility, because many user risks are time-sensitive.
