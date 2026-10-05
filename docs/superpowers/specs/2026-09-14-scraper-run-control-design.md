# Scraper Run Control Design

## Purpose

Operators need tighter control over scraping and DCE cache runs. The immediate risk is the DCE cache warm run: a single call can attempt too many live DCE downloads and may contribute to memory leak notifications or portal push-back. The product also needs a phone-friendly admin experience so operators can start, pause, resume, or cancel runs from mobile without depending on a desktop table view.

This design uses a hybrid path: ship a hard DCE cache safety cap now, while shaping the backend and admin UI toward a broader scraper control center.

## Scope

In scope:

- Cap each manual DCE cache run at 30 live DCE retrieval attempts by default.
- Count only live DCE download attempts toward the cap, not already-cached tenders or tenders skipped because no DCE URL exists.
- Stop cleanly when the cap is reached and write the stop reason into the run log.
- Show cap, live progress, and terminal stop reason in the admin DCE cache page.
- Improve mobile operator control for scrape and DCE pages with compact, easy-to-reach run controls and readable live status.
- Preserve pause, resume, cancel, disk-cap, cache-size-cap, and portal-backoff behavior.

Out of scope for this first implementation:

- Building native iOS or Android apps.
- Changing the public tender catalog.
- Changing scheduled import frequency.
- Bypassing source-site rate limits, CAPTCHA, authentication, or access controls.
- Adding new external scraping targets.

## Behavioral Contract

The backend must treat the DCE cache run limit as authoritative. UI text is informative only; the cap must hold even if the endpoint is called directly.

Default manual DCE cache behavior:

- Start at the existing configured concurrency.
- Skip already-cached tenders without consuming the retrieval cap.
- Fetch tender details as needed to discover `dce_url`.
- Increment `retrievals_attempted` immediately before calling `download_dce`.
- Stop pulling new work once `retrievals_attempted` reaches 30.
- Let any already in-flight workers drain cleanly.
- Finish with a clear terminal message: `Run limit reached: 30 retrievals`.

If another stop condition happens first, the existing reason wins:

- Cache byte cap reached.
- Low disk space.
- Operator cancellation.
- Portal push-back at minimum concurrency.
- Unexpected failure.

The run result should expose:

- `retrieval_limit`
- `retrievals_attempted`
- `cached`
- `skipped`
- `failed`
- `pauses`
- `concurrency`
- `status`
- `error` or stop reason

## Architecture

Add run-limit awareness to `backend/dce_cache.py` rather than only to the admin route. This keeps the safety rule close to the worker queue and protects scheduled, manual, and future callers equally.

Recommended function shape:

```python
async def cache_all_dces(
    actor_email: str | None = None,
    retrieval_limit: int | None = DCE_CACHE_RUN_RETRIEVAL_LIMIT,
) -> dict:
    ...
```

`DCE_CACHE_RUN_RETRIEVAL_LIMIT` should live in `config.py` and default to `30`, with an environment override for operations. The admin endpoint can later accept explicit run profiles, but should use the default cap for now.

The worker sweep should share a protected counter so concurrent workers do not exceed the cap. The check and increment must happen under the same lock:

- If the counter is already at the limit, set `stop["reason"] = "limit"` and return.
- Otherwise increment the counter, update live progress, and call `download_dce`.

This may allow already-started downloads to complete after the cap is reached, but it must not start more than 30 live retrieval attempts.

## Data Model

Add columns to `dce_cache_log`:

- `retrieval_limit INTEGER`
- `retrievals_attempted INTEGER DEFAULT 0`

Use the existing migration helper in `backend/database.py` so old databases upgrade in place.

No new table is required yet. A future run-profile table can be introduced once there are multiple tunable profiles across import, detail, DCE cache, and extraction stages.

## Admin API

`GET /api/admin/dce-cache` should return the current cap and latest run counters. Existing clients must continue to work.

`POST /api/admin/dce-cache` should start a capped run using the configured default. It does not need a request body in this iteration.

Possible future extension:

```json
{
  "profile": "dce_batch",
  "retrieval_limit": 30
}
```

That body is intentionally deferred until operators need multiple profiles.

## Admin UI

Desktop:

- Keep the existing DCE cache page structure.
- Add a concise run-limit line near the run button: `Max 30 live retrievals per run`.
- Add live progress while active: `12 / 30 retrievals attempted`, plus cached, skipped, failed.
- Show the stop reason in run history when present.

Mobile:

- Make the run control cluster wrap cleanly and stay thumb-friendly.
- Prioritize a compact live status block above history tables.
- Avoid requiring horizontal table scanning to understand whether a run is active, paused, stopped, or capped.
- Keep pause, resume, and cancel visible whenever a run is active.

The same backend run state powers desktop and mobile. Mobile gets a better presentation, not a separate operational path.

## Scrape Control Center Direction

This iteration should not overbuild, but the concepts should line up with a future control center:

- A run has a profile, limits, counters, state, and terminal reason.
- Controls are cooperative: pause, resume, cancel.
- Progress is readable from desktop and mobile.
- Backend safety limits are enforced even if the UI is bypassed.

Future profiles can include:

- `import_full`: existing full sector import.
- `import_mobile_safe`: fewer sectors or smaller batches for phone-triggered checks.
- `dce_batch`: capped DCE cache run.
- `detail_refresh_batch`: limited tender-detail refresh.

## Error Handling

- A cap stop is not a failure. Use `status = "stopped"` with a clear reason.
- Portal push-back remains a controlled stop/backoff path.
- Operator cancellation remains `status = "stopped"`.
- Unexpected exceptions remain `status = "failed"`.
- Failed per-tender downloads continue to record failed cache rows as they do today.

## Testing

Backend tests:

- A DCE cache run with more than 30 eligible tenders attempts exactly 30 live downloads.
- Already-cached tenders do not consume the retrieval limit.
- Tenders with no DCE URL do not consume the retrieval limit.
- The run log stores `retrieval_limit`, `retrievals_attempted`, and the cap stop reason.
- Existing portal flag/backoff, disk stop, byte-cap stop, and cancellation tests still pass.

Frontend tests:

- DCE cache page renders the run limit and live retrieval progress.
- Active mobile-sized layout shows run status and controls without relying on the history table.
- Run history displays terminal stop reason when present.

## Acceptance Criteria

- Manual DCE cache runs cannot start more than 30 live DCE retrieval attempts by default.
- Operators can see the cap and live retrieval progress in admin.
- A capped run ends cleanly with an understandable stop reason.
- Desktop admin remains usable.
- Mobile admin does not hide or bury active pause/resume/cancel controls.
- Existing scraper, DCE cache, and DCE extraction controls continue to work.
