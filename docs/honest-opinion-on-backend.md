# Honest opinion on the backend compared with the admin UI

Audit date: 18 October 2026.

## My verdict

**The admin has a clearer product structure than the backend has an execution structure.** The UI describes an understandable tender lifecycle: collect notices, cache dossiers, extract fiches, then eventually generate videos, retrieve awards, and run campaigns. The backend contains useful implementations of several pieces, but its boundaries, state tracking, and data refresh behavior do not consistently support that story.

This is a credible application that has grown through successive features. It deserves a focused restructuring. I would keep the working domain modules and the monolith, fix the operational inconsistencies, and progressively remove business logic from the two large HTTP modules.

My biggest concern is whether an operator can trust what the admin says. Folder cleanup alone will not solve that. A tidy directory containing the same inconsistent state and incomplete refresh behavior would still have the same weaknesses.

## Scope and evidence

I reviewed the current working tree, including the ongoing admin changes already present when this audit started. The comparison follows the actual routing, API calls, components, and backend implementation. It does not assume that older design documents describe the current application.

This is a source-level architecture and behavior audit. I did not inspect the rendered admin in a browser, exercise production services, call the procurement portal or n8n, or verify deployment settings. Statements about the UI concern its implemented navigation and behavior, rather than a visual or accessibility certification.

Verification used temporary directories and databases, with mocked external work:

| Backend test module | Result |
| --- | --- |
| `test_admin` | 77 passed |
| `test_scheduler` | 29 passed |
| `test_dce_extraction` | 18 passed |
| `test_website_costs` | 13 passed |
| **Total** | **137 passed** |

Each module ran in its own process using `backend/.venv/bin/python` and Python's unittest loader. This was a targeted check, not the complete backend or frontend suite. Three additional temporary probes reproduced the refresh and status problems described below. No application implementation was changed for this audit.

## What the current structure tells me

The backend has 24 top-level production Python modules, approximately 9,252 lines, and 22 top-level test modules, approximately 5,496 lines. Two files account for about 44% of production Python:

| File | Lines | Actual responsibilities |
| --- | ---: | --- |
| `backend/main.py` | 2,227 | Application startup, middleware, authentication dependencies, public/member routes, scraping orchestration, statistics/directories, exports, assistant, extraction callback, static content, SPA serving |
| `backend/admin.py` | 1,887 | Permissions, authentication dependency, audit persistence, bootstrap, statistics jobs, tender moderation, workflow aggregation, launchers, users, settings, costs routes |
| `backend/database.py` | 376 | Connection setup, all schema creation, incremental schema changes, deadline backfill |
| Other domain modules | Varies | Scraping, caching, extraction storage/dispatch, eligibility, email, expenses, parsing, display normalization |

A flat folder is reasonable for a small Python service. The problem here is that filenames no longer predict ownership reliably. A scheduled statistics job lives in `admin.py`; the scheduler imports it from that HTTP module. Digest logic imports location normalization from `main.py`. Admin authentication imports the current-user dependency from `main.py`.

The code already has the beginnings of good boundaries. They have not yet become a consistent rule.

## How the admin maps to the backend

| Admin area | Current implementation | My assessment |
| --- | --- | --- |
| Dashboard and activity journal | `/overview`, `/workflows`, `/workflows/events`, three separate stage status endpoints | Useful aggregation, but inconsistent status sources and multiple independently loaded snapshots |
| Collecte HTML: Controls / Data / Logs | `main.run_scrape_and_digest`, `scraper.py`, tender queries/moderation in `admin.py`, `scrape_log` | Real collection and moderation, but existing notices are not refreshed by the sweep |
| Dossiers ZIP: Controls / Data / Logs | `dce_cache.py`, admin launch/control endpoints, `dce_cache_log` | Substantial implementation; Data currently shows aggregate capacity rather than an inspectable file inventory |
| Fiches universelles: Controls / Data / Logs | `dce_extraction.py`, n8n dispatch, callback in `main.py`, extraction tables | Submission and storage exist; external execution is not tracked as a complete per-tender lifecycle |
| Video generation | Planned route/view | Correctly presented as planned; no implemented renderer was identified |
| Résultats & attributions | Planned route/view, `award_parser.py`, separate scraping probe | Parser groundwork exists; there is no integrated admin awards workflow |
| Campagnes | Planned route/view; separate existing alert digest code | Existing tender alerts do not implement the proposed award-result campaigns |
| Users / roles | Routes and policy in `admin.py`, shared `eligibility.py` | Useful shared domain logic; routing, authorization, and persistence remain tightly combined |
| Costs | Routes in `admin.py`, validation and operations in `website_costs.py` | One of the better examples of a coherent domain boundary |
| Settings | Routes in `admin.py`, `settings.py`, `emailer.py` | Recognizable separation, with room to extract the HTTP layer |

Evidence: `frontend/src/admin/AdminApp.tsx`, `stages/registry.ts`, `pages/Dashboard.tsx`, `pages/WorkflowJournal.tsx`, the three stage view modules, and `backend/admin.py`.

The UI's lifecycle arrows communicate an intended progression. The backend currently runs independent sweeps on editable schedules. Sorting due jobs in `scheduler.tick()` does not create a dependency chain: `run_job()` starts background tasks and returns. There is no durable record connecting a specific tender's collection, ZIP version, extraction attempt, and eventual downstream output.

That distinction should remain explicit until orchestration exists.

## Findings, ordered by importance

### 1. High: collection does not deliver the catalog refresh the UI describes

`backend/scraper.py:429` uses `INSERT OR IGNORE` for notices. When an already-known tender changes at the source, this sweep leaves its stored title, deadline, and other source fields untouched. It also does not populate `deadline_date`, `source_last_seen_at`, or `last_seen_import_id`, despite those columns existing.

**Reproduced:** I ran the real sweep twice against a temporary database with a mocked sector response. The second response changed the title and deadline. The database retained the original values; all three lifecycle fields remained null.

This is more serious than a directory problem. The admin can show successful imports while existing procurement information becomes stale. The `tenders_updated` and `tenders_skipped` counters exist in the schema and response types but are not maintained by this sweep.

There is a related inconsistency: `database.init_db()` backfills normalized deadlines at startup, while admin current/expired counts and expired cleanup use `deadline_date`. Newly scraped records can therefore be treated differently before that backfill runs again.

**Recommendation:** implement a source-field upsert that preserves moderation decisions, normalizes deadlines during ingestion, records last-seen metadata, and reports actual new/updated/unchanged/error outcomes. Make this a priority before adding more lifecycle stages.

### 2. High: job status has multiple sources of truth

`backend/admin.py:1199` calculates extraction `active` from the latest persisted log row. `/workflows` calculates it from the in-memory control object. Imports and ZIP caching use their respective locks.

**Reproduced:** with a persisted extraction row marked `running` and no live extraction worker, `/dce-extraction/status` reported `active: true`, while the extraction entry returned by `/workflows` reported `active: false`.

This is a realistic restart state because progress and control flags are process-local and startup does not reconcile unfinished run rows. The stage shell, Controls view, and dashboard can disagree about the same operation.

**Recommendation:** define one authoritative run record and status projection. Reconcile abandoned runs on startup. For more than one process, add ownership and expiring leases rather than relying on local locks to describe global activity.

### 3. High: the scheduler can label an unsuccessful job successful

`backend/scheduler.py:270` sets `last_status="ok"` whenever the awaited coroutine returns without raising. Extraction catches exceptions internally and returns a result containing `status="failed"`; cancellation can return `status="stopped"`. Those results are ignored by the supervisor.

**Reproduced:** a job returning `{"status": "failed", "failed": 3}` caused `_supervise()` to write `last_status="ok"`.

Manual launches also use separate launcher functions in `admin.py`, rather than the scheduler's common launch path. Their schedule bookkeeping and error handling can diverge from scheduled launches.

**Recommendation:** give jobs a shared outcome contract and one launch service used by both manual and automatic triggers. Distinguish succeeded, partial, failed, and cancelled outcomes. Return the created run ID when accepting a launch.

### 4. High: extraction tracks dispatch completion, with limited knowledge of the resulting work

`backend/dce_extraction.py:135` finishes its sweep after submitting eligible archives. Successful HTTP submission increments `enqueued`. It does not establish that OCR, redaction, or analysis finished successfully.

The UI does explain this in its confirmation text, which is good. The backend still lacks the durable attempt records needed to answer: which tenders are waiting, which submission timed out, which callback belongs to which run, and which results correspond to the current archive?

The outbound payload contains `tender_id` and `zip_url`, without a run/attempt ID or explicit archive hash. The callback accepts a hash but does not verify it against the current archive or an expected attempt. Storage replaces the existing result for that tender. A late callback can therefore overwrite a newer result. `_already_extracted()` checks hash equality without checking successful extraction status, so a failed result with the matching hash is also treated as already extracted.

The extraction Data view polls only while the submission sweep is active. Results arriving after dispatch finishes may require navigating away and back to become visible.

**Recommendation:** persist per-tender attempts with archive hash, correlation ID, dispatch state, completion state, timeout, and retry metadata. Validate callbacks against those attempts and expose pending external work separately from an active dispatch sweep.

### 5. High: simulation writes sample information into the real result path

`backend/admin.py:1308` selects a real tender and calls the normal `store_extraction()` function using a fabricated payload. That function uses `INSERT OR REPLACE` in `dce_extraction` and writes the regular recap file.

The payload identifies its model as `simulation` and its hash as `SIMULATED`, but its status is `ok`. The extracted count includes it, the recent-results projection omits the model, and the normal authenticated tender extraction endpoint returns it. An existing result can be replaced while the webhook is unconfigured.

**Recommendation:** make simulation a preview or store it separately. Exclude sample results from production counts and member responses. A missing integration URL should not be the sole condition allowing fabricated data into live storage.

### 6. Medium-high: the apparent pipeline is tied to one web process

`main.lifespan()` starts the scheduler inside the API process. Manual launchers and scheduler launches use `asyncio.create_task()`. `PipelineControl` flags and locks are in memory. The supplied Docker command runs one Uvicorn process, which is consistent with that design today.

The limitation matters as this admin becomes an operations console. A process restart interrupts background work. Adding web workers or replicas would create additional scheduler loops and separate control objects, without a shared atomic job claim. A request handled by another worker could see different activity or fail to control the intended task.

Extraction launch also lacks the explicit busy rejection used by the other stage launch endpoints: repeated requests can queue sweeps behind its lock while each response says `started`.

**Recommendation:** first add persistent runs, explicit admission rules, task ownership, and recovery. Retaining a single worker is a reasonable near-term constraint. Move execution to a dedicated worker when durability or deployment scale requires it; introducing several new infrastructure systems now would obscure the immediate fixes.

### 7. Medium: the admin journal is a useful projection, not complete execution history

`backend/admin.py:869` limits each event source to 500 rows before merging and applying workflow, origin, and status filters. The UI discloses the recent-source limitation, which is honest, but filtering can still miss matching older entries inside a busy source.

Tender-count computation has a latest snapshot in `/workflows`, but its runs are not added to `/workflows/events`. Scraping records its completion before `run_digest()` executes, so the journal's scrape run does not describe the complete scrape-plus-email outcome suggested by the workflow name.

**Recommendation:** preserve the distinction between operator audit events and execution records, but connect them with stable run IDs. Query a normalized event projection with filtering before pagination, and show digest delivery outcomes separately or as child work of the import run.

### 8. Medium: dependency direction makes ordinary changes unnecessarily expensive

Lazy imports prevent import-time cycles, but leave the underlying dependency cycles intact:

- `main.py` imports `admin.py`; the admin authorization dependency imports `main.get_current_user`.
- The scheduler imports launch logic from `main.py` and a statistics job from `admin.py`.
- `digest.py` imports `main.normalize_location`.
- Permission policy, audit persistence, job launchers, SQL, and HTTP handlers share `admin.py`.

**Recommendation:** move authentication dependencies, permission policy, audit persistence, location normalization, statistics, and job launching into modules that do not depend on HTTP routers. Make `main.py` the application composition point and keep routers focused on request/response behavior.

I would organize around domains and execution responsibilities. Reproducing each admin tab as a backend package would create artificial boundaries: Controls, Data, and Logs are three views of the same domain.

### 9. Medium: contracts and lifecycle rules are duplicated

An AST inspection found 40 decorated admin routes and 48 decorated app routes, with no explicit `response_model` declarations on those decorators. The backend does validate many request bodies, but response shapes remain largely handwritten dictionaries alongside independently maintained TypeScript interfaces.

The role matrix is manually mirrored in `frontend/src/admin/permissions.ts`. Stage/job identities are spread across the frontend registry, dashboard diagram, backend workflow mappings, scheduler mappings, and control objects. The current dashboard diagram hardcodes stages despite the registry comment describing it as a shared source of truth.

Lifecycle consolidation is also incomplete: `tender_lifecycle.py` supplies validated normalization helpers, but DCE cache expiry still uses its own substring-based date SQL in `_STALE_TENDER_IDS`.

A concrete validation weakness is cache clearing: an invalid `mode` silently becomes `all` in `admin_clear_dce_cache()`. A typo should fail validation, not select the broader deletion operation.

**Recommendation:** add typed response models for the shared operational API first; derive TypeScript contracts from the API schema; expose stage capabilities and current-user permissions from backend policy; use the shared lifecycle functions consistently. Reject unknown action values.

### 10. Medium: some Data views expose summaries rather than operational inspection

The three-tab stage shell is a good UI pattern, but backend data capabilities are uneven:

- Collection Data has a paginated tender catalog and moderation actions.
- ZIP Data shows aggregate count, storage use, and capacity. It does not list individual archives, missing files, or failed tender downloads.
- Extraction Data shows only the latest ten results and a count. It has no paginated admin inspection of full fiches, source evidence, error details, or retryable attempts.

The user list similarly returns all matching users and calculates classification for each one without pagination (`admin_users()`). That is manageable at small scale, but becomes an avoidable cost as the list grows.

**Recommendation:** add filtered, paginated domain data endpoints. The admin should help an operator identify and resolve the exact tender that failed, rather than only launch another full sweep.

## What I would preserve

There is enough solid work here to make incremental improvement worthwhile:

- **Server-enforced permissions.** `require_admin()` checks roles, suspension, and permissions; the UI is not the security boundary. Denials are audited.
- **Existing audit records.** Actor attribution and before/after data provide a useful governance foundation.
- **Domain modules with meaningful work.** `eligibility.py`, `website_costs.py`, `tender_display.py`, `tokens.py`, and the cache/extraction modules show that separation is already practical here.
- **Cache operational safeguards.** Storage budgets, free-space limits, bounded download batches, backoff, and cooperative controls reflect actual operating concerns.
- **Explicit planned states.** The admin does not pretend videos, integrated awards retrieval, or campaigns are available. The award parser and fixtures are useful groundwork without constituting the full stage.
- **Tests.** The targeted suite passed and covers real access control, API, storage, and scheduling behavior. The reproduced gaps show where to extend it, rather than justify discarding it.

`website_costs.py` is a useful local example: validated input and domain operations live outside the admin handlers, while handlers own access checks and auditing. It still combines business operations with SQL, but it is a practical improvement over putting everything inside the router.

## A backend structure I would aim for

This is a suggested destination, not a requirement to create every directory immediately:

```text
backend/
  app/
    main.py                   # app factory/composition, middleware, lifespan
    core/
      config.py
      database.py             # connections and transaction boundaries
      auth.py                 # token/password logic and user dependencies
      permissions.py
      audit.py
    api/
      public/                 # catalog, directories, auth entry points
      member/                 # profile, favorites, alerts, saved searches
      admin/                  # thin domain routers
      integrations/           # archive access and extraction callbacks
    domains/
      tenders/                # ingestion, moderation, lifecycle, normalization
      documents/              # archive storage and cache operations
      extraction/             # attempts, callbacks, results and provenance
      users/                  # profiles and eligibility
      notifications/          # delivery and digest behavior
      costs/
      awards/                 # parser now; retrieval workflow when implemented
    jobs/
      registry.py             # supported jobs and capabilities
      runner.py               # common manual/scheduled launch and outcomes
      scheduler.py
      control.py
    schemas/                  # shared API contracts where useful
  migrations/                 # ordered, recorded schema changes
  tests/
    unit/
    integration/
    fixtures/
  requirements.txt
```

Use repositories where shared queries or transaction ownership justify them. A mandatory repository/service/schema stack for every small function would add ceremony. Keep SQLite while workload and deployment constraints support it. Its presence is not the architectural defect; unclear ownership of connections, commits, migrations, and execution state is.

Today `database.init_db()` performs schema changes and data normalization during startup without a versioned migration history. `get_db()` does not explicitly enable SQLite foreign-key enforcement even though the schema declares references. Introduce recorded migrations and deliberate connection settings before schema evolution and concurrent background writes become harder to reason about.

## What I would do first

| Order | Work | Acceptance condition |
| --- | --- | --- |
| 1 | Fix ingestion refresh and lifecycle writes | A changed source notice updates source fields, preserves moderation, and immediately appears in the correct deadline filters and counts |
| 2 | Unify run status and outcomes | Dashboard, stage view, and scheduler agree; failed and cancelled jobs retain their outcome; unfinished work is reconciled after restart |
| 3 | Isolate simulation and correlate extraction attempts | Sample data cannot replace real results; stale callbacks cannot replace newer output; pending external work is visible |
| 4 | Extract common dependencies and domain routers | Scheduler and domain modules no longer import business dependencies from `main.py` or `admin.py` |
| 5 | Strengthen contracts, inventories, and history | Typed operational responses; paginated ZIP/extraction/user inspection; reliable filtered execution history |
| 6 | Separate workers when needed | Atomic job ownership and shared control work across the chosen execution/deployment model |

Add regression tests for the reproduced problems before changing their implementation. Then cover out-of-order callbacks, failed-result retries, rapid repeated launches, delayed extraction completion, and journal filtering beyond the source cap. Existing happy-path tests are valuable, but these are the scenarios that determine whether the admin can be trusted during an incident.

## Final assessment

The admin's lifecycle organization is a useful direction for the product. The backend has enough functioning pieces to support it, but currently behaves more like a collection of feature-specific jobs than a coherent lifecycle system.

**I would pause expansion of the pipeline long enough to make collection, run status, and extraction provenance dependable.** Then restructure the code around those responsibilities. That will improve the admin more than moving files into attractive folders while leaving the underlying behavior unchanged.
