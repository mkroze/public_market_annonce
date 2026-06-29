# MP Maroc

MP Maroc is a full-stack dashboard for tracking public procurement notices from `marchespublics.gov.ma`.

It combines:

- a Python/FastAPI backend that scrapes and stores tender data in SQLite
- a React/Vite frontend for browsing, filtering, and inspecting the imported consultations

The application is built around a simple workflow:

1. import active consultations from the public portal
2. browse them by category, sector, entity, location, and deadline
3. review aggregate statistics for the current dataset

## Features

- Home overview with live counts by category and sector
- Manual import trigger to refresh the local dataset
- Searchable and filterable tender list
- Sortable tender table with pagination
- Statistics view for top sectors and top entities
- Tender detail links back to the original portal when available

## Project Structure

```text
backend/
  main.py         FastAPI app and API routes
  scraper.py      HTML scraper for marchespublics.gov.ma
  database.py     SQLite initialization and connection helpers
  config.py       Portal URLs, headers, sector mappings, categories
  data/tenders.db SQLite database file
  requirements.txt Python dependencies

frontend/
  src/
    App.tsx       Router and app shell
    pages/        Overview, tender list, and stats pages
    components/   Navbar, filters, table, pagination
    lib/         API client and TypeScript types
  package.json    Frontend scripts and dependencies
  vite.config.ts  Vite configuration
```

## Backend Overview

The backend is a FastAPI application that exposes a small JSON API and manages the local SQLite cache.

At startup, the app initializes the database schema via `init_db()`.

### Main data flow

- `scraper.py` fetches the public portal HTML with `httpx`
- `BeautifulSoup` parses the consultation table rows
- each tender is normalized into a stable local record
- records are inserted into SQLite with `INSERT OR IGNORE`
- the frontend reads data from the API rather than scraping directly

### Stored data

The database contains three tables:

- `tenders` for the main consultation records
- `tender_details` for richer detail data when available
- `scrape_log` for scrape history and status tracking

The tender ID is generated from portal identifiers and a hash, which keeps duplicate inserts stable across runs.

## Frontend Overview

The frontend is a React app built with Vite and TypeScript.

It has three main views:

- `/` - overview dashboard with active counts and sector links
- `/tenders` - searchable, filterable table of consultations
- `/stats` - distribution and top-entity summaries

The UI uses `daisyUI` on top of Tailwind CSS, with `lucide-react` icons for controls and navigation.

## API Endpoints

### `GET /api/tenders`

Returns paginated tender results.

Supported query parameters:

- `q` keyword search across title, reference, and entity
- `category` one of `Travaux`, `Fournitures`, `Services`
- `sector` sector code such as `1.12`
- `entity` entity name filter
- `location` location/province filter
- `status` tender status, typically `en_cours` or `cloture`
- `sort` one of `deadline`, `publication_date`, `title`, `entity`, `location`, `scraped_at`
- `order` `asc` or `desc`
- `page` page number
- `per_page` items per page, capped at 100

### `GET /api/tenders/{tender_id}`

Returns a single tender and any stored detail record.

### `GET /api/overview`

Fetches live counts from the portal homepage for a quick sector summary.

### `GET /api/stats`

Returns aggregate counts for:

- total imported consultations
- counts by category
- top sectors
- top entities

### `GET /api/filters`

Returns distinct categories, sectors, entities, and locations for the frontend filter bar.

### `POST /api/scrape`

Triggers a full scrape across all configured sectors and stores the results locally.

### `GET /api/scrape/status`

Returns the latest scrape log entries.

## Setup

You need:

- Python 3.11+ recommended
- Node.js 20+ recommended

## Backend Setup

From the `backend/` directory:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The backend uses `backend/data/tenders.db` by default. The database file is created automatically if it does not exist.

## Frontend Setup

From the `frontend/` directory:

```bash
npm install
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:8000`, so with both services running locally the frontend can call the backend without extra configuration. The backend also allows common local frontend origins through CORS.

## Running Locally

A typical local setup is:

1. start the FastAPI backend on port `8000`
2. start the Vite frontend on port `5173`
3. open the frontend in your browser
4. click **Importer les données** on the overview page to populate the local database

## Implementation Notes

- Sector codes and category mappings live in `backend/config.py`
- The scraper is tuned to the portal’s current HTML structure, so changes on the upstream site may require parser updates
- Search and filters are backed by SQLite queries, so performance depends on the size of the imported dataset
- The frontend relies on the API’s paginated responses and does not maintain its own state store

## Common Commands

Backend:

```bash
uvicorn main:app --reload
```

Frontend:

```bash
npm run dev
npm run build
npm run lint
```

## Notes on Data Freshness

The local database is only as current as the last successful scrape.

If the overview or table looks empty, run a scrape from the homepage or call `POST /api/scrape` directly.

## License

No license file is present in this repository. Add one if you plan to distribute or reuse the project.
