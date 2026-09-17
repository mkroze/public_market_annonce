# Editable Cron Jobs & Generalized Scheduler — Design Spec

> Date: 2026-09-15. Status: **implemented** (backend + admin "Cron jobs" tab).

## Problem

The app had exactly one scheduled job — a hardcoded in-process loop
(`main.daily_scheduler`) that ran scrape+digest once a day at `DIGEST_HOUR`. The
hour was an env var read once at startup (not editable without a redeploy), and
**DCE cache** / **DCE extraction** had no schedule at all — they only ran when an
admin clicked "Run". With DCE cache capped at `DCE_WARM_MAX_DOWNLOADS=30` per run,
coverage (~20% on prod) stayed stuck unless someone clicked repeatedly.

## Solution

A persisted, admin-editable job registry driving a generalized scheduler.

### Data — `job_schedules` table (additive)
One row per job (`scrape_digest`, `dce_cache`, `dce_extraction`):
`enabled`, `schedule_kind` (`daily` @ `hour` · or `interval` every `interval_minutes`),
`last_run_at`, `last_status`, `updated_at/by`. Seeded (idempotent) so
**scrape_digest = daily @ DIGEST_HOUR, enabled** (no behavior change), and
`dce_cache` / `dce_extraction` = interval, **disabled** until an admin turns them on.

### Scheduler — `backend/scheduler.py`
- Pure, unit-tested `is_due(row, now)` and `compute_next_run(row, now)` (Africa/
  Casablanca). Daily fires once on the first tick inside the target hour; interval
  fires when `now - last_run_at >= interval`.
- `run_job(job, actor_email, base_url)` dispatches to the existing run coroutines
  (`run_scrape_and_digest`, `cache_all_dces`, `extract_all_dces`), guarded by the
  existing per-stage locks so a scheduled run never overlaps a manual one; it
  stamps `last_run_at`/`last_status` (running → ok/failed).
- `job_scheduler_loop()` ticks every `TICK_SECONDS` (60s), reads the table live,
  and fires every due+enabled job. Replaces `daily_scheduler` in the app lifespan.

### API (admin.py, surface already allowlisted under `/api/admin/`)
- `GET /api/admin/cron` — jobs + computed `next_run_at` + live `running` flag (`imports.view`).
- `PATCH /api/admin/cron/{job}` — edit enabled/kind/hour/interval; validated; audit `cron.update` (`imports.run`).
- `POST /api/admin/cron/{job}/run` — run now; 409 if busy/unrunnable; audit `cron.run` (`imports.run`).

### Frontend — "Cron jobs" tab (Data pipeline nav group)
`CronJobs.tsx`: one card per job — enable toggle, schedule editor (daily hour /
interval minutes), Save, Run-now, running badge, last/next run + status. Read-only
without `imports.run`.

## Operational notes
- **In-process scheduler, single instance.** Like the previous `daily_scheduler`,
  the loop runs in the web process; if the service is scaled to >1 instance each
  would tick, so keep the backend single-instance (or move to an external trigger
  later). Documented, not guarded.
- **DCE extraction scheduling** needs `PUBLIC_BASE_URL` (the OCR box fetches the
  signed ZIP from us); `run_job` no-ops for it when unset.
- **Coverage lever:** enable `dce_cache` as `interval` (e.g. every 30 min). Each
  run stays capped at 30 downloads (memory safety), so the cache warms
  progressively across many small runs instead of one risky large sweep.

## Testing
- `test_scheduler.py` (19): due-logic, next-run projection, validation, seeding, persistence.
- `test_admin.py` `CronApiTest` (7): list, update+audit, bad-value 422, unknown 404,
  run-now started+audit, busy 409, permission gate.
- Full backend suite: **312 green**. Frontend vitest green.
