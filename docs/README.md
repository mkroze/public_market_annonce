# Marchés Publics Maroc

**Find relevant public tenders in Morocco, follow their deadlines, and prepare a candidacy with the right context.**

Marchés Publics Maroc is a French-language web application that collects consultation notices from [Morocco’s public procurement portal](https://www.marchespublics.gov.ma), organizes them into a searchable catalog, and gives businesses tools to track opportunities. It includes a member workspace, procurement guidance, and an admin console for operating the data pipeline.

Official buyer publications remain the authoritative source. Catalog data and preparation tools help users navigate the process; they do not guarantee completeness or eligibility.

[Quick start](#quick-start) · [First import](#populate-the-catalog) · [Configuration](#configuration) · [Docker](#run-with-docker) · [Development](#development-and-checks) · [Project map](#project-map)

## What’s inside

| Area | Capabilities |
| --- | --- |
| Public catalog | Tender search and filters, detailed notices, cities, regions, sectors, and aggregate statistics. |
| Member workspace | Favorites, saved searches, email alerts, account settings, and a company profile with eligibility and classification tools. |
| Candidacy preparation | Procedure guides, administrative checklists, eligibility guidance, remedies information, and an optional Claude-powered legal assistant. |
| Documents | Tender PDF exports and cached DCE ZIP downloads. **DCE** means *dossier de consultation des entreprises*, the tender’s consultation documents. |
| Administration | User roles and permissions, tender management, import controls, DCE caching and extraction, editable schedules, audit history, and website cost tracking. |

The public catalog and aggregate directories are available without signing in. Member data, exports, document actions, and the assistant require authentication. Admin operations additionally require the appropriate role permissions.

## How it fits together

```text
Official procurement portal
          │
          ▼
  Python scraper ──────► SQLite + DCE ZIP cache
                              ▲
                              │
                      FastAPI backend ◄────► SMTP / Claude (optional)
                              ▲
                              │ /api
                        React frontend

Optional document extraction:
  Backend ── signed ZIP URL ──► n8n / external OCR and extraction
          ◄── authenticated callback with structured results
```

- **Frontend:** React 19, TypeScript, Vite, React Router, Tailwind CSS 4, daisyUI, and Leaflet.
- **Backend:** Python, FastAPI, aiosqlite, HTTPX, Beautiful Soup, and ReportLab.
- **Storage:** SQLite for application data; local files for cached DCE archives and extraction recaps.
- **Jobs:** An in-process scheduler with schedules persisted in SQLite and editable from the admin interface.
- **Deployment:** A multi-stage Docker image builds the frontend and serves it alongside the API through FastAPI.

## Quick start

### Prerequisites

- **Python 3.12** — matches the Docker runtime.
- **Node.js 22.13+ on the 22.x line**, or Node.js 24+, with npm — compatible with the frontend dependency requirements.
- Network access to the official portal when importing tenders or fetching documents.

The commands below use a macOS/Linux shell and start from the repository root.

### 1. Install dependencies

```bash
python3.12 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
npm --prefix frontend ci
```

Use `backend/.venv` as shown: the root development scripts reference that exact path. There are no root npm dependencies to install.

### 2. Configure your environment

```bash
cp .env.example .env
python3.12 -c 'import secrets; print(secrets.token_hex(32))'
```

If `.env` already exists, edit it rather than copying over it. Paste the generated value into `SECRET_KEY` and set these values in `.env`:

```dotenv
SECRET_KEY=replace-with-the-generated-value
FRONTEND_URL=http://localhost:5173
ADMIN_EMAILS=you@example.com
```

Use an email address you control for `ADMIN_EMAILS`; an account registered with that address receives the `owner` role. For local development without email delivery, leave the `SMTP_*` credentials empty instead of keeping the sample credentials. SMTP, Claude, and the external extraction service are optional for catalog development.

### 3. Start the app

```bash
npm run dev
```

This starts both the API and Vite. Stop them with **Ctrl+C**.

| Service | Local URL |
| --- | --- |
| Web application | <http://localhost:5173> |
| Tender catalog | <http://localhost:5173/tenders> |
| Admin console | <http://localhost:5173/admin> |
| API / Swagger UI | <http://localhost:8000/docs> |
| OpenAPI schema | <http://localhost:8000/openapi.json> |

Vite proxies `/api` requests to port `8000`. The backend loads the root `.env` through `python-dotenv` before importing its configuration.

To run the services in separate terminals, use `npm run dev:backend` and `npm run dev:frontend` from the repository root.

### Populate the catalog

A fresh database starts without tender records. Startup creates the schema and seeds job schedules; it does not unconditionally import the catalog.

1. Register at `/register` using the address listed in `ADMIN_EMAILS`.
2. Open `/admin/scrape` and start an import from the controls view.
3. Follow progress and results at `/admin/scrape/logs` and `/admin/scrape/data`.
4. Open `/tenders` to browse the imported notices.

Allow time for the import to contact the portal across sectors. Tender details can also be fetched when needed. DCE caching is operated separately at `/admin/dce-cache`.

Accounts matching `ADMIN_EMAILS` are promoted during registration. Existing ordinary accounts on the allowlist are promoted on the next backend startup. There is no default admin password.

## Configuration

See [`.env.example`](.env.example) for the starter configuration, [`backend/mpm/core/config.py`](backend/mpm/core/config.py) for document-pipeline options, and [`backend/mpm/db/settings.py`](backend/mpm/db/settings.py) for email setting precedence. Environment changes require a backend restart.

| Variable | Default / behavior |
| --- | --- |
| `SECRET_KEY` | Session-signing secret. Without a value, a random secret is generated at each process start, invalidating existing sessions on restart. Set a stable value for deployment. |
| `FRONTEND_URL` | `http://localhost:5173`; base URL used in verification, password-reset, and alert emails. |
| `ADMIN_EMAILS` | Empty; comma-separated email allowlist for owner bootstrap. |
| `DIGEST_HOUR` | `7`; initial daily scrape-and-digest hour in **Africa/Casablanca** time. Stored schedules take precedence after seeding. |
| `SMTP_HOST`, `SMTP_PORT` | SMTP relay connection. The example uses Brevo with port `587`. |
| `SMTP_USER`, `SMTP_PASSWORD` | Relay credentials. Use the provider’s SMTP key where applicable. |
| `SMTP_FROM`, `SMTP_FROM_NAME` | Sender address and optional display name. |
| `ANTHROPIC_API_KEY` | Empty; required to use the legal-assistant API. Without it, that endpoint returns `503`. |
| `PUBLIC_BASE_URL` | Empty; externally reachable **backend** base URL used to build document URLs for scheduled extraction. |
| `N8N_EXTRACT_WEBHOOK_URL` | Empty; webhook that receives extraction requests. |
| `DCE_EXTRACTION_SECRET` | Empty; shared extraction callback secret and signing key for archive URLs. |
| `DCE_EXTRACT_SIGNING_TTL` | `900` seconds; lifetime of signed archive URLs. |
| `DCE_CONTEXT_DIR` | `data/dce_context`; directory for generated extraction recap Markdown. |
| `DCE_CACHE_MAX_BYTES` | `4294967296` (4 GiB); total DCE cache budget. |
| `DCE_WARM_MAX_DOWNLOADS` | `30`; maximum new archives per cache sweep. `0` removes the batch cap. |

Additional cache pacing, concurrency, and backoff options are defined in `backend/mpm/core/config.py`. Cache warming also stops when free disk space falls below 500 MiB.

**Email settings:** Nonempty values stored through the owner’s admin settings override the corresponding environment variables. Automated digests only target verified email addresses. Without SMTP configuration, matching digests are logged instead of sent; verification and password-reset emails cannot be delivered.

**Document extraction:** OCR and extraction run in an external service. This repository provides request dispatch, signed archive access, result storage, and the callback endpoint; it does not bundle an n8n or OCR deployment. Results are posted to `POST /api/dce/extraction-callback` with the `X-Extraction-Secret` header. The external service must be able to reach the backend’s signed archive URL.

### Scheduled jobs

Schedules use **Africa/Casablanca** time and are checked approximately once per minute while the backend is running.

| Job | Initial schedule | Enabled initially |
| --- | --- | --- |
| Scrape + email digest | Daily at `DIGEST_HOUR` | Yes |
| Tender count snapshot | Daily at `DIGEST_HOUR` | Yes |
| DCE cache warming | Every 30 minutes | No |
| DCE extraction | Every 120 minutes | No |
| Outdated DCE cache cleanup | Daily, one hour before `DIGEST_HOUR` | No |

Use the admin dashboard and lifecycle stage controls to inspect or edit schedules. They persist in the `job_schedules` table, so changing `DIGEST_HOUR` later does not overwrite an existing schedule. Scheduled imports can make portal requests and send configured digests, including during local development.

## Run with Docker

From the repository root, with `.env` configured:

```bash
docker build -t marches-publics .
docker run --rm \
  --name marches \
  --env-file .env \
  -p 8000:8000 \
  -v marches-data:/app/data \
  marches-publics
```

Open <http://localhost:8000/tenders>. The API and built frontend share port `8000`; Vite is not needed. The backend currently redirects `/` to `/tenders`.

For local Docker use, set `FRONTEND_URL=http://localhost:8000`. For deployment, use the public site URL. If enabling scheduled extraction, also set `PUBLIC_BASE_URL` to the backend URL reachable by the extraction service.

The named volume retains the database, cached archives, and extraction recaps after the container exits. Stop the container with:

```bash
docker stop marches
```

The root `npm run docker:build` and `npm run docker:run` shortcuts also exist, but **`docker:run` does not pass `.env`**. Use the explicit command above when you need environment configuration.

### Storage and deployment notes

Paths are relative to the backend process’s **working directory**:

| Data | Local development | Docker |
| --- | --- | --- |
| SQLite database | `backend/data/tenders.db` | `/app/data/tenders.db` |
| Cached DCE archives | `backend/data/dce_cache/` | `/app/data/dce_cache/` |
| Extraction recaps | `backend/data/dce_context/` | `/app/data/dce_context/` |

The root scripts start Python from `backend/`, while Docker uses `/app`; both import the backend as the `mpm` package, so the ASGI target is `mpm.api.main:app`. Paths no longer depend on the working directory: `backend/mpm/core/config.py` anchors every path to the backend root and `DATA_DIR` overrides it. Database initialization and incremental schema updates live in `backend/mpm/db/database.py` and run at startup.

Run a **single backend worker/replica** with the current architecture: each process starts a scheduler, and pipeline locks are process-local. Multiple workers can duplicate jobs. Back up the persistent data directory using a consistent SQLite backup or while the app is stopped. It contains user data and may contain SMTP credentials saved through admin settings.

## Development and checks

Run these from the repository root:

```bash
# Backend tests: Python's built-in unittest runner
(cd backend && .venv/bin/python -m unittest discover -s . -p 'test_*.py')

# Frontend tests: one run, without watch mode
npm --prefix frontend test -- --run

# Frontend lint
npm --prefix frontend run lint

# TypeScript checks + production frontend build
npm --prefix frontend run build
```

`npm --prefix frontend test` starts Vitest in watch mode. Backend coverage includes authentication, account settings, tender routes, alerts, eligibility, scraping normalization, DCE caching/extraction, admin permissions, and scheduling. Frontend tests cover catalog interactions, member guidance, and admin workflows.

For API exploration, use `/docs`. Public reads such as `GET /api/tenders` and `GET /api/filters` work without a token. Protected requests use `Authorization: Bearer <token>`, obtained through registration or login. An API middleware allowlist governs the exposed surface; some older handlers in `main.py` are intentionally blocked with `404`.

## Project map

```text
backend/
  main.py                 FastAPI app, API routes, startup, frontend serving
  database.py             SQLite schema and incremental migrations
  scraper.py              Official portal collection and detail/document fetching
  admin.py                Admin API, permissions, audit, pipeline operations
  scheduler.py            Persisted schedules and job dispatch
  pipeline_control.py     Cooperative pipeline pause/resume/cancel state
  dce_cache.py             Archive cache, warming, eviction, cleanup
  dce_extraction.py        External extraction dispatch, storage, recap generation
  dce_signing.py           Signed archive access
  auth.py, tokens.py       Session signing and email action tokens
  digest.py, emailer.py    Alert matching, digests, SMTP delivery
  eligibility.py          Company/tender eligibility evaluation
  legal_context.py        Legal assistant system context
  test_*.py               Backend tests
frontend/
  src/pages/              Public and member pages
  src/admin/              Admin routes, lifecycle stages, permissions, UI
  src/components/         Shared application components
  src/lib/                API client, authentication, domain types and helpers
  src/index.css           Global styles and design tokens
  vite.config.ts          Dev API proxy and Vitest configuration
scraping/                 Separate portal and award-data research probes
scripts/                  UI checks and documentation/demo generation tools
docs/                     Product specs, implementation plans, research
```

### Further reading

- [Admin changes and workflow guide](docs/ym-nouveautes-et-guide-workflows.md)
- [Design specifications](docs/superpowers/specs/) and [implementation plans](docs/superpowers/plans/)
- [Opportunity intelligence specification](docs/mp-maroc-opportunity-intelligence-spec.md)
- [Award-data source research](docs/award-data-source-research.md) and [extraction map](docs/award-data-extraction-map.md)

Specs and plans describe both implemented and proposed work. The running code determines current behavior; later lifecycle stages displayed as planned in the admin console are not operational pipelines yet.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `backend/.venv/bin/python` is missing | Create the environment at `backend/.venv`; the root scripts do not use `backend/venv`. |
| Catalog is empty | Run the first import at `/admin/scrape`; inspect its logs for portal or parsing errors. |
| Admin console is unavailable | Register with an address in `ADMIN_EMAILS`. Restart the backend after adding an existing ordinary account to the allowlist. |
| Users are logged out after a restart | Set a stable, nonempty `SECRET_KEY`. |
| Email links point to localhost | Set `FRONTEND_URL` to the site’s public URL and restart the backend. |
| SMTP changes seem to have no effect | Check admin email settings: stored nonempty values override `.env`. |
| Assistant returns `503` | Configure a valid `ANTHROPIC_API_KEY`; the assistant also depends on access to the model configured in `backend/mpm/api/main.py`. |
| Scheduled extraction cannot fetch archives | Check `PUBLIC_BASE_URL`, webhook reachability, the shared secret, and signed URL expiry. |
| Cache warming stops early | Check the cache budget, 500 MiB free-space guard, download batch cap, and portal backoff events. |
