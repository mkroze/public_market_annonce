# Presentation of Data — Marches Publics Maroc

What each page of the app displays, and where the data comes from. All tender data originates from the daily scrape of the Moroccan public-procurement portal, stored in SQLite (`backend/data/tenders.db`) and served by the FastAPI backend (`/api/*`).

## Main navigation

### `/` — Overview (Apercu)
Dashboard entry point. Live totals of active consultations pulled from the portal homepage counts (`/api/overview`), broken down by category (Travaux, Fournitures, Services) and sector, plus a manual "scrape now" trigger showing how many tenders were found/new.

### `/tenders` — Consultations
The main listing. Paginated, sortable table of tenders (`/api/tenders`) with: reference, title, buyer (acheteur), sector, category, location, procedure type, publication date, deadline and urgency indicator, status (en cours / cloture). Filterable by keyword, category, sector, buyer, location, status and procedure via the FilterBar; supports CSV export and per-row favorites.

### `/tenders/:id` — Tender detail
Everything about one consultation (`/api/tenders/{id}`): full detail sheet lazily scraped from the portal — objet, buyer, estimation (budget), caution provisoire, lot structure, execution location, retrait/depot addresses, qualifications and agrements required, PME reservation, meeting/site-visit info, contacts — plus PDF export and DCE (tender documents) download.

### `/stats` — Statistiques
Tabbed analytics hub. The "Vue d'ensemble" tab shows aggregate charts; the Villes, Regions and Secteurs tabs embed the corresponding pages below in embedded mode.

### `/cities` — Villes
Per-city aggregation (`/api/cities`): KPI cards (cities tracked, total/active consultations, top-5 concentration), an interactive SVG map of Morocco with dots sized by tender volume (hover = stats tooltip, click = filtered tender list), a sortable/searchable city ranking table (total, active, activity rate), dominant city and most active regions, and a top-10 distribution bar list.

### `/cities/:name` — City detail
One city's stats (`/api/cities/{name}`) plus its tender list.

### `/regions` — Regions
Same idea aggregated at region level (`/api/regions`, normalized from raw portal locations): totals, active counts and member cities per Moroccan administrative region.

### `/regions/:name` — Region detail
One region's stats and cities (`/api/regions/{name}`).

### `/sectors` — Secteurs
Sector taxonomy (`/api/sectors`) grouped by category, with tender counts per sector.

### `/sectors/:code` — Sector detail
One sector's activity (`/api/sectors/{code}`): volumes, top buyers, top locations.

## Guide & Outils (merged under `/guide`, tools also routable standalone)

### `/guide`
Single page bundling the practical tools below as tabs/sections (procedures, eligibilite, calculateur, assistant, recours).

### `/procedures` and `/procedures/:slug`
Static reference content on Moroccan procurement procedures (AOO, AOS, AMI, concours...): steps, deadlines, legal references. No backend data.

### `/eligibility`
Interactive questionnaire; verdict (eligible / probably eligible / not eligible / risk detected) computed client-side from the user's declared answers.

### `/calculator`
Client-side calculator for bid-related figures (caution, deadlines...). No backend data.

### `/assistant` — Candidacy assistant
AI-powered Q&A (`/api/assistant/ask`, Claude with a legal system prompt). Can be seeded with a tender id or procedure from query params.

### `/recours`
Guided tool for contesting a procurement decision; computes recourse deadlines from user-entered dates. Client-side only.

## Account features (login required)

### `/favorites`
The logged-in user's saved tenders (`/api/favorites`), same columns as the main listing.

### `/alerts`
The user's email alert subscriptions (`/api/alerts`): per alert its name, criteria shown as chips (sectors, regions, keywords, budget range in MAD), active/paused status, and last digest date. The form offers multi-select sector/region chips, a live preview ("N active consultations match"), and an SMTP test button. Matching new tenders are emailed daily after the scrape.

### `/login`, `/register`
Auth forms (email, password, name, company). No displayed data beyond the forms.

## Content & commercial

### `/blog` and `/blog/:slug`
Static editorial articles served by the backend (`/api/blog`): guides on Moroccan public procurement.

### `/pricing` — Tarifs
Static plan cards (Essentiel, Pro, Entreprise) with feature lists.

### `/partenaires` — Partners
Catalog of the data sources/portals the platform tracks, with per-source status badge and tier grouping. Static frontend data.
