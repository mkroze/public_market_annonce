# Potential Partner Mapping

This document maps potential partners for a Moroccan public procurement / tender intelligence product. Partners are grouped by likely value: official credibility, procurement data access, supplier acquisition, SME enablement, sector distribution, and institutional funding.

## Strategic Priority Partners

These are the first institutions to target.

1. **TGR / Tresorerie Generale du Royaume**
   - Best fit for: official legitimacy, procurement platform access, dematerialization, public buyer and supplier workflows.
   - Why: the Portail Marocain des Marches Publics is operated in the TGR ecosystem and is the central public procurement exchange platform.
   - Source: <https://www.tgr.gov.ma/> and <https://www.marchespublics.gov.ma/pmmp/>

2. **Portail Marocain des Marches Publics / PMMP**
   - Best fit for: direct product alignment, tender data, public buyer workflows, supplier workflows, official notices, PV extracts, final results and regulatory texts.
   - Why: the portal describes itself as the common exchange platform between public buyers and suppliers.
   - Source: <https://www.marchespublics.gov.ma/pmmp/>

3. **Ministere de l'Economie et des Finances**
   - Best fit for: public finance, procurement policy, payment delays, supplier access, transparency and official sponsorship.
   - Why: procurement is directly linked to public expenditure, budget control and financial governance.
   - Source: <https://www.finances.gov.ma/>

4. **Ministere de la Transition Numerique et de la Reforme de l'Administration**
   - Best fit for: e-government, public-service UX, administrative simplification, dematerialized procurement.
   - Why: the product is a digital public-service layer around procurement information.
   - Source: <https://www.mmsp.gov.ma/>

5. **Agence de Developpement du Digital / ADD**
   - Best fit for: public digital transformation, interoperability, national digital strategy, adoption inside public administrations.
   - Why: ADD is a public institution responsible for supporting Morocco's digital development and digital transformation.
   - Source: <https://www.add.gov.ma/>

6. **Ministere de l'Interieur / DGCT / INDH**
   - Best fit for: communes, provinces, regions, local development projects, territorial public procurement.
   - Why: local authorities and INDH-funded projects generate significant procurement needs, especially around infrastructure, social services and territorial development.
   - Source: <https://www.indh.ma/>

7. **Commission Nationale de la Commande Publique / CNCP**
   - Best fit for: legal trust, procurement guidance, complaints and recourse education.
   - Why: the CNCP is central to public procurement interpretation and remedies.
   - Source: PMMP regulatory page: <https://www.marchespublics.gov.ma/pmmp/textereg.html?lang=fr&rubrique6=>

8. **Maroc PME**
   - Best fit for: SME onboarding, supplier readiness, training SMEs to respond to tenders, growth programs.
   - Why: the product can help very small, small and medium enterprises access public procurement opportunities.
   - Source: <https://marocpme.gov.ma/>

9. **CGEM / Confederation Generale des Entreprises du Maroc**
   - Best fit for: private-sector distribution, enterprise feedback, B2B partnerships, paid adoption.
   - Why: CGEM is the main private-sector umbrella organization.
   - Source: <https://www.cgem.ma/>

10. **FNBTP / Federation Nationale du Batiment et des Travaux Publics**
    - Best fit for: construction and public works supplier acquisition.
    - Why: construction and public works are among the largest public procurement categories.
    - Source: <https://www.fnbtp.ma/>

## Priority Data Portals And Transparency Surfaces

These portals are not only partner targets. They are the actual public data and workflow surfaces that can reduce administrative opacity: procurement, legal texts, company identity, land, permits, complaints, budgets, public audits, trade, taxation, employment and socioeconomic baselines.

### Tier 1: Core Integration Targets

1. **Portail Marocain des Marches Publics / PMMP**
   - Data surface: consultations in progress, advanced tender search, purchase notices, PV extracts, final results, completion reports, forecast programs, excluded companies, buyer/supplier access, guides and procurement regulations.
   - Product value: primary tender-intelligence source; enables alerts, buyer profiles, award tracking, sector/category intelligence, deadline monitoring and supplier-readiness tools.
   - Access notes: public web portal with structured pages and documents; official partnership/API access should be pursued through TGR/PMMP before relying on scraping.
   - Source: <https://www.marchespublics.gov.ma/pmmp/>

2. **Portail National des Donnees Ouvertes / data.gov.ma**
   - Data surface: national CKAN open-data catalogue, datasets, groups, producers, tags, resources, activity feeds and API endpoints.
   - Product value: should be the default discovery layer for reusable public datasets; useful for enrichment, cross-referencing and monitoring what administrations publish.
   - Access notes: CKAN API is documented and exposes package search/list/show and resource search endpoints, but dataset coverage and freshness need dataset-by-dataset validation.
   - Source: <https://www.data.gov.ma/> and <https://www.data.gov.ma/index.php/fr/guide-api>

3. **SGG / Bulletin Officiel**
   - Data surface: official laws, decrees, regulations, conventions, legal/judicial/administrative announcements, land-registration announcements, official French translations and bulletin search.
   - Product value: canonical legal-history layer; lets users connect tenders, procedures and administrative obligations to the official text that created or changed them.
   - Access notes: public search and downloadable official bulletins; important for citation, versioning and legal-change tracking.
   - Source: <https://www.sgg.gov.ma/BulletinOfficiel.aspx>

4. **Adala / Ministry of Justice Legal Portal**
   - Data surface: legal texts, legislative and regulatory sources, advanced legal search, draft laws, circulars, publications, justice-related royal speeches and links to jurisprudence.
   - Product value: legal navigation layer for citizens, SMEs and professionals who need to understand obligations without reading scattered official texts manually.
   - Access notes: useful complement to the Bulletin Officiel because it is organized around legal search and legal-source discovery.
   - Source: <https://adala.justice.gov.ma/>

5. **Directinfo / OMPIC**
   - Data surface: OMPIC databases, Registre Central du Commerce, industrial property, legal company sheets, financial sheets, statutes, minutes, financial statements, auditor reports and company-creation barometer.
   - Product value: company identity, supplier verification, beneficial procurement context, competitor discovery, corporate history and SME onboarding.
   - Access notes: some documents/services are transactional or paid; still a priority because it is the official business identity surface.
   - Source: <https://www.directinfo.ma/>

6. **HCP / Haut-Commissariat au Plan**
   - Data surface: official statistics, databases, microdata/open data, visualizations, census/RGPH results, labor market, demographics, economy, living conditions, SDGs, publications and release calendar.
   - Product value: national baseline for market sizing, territorial context, socioeconomic indicators and policy-impact interpretation.
   - Access notes: data quality is high relative to many portals; integration should preserve methodology and publication-date metadata.
   - Source: <https://www.hcp.ma/>

### Tier 2: High-Value Administrative Workflow Portals

7. **ANCFCC / Conservation Fonciere, Cadastre et Cartographie**
   - Data surface: property certificates, cadastral plans, document verification, price reference, cartography, Mohafadati, land publicity, payments, forms and supplier invoice deposit.
   - Product value: land and property transparency, project due diligence, construction context, territorial planning and real-estate risk reduction.
   - Access notes: many services are transactional and document-based; treat as a workflow/reference portal more than a bulk open-data source.
   - Source: <https://www.ancfcc.gov.ma/>

8. **Chikaya / Portail National des Reclamations**
   - Data surface: complaints, complaint tracking, observations, suggestions, statistics and public-service feedback channels.
   - Product value: accountability signal for administrative friction; useful for detecting recurrent service problems by administration, territory or procedure.
   - Access notes: public statistics are useful, but complaint content can involve personal data and should be handled only through authorized, privacy-preserving access.
   - Source: <https://www.chikaya.ma/>

9. **Rokhas**
   - Data surface: administrative permits and authorizations, especially urban-planning and economic-activity authorizations.
   - Product value: high-impact simplification layer for construction, business activity, licensing and territorial procedures.
   - Access notes: current public discoverability is weaker than PMMP/data.gov.ma; partnership route through Interior/DGCT/local authorities is likely more realistic than open extraction.
   - Source: <https://rokhas.ma/>

10. **PortNet**
    - Data surface: foreign-trade procedures, import/export formalities, licenses, authorizations, port community system, cargo community system, real-time dossier traceability, customs-related workflows and partner administration access.
    - Product value: removes fog around import/export, logistics, customs coordination and administrative lead times for businesses.
    - Access notes: operational platform with many authenticated services; public pages are useful for mapping procedures, while detailed workflow data requires partnership.
    - Source: <https://www.portnet.ma/>

11. **Emploi-public.ma**
    - Data surface: public-sector recruitment announcements, concours, results, convocations, public job procedures and candidate spaces.
    - Product value: transparency around public employment opportunities and recruitment timelines.
    - Access notes: relevant outside procurement because public hiring is one of the main citizen-facing bureaucratic surfaces.
    - Source: <https://www.emploi-public.ma/>

### Tier 3: Oversight, Finance, Tax And Market-Regulation Surfaces

12. **LOF / Direction du Budget / Ministry of Economy and Finance**
    - Data surface: finance laws by year, citizen budget, triennial budget programming, ministry budgets, budget documents, settlement laws, public-finance statistics, budget-performance documentation and LOF implementation material.
    - Product value: connects procurement and public programs to budget authorizations, spending priorities and performance objectives.
    - Access notes: good document source; structured extraction may require PDF/document parsing.
    - Source: <https://lof.finances.gov.ma/fr>

13. **Cour des Comptes**
    - Data surface: annual reports, finance-law execution reports, thematic reports, regional court material, audit findings, recommendations and public-accountability publications.
    - Product value: strongest public source for audit signals, governance risks, repeated management failures and follow-up opportunities.
    - Access notes: largely document/report based; useful for entity risk scoring and policy/funding analysis.
    - Source: <https://www.courdescomptes.ma/>

14. **Conseil de la Concurrence**
    - Data surface: consultative opinions, merger-control decisions, anti-competitive practice decisions, sector studies, annual reports, communiques, guidelines and enforcement statistics.
    - Product value: market-structure and competition-risk layer; useful for detecting concentration, regulated-market issues and procurement market distortions.
    - Access notes: primarily document/publication based, but highly valuable for sector intelligence.
    - Source: <https://conseil-concurrence.ma/>

15. **Direction Generale des Impots / DGI**
    - Data surface: tax guidance, online appointments, taxpayer services, forms, tax news, documentation and taxpayer-facing procedures.
    - Product value: important for supplier readiness, compliance calendars, tax attestation workflows and SME administrative navigation.
    - Access notes: many useful services are authenticated; public material remains valuable for procedure mapping.
    - Source: <https://www.tax.gov.ma/>

16. **Administration des Douanes et Impots Indirects / ADII**
    - Data surface: customs rules, tariff/nomenclature information, import/export compliance, procedures and customs services.
    - Product value: trade compliance and import-cost transparency; strongest when combined with PortNet and Office des Changes data.
    - Access notes: some pages may restrict automated access; partnership or official service channels are preferable.
    - Source: <https://www.douane.gov.ma/>

17. **Office des Changes**
    - Data surface: foreign-exchange regulation, balance-of-payments statistics, foreign-trade statistics, exchange-office information and circulars.
    - Product value: import/export intelligence, macro context and regulatory clarity for cross-border operations.
    - Access notes: useful for data enrichment around trade flows and foreign-exchange obligations.
    - Source: <https://www.oc.gov.ma/>

## Portal Evaluation Criteria

For each portal above, evaluate the opportunity with the same checklist:

- **Authority:** Is it the canonical official source or only a convenience portal?
- **Data richness:** Does it expose records, documents, statistics, workflows, decisions, or only generic information?
- **Freshness:** Are publication dates, update dates and historical archives available?
- **Access model:** Open API, public pages, downloadable files, authenticated workflow, paid documents, or partnership-only access.
- **Linkability:** Can records be connected to a company, public buyer, ministry, commune, region, legal text, budget line or project?
- **Privacy/compliance:** Does it contain personal data, protected business data or complaint data requiring CNDP/privacy controls?
- **Operational value:** Does it help a citizen, SME, journalist, investor or public buyer understand what to do, what changed, who decided, who won, what was spent or what went wrong?

## Core Public Procurement, Legal And Governance Partners

- TGR / Tresorerie Generale du Royaume
- PMMP / Portail Marocain des Marches Publics
- Ministere de l'Economie et des Finances
- Direction du Budget
- Direction des Entreprises Publiques et de la Privatisation / DEPP
- Direction Generale des Impots / DGI
- Administration des Douanes et Impots Indirects / ADII
- Secretariat General du Gouvernement / SGG
- Commission Nationale de la Commande Publique / CNCP
- Cour des Comptes
- Inspection Generale des Finances / IGF
- Instance Nationale de la Probite, de la Prevention et de la Lutte contre la Corruption / INPPLC
- Conseil de la Concurrence
- Commission Nationale de controle de la protection des Donnees a caractere Personnel / CNDP
- Archives du Maroc
- Haut-Commissariat au Plan / HCP

## Central Ministries To Target

- Chef du Gouvernement
- Ministere de l'Interieur
- Ministere de l'Economie et des Finances
- Ministere de la Transition Numerique et de la Reforme de l'Administration
- Ministere de l'Investissement, de la Convergence et de l'Evaluation des Politiques Publiques
- Ministere de l'Industrie et du Commerce
- Ministere de l'Agriculture, de la Peche Maritime, du Developpement Rural et des Eaux et Forets
- Ministere de l'Equipement et de l'Eau
- Ministere du Transport et de la Logistique
- Ministere de la Sante et de la Protection Sociale
- Ministere de l'Education Nationale, du Prescolaire et des Sports
- Ministere de l'Enseignement Superieur, de la Recherche Scientifique et de l'Innovation
- Ministere de l'Amenagement du Territoire National, de l'Urbanisme, de l'Habitat et de la Politique de la Ville
- Ministere de la Transition Energetique et du Developpement Durable
- Ministere du Tourisme, de l'Artisanat et de l'Economie Sociale et Solidaire
- Ministere de l'Inclusion Economique, de la Petite Entreprise, de l'Emploi et des Competences
- Ministere de la Solidarite, de l'Insertion Sociale et de la Famille
- Ministere de la Jeunesse, de la Culture et de la Communication
- Ministere de la Justice
- Ministere des Habous et des Affaires Islamiques
- Ministere des Affaires Etrangeres, de la Cooperation Africaine et des Marocains Residant a l'Etranger

## Local And Territorial Partners

- DGCT / Direction Generale des Collectivites Territoriales
- Wilayas
- Prefectures
- Provinces
- Communes
- Conseils regionaux
- Conseils provinciaux
- Societes de developpement local / SDL
- Agences urbaines
- Centres Regionaux d'Investissement / CRI
- Chambres de commerce, d'industrie et de services
- Chambres d'agriculture
- Chambres d'artisanat
- Chambres des peches maritimes

### Regional Investment Centers

Each region has a CRI. They are useful for regional business development, investment support, investor orientation and coordination with public actors.

- CRI Tanger-Tetouan-Al Hoceima
- CRI Oriental
- CRI Fes-Meknes
- CRI Rabat-Sale-Kenitra
- CRI Beni Mellal-Khenifra
- CRI Casablanca-Settat
- CRI Marrakech-Safi
- CRI Draa-Tafilalet
- CRI Souss-Massa
- CRI Guelmim-Oued Noun
- CRI Laayoune-Sakia El Hamra
- CRI Dakhla-Oued Ed-Dahab

## Agriculture, Food And Rural Partners

- **ONSSA / Office National de Securite Sanitaire des Produits Alimentaires**
  - Strong fit for food, agriculture, veterinary, sanitary certification and control-related procurement.
  - Source: <https://www.onssa.gov.ma/>
- ONCA / Office National du Conseil Agricole
- ADA / Agence pour le Developpement Agricole
- ANEF / Agence Nationale des Eaux et Forets
- ANDZOA / Agence Nationale pour le Developpement des Zones Oasiennes et de l'Arganier
- ORMVA regional agricultural development offices
- ONP / Office National des Peches
- INRH / Institut National de Recherche Halieutique
- ANDA / Agence Nationale pour le Developpement de l'Aquaculture

## Infrastructure, Water, Transport And Logistics Partners

- ONEE / Office National de l'Electricite et de l'Eau Potable
- ONCF / Office National des Chemins de Fer
- ONDA / Office National des Aeroports
- ANP / Agence Nationale des Ports
- ADM / Autoroutes du Maroc
- SNTL / Societe Nationale des Transports et de la Logistique
- AMDL / Agence Marocaine de Developpement de la Logistique
- NARSA / Agence Nationale de la Securite Routiere
- Agences de Bassins Hydrauliques

## Health And Social Partners

- Ministere de la Sante et de la Protection Sociale
- CHU networks
- Regional health directorates
- INH / Institut National d'Hygiene
- CNSS / Caisse Nationale de Securite Sociale
- ANAM or successor social-protection bodies
- Mutuals and health procurement bodies
- Entraide Nationale
- Agence de Developpement Social

## Education, Skills And Employment Partners

- OFPPT / Office de la Formation Professionnelle et de la Promotion du Travail
- ANAPEC / Agence Nationale de Promotion de l'Emploi et des Competences
- AREFs / Academies Regionales d'Education et de Formation
- Public universities
- CNRST / Centre National pour la Recherche Scientifique et Technique
- ONOUSC / Office National des Oeuvres Universitaires, Sociales et Culturelles
- Ministry of Higher Education, Scientific Research and Innovation
- Ministry of National Education, Preschool and Sports

## Investment, Industry, Export And SME Partners

- AMDIE / Agence Marocaine de Developpement des Investissements et des Exportations
- Maroc PME
- OMPIC / Office Marocain de la Propriete Industrielle et Commerciale
- Office des Changes
- Casablanca Finance City
- Casablanca Stock Exchange
- Tamwilcom
- CDG / Caisse de Depot et de Gestion
- CDG Invest
- Regional industrial acceleration zones
- Industrial clusters and competitiveness clusters

## Energy, Environment And Climate Partners

- MASEN / Moroccan Agency for Sustainable Energy
- ONEE
- AMEE / Agence Marocaine pour l'Efficacite Energetique
- IRESEN / Institut de Recherche en Energie Solaire et Energies Nouvelles
- ONHYM / Office National des Hydrocarbures et des Mines
- Department of Sustainable Development
- Water basin agencies
- National climate and green-economy programs

## Tourism, Craft, Culture And Events Partners

- ONMT / Office National Marocain du Tourisme
- SMIT / Societe Marocaine d'Ingenierie Touristique
- Maison de l'Artisan
- Regional tourism councils
- Ministry of Tourism, Handicrafts and Social and Solidarity Economy
- Ministry of Youth, Culture and Communication
- Public museums and cultural foundations
- Event and convention bodies

## Private-Sector And Supplier Acquisition Partners

- CGEM
- FNBTP
- ASMEX / Association Marocaine des Exportateurs
- AMITH / textile and clothing industries
- AMICA / automotive industry
- APEBI / digital and IT sector
- FENELEC / electrical, electronics and renewable energy industries
- FNIH / hotel industry
- FENIP / fish processing and valorization industries
- Federation of metallurgical, mechanical and electromechanical industries
- Federation of chemistry and parachemistry
- Federation of commerce and services
- Transport and logistics federations
- Ordre National des Architectes
- Ordre des Experts-Comptables
- Bar associations
- Engineering and consulting associations
- CFCIM / Chambre Francaise de Commerce et d'Industrie du Maroc
- AmCham Morocco
- BritCham Morocco
- Belgian-Luxembourg Chamber
- Spanish Chamber
- German Chamber

## International And Development Partners

- World Bank
- IFC / International Finance Corporation
- MIGA / Multilateral Investment Guarantee Agency
- African Development Bank
- European Union Delegation in Morocco
- EBRD / European Bank for Reconstruction and Development
- EIB / European Investment Bank
- AFD / Agence Francaise de Developpement
- Expertise France
- GIZ
- KfW
- UNDP
- UNICEF
- UNOPS
- ILO
- OECD / SIGMA
- WTO
- UNCITRAL
- Islamic Development Bank
- IMF

## Best Partnership Angles

### TGR / PMMP

- Official data access
- Better tender discovery
- Supplier onboarding
- Public buyer feedback
- Training around dematerialized procurement

### Digital Ministry / ADD

- Public-service digitization
- User experience modernization
- Interoperability
- National digital strategy alignment

### Interior / INDH / DGCT

- Local procurement
- Communes and regions
- Territorial development
- Inclusion of small local suppliers
- Better visibility on local public opportunities

### Maroc PME / ANAPEC / OFPPT

- SME training
- Supplier-readiness programs
- Public procurement literacy
- Certification and skill-building tracks

### CGEM / FNBTP / Sector Federations

- Distribution to companies that actually bid
- Paid enterprise accounts
- Feedback loops on tender discovery and compliance pain points
- Sector-specific tender alerts

### Sector Agencies

Strong candidates for vertical pilots:

- ONSSA for agriculture, food, sanitary and veterinary procurement
- ONEE for water, energy and infrastructure
- ONCF for transport and infrastructure
- ONDA for airport, facility and equipment procurement
- CHU networks for health equipment and services
- AREFs for education procurement

### Donors And Development Institutions

- Funding
- Governance and transparency programs
- SME access to public procurement
- Anti-corruption and open-data initiatives
- Capacity building for suppliers and public buyers

## Recommended Outreach Sequence

1. TGR / PMMP
2. Ministry of Digital Transition
3. ADD
4. Ministry of Interior / DGCT / INDH
5. Maroc PME
6. CGEM
7. FNBTP
8. ONSSA
9. ONEE or ONCF
10. World Bank, AfDB, EU, GIZ or AFD for institutional funding and credibility

## Notes

- Treat public institutions as partnership targets, not sales leads only. The value is credibility, access and distribution.
- For private-sector bodies, the clearest value proposition is supplier acquisition and training.
- For international organizations, frame the project around SME inclusion, transparency, governance and public procurement modernization.
- For sector agencies, frame the product as a vertical intelligence layer: better discovery, compliance, deadlines and supplier readiness.
