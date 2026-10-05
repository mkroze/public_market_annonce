# Scraper & DCE-Cache Stabilization — Design Spec

> Date: 2026-09-14. Status: design + first implementation landed (tracemalloc, 30/run cap, périmé cleanup); cron scheduling below is the remaining decision.
> Session 3 — *"Stabilisation du scraper et du cache"*. Goal: **launching a scrape must not restart the service or fire an email**, and the per-run batch must be small enough to stay inside Render's memory budget. Downstream of the DCE cache (`backend/dce_cache.py`) and extraction pipeline ([`2026-09-11-dce-extraction-pipeline-design.md`](2026-09-11-dce-extraction-pipeline-design.md)).

## Context & problem

Two long-running sweeps — the sector scrape (`scraper.scrape_all_sectors`, 45 sectors) and the DCE warm-all (`dce_cache.cache_all_dces`, 4 concurrent downloads) — are launched **in-process** inside the single uvicorn web worker via `asyncio.create_task` (`admin.py: _launch_import`, `_launch_dce_cache`). There is **one** process (`Dockerfile`: `uvicorn main:app`, no `--workers`), so the sweep shares its heap and event loop with every request the site serves.

`download_dce` returns the **entire DCE ZIP in memory** (`(dl_resp.content, filename)`); `_store` writes it to `/app/data`. With 4 workers each holding a multi-MB ZIP, plus BeautifulSoup DOM trees per portal page, a warm-all over thousands of tenders makes resident memory (RSS) climb monotonically. On a memory-limited Render instance this crosses the cap and the container is **OOM-killed → restarted**. The restart re-runs `lifespan` startup, and the operator sees a service-restart / health email — exactly the symptom Session 3 targets. The scrape being in-process also means it competes with request handling.

**Root cause (one sentence):** an unbounded, in-process batch download accumulates large ZIP buffers in the web worker's heap until Render OOM-kills and restarts the container.

## Evidence tooling

`backend/mem_profile.py` — `profile_run(label)` async context manager, gated by env `SCRAPE_MEMORY_PROFILE` (default **off**, zero prod overhead). When enabled it snapshots `tracemalloc` + reads RSS (`/proc/self/statm` on Linux, `ru_maxrss` fallback on macOS) around a run and logs peak traced memory, peak RSS, and the top-N allocation sites to the scrape/pipeline log. It wraps `scrape_all_sectors` and `cache_all_dces`. This is the diagnostic backbone: turn it on for one run to *measure* the RSS growth and confirm the ZIP buffers dominate, before/after the cap.

## Goal

1. A scrape/cache launch **never** OOMs → never restarts → never fires the restart email.
2. Per-run memory stays under a measured, safe budget by **capping downloads to 30/run** and releasing byte buffers promptly.
3. Stale ("périmé") cache folders are pruned so the volume doesn't fill.
4. A **cron schedule** reaches **100 % DCE coverage** across the live catalog within the 30/run cap.

## Decisions log (2026-09-14)
| Decision | Choice | Rationale |
|---|---|---|
| Where sweeps run | Keep in-process for now; **bound the batch** | Moving to a separate worker/Render cron job is the durable fix but larger; capping the batch removes the OOM today with a one-line-config lever |
| Per-run download cap | **30 new ZIPs/run**, env `DCE_WARM_MAX_DOWNLOADS` (0 = off) | Caps peak RSS to ≈ concurrency × ZIP-size + fixed overhead; resumable so many small runs cover everything |
| Buffer lifetime | `del file_bytes, payload` right after `_store` | Un-pins the ZIP across the inter-download sleep so workers don't hold N buffers at once |
| Batch memory diag | **tracemalloc**, env-gated | Measure before/after; off in prod |
| Stale cleanup | Extend `clear_dce_cache("outdated")` to also prune **orphan files** | "Périmé" = archived / past-deadline / gone tenders (existing `_STALE_TENDER_IDS`) **plus** ZIPs on disk with no `ok` row (crash leftovers) |
| Coverage cadence | **Render cron** hitting the admin cache endpoint, not a new in-app scheduler | The daily in-app `daily_scheduler` already does the *scrape+digest*; DCE warming is the heavy part and belongs on an external, restart-safe trigger |

## What changed (code)

| File | Change |
|---|---|
| `backend/mem_profile.py` (new) | `profile_run` env-gated tracemalloc + RSS profiler |
| `backend/config.py` | `DCE_WARM_MAX_DOWNLOADS` (default 30), `DCE_CACHE_PRUNE_ORPHANS` (default on) |
| `backend/dce_cache.py` | Enforce per-run cap in `_run_sweep` (new `download_cap` outcome, clean stop); `del` ZIP buffer after store; `prune_orphan_files`; `clear_dce_cache("outdated")` now also prunes orphans; wrap `cache_all_dces` in `profile_run` |
| `backend/scraper.py` | Wrap `scrape_all_sectors` in `profile_run`; `del tenders` between sectors |
| `backend/admin.py` | `/dce-cache` returns `max_downloads_per_run` |
| `frontend/src/admin/pages/DceCache.tsx`, `types.ts` | Show "max N/run" in cache-usage stats |

Non-goal here: moving the sweep to a dedicated process/queue (durable isolation), and per-file streaming of the download to disk (would drop peak RSS further but requires reworking `download_dce`'s return contract).

## Cron scheduling to reach 100 % coverage by 15/09/2026

**Live catalog size (measured 2026-09-14 via `scrape_homepage_counts`):** **≈ 3,549 open tenders** across 45 sectors. Not all have a DCE, and already-cached tenders are skipped for free, so the *worst case* is ~3,549 first-time downloads.

**Math with a 30/run cap:**
- Runs needed for full cold coverage: ⌈3,549 / 30⌉ = **119 runs**.
- A warm-all run at start-concurrency 4 with 1–2 s jitter + the multi-step portal handshake averages **≈ 8–12 s/ZIP** ⇒ 30 ZIPs ≈ **4–6 min/run** (well under any request-timeout; memory stays bounded because only ≤30 are fetched then the run stops).
- **Restart-safe budget:** peak RSS per run ≈ `concurrency (4) × avg ZIP (~3–5 MB) + BeautifulSoup/httpx overhead` → single-digit-to-low-tens of MB of *transient* growth, released between items. This is the number to confirm with `SCRAPE_MEMORY_PROFILE=1` on the first capped run; if a sector's ZIPs are unusually large, lower `DCE_WARM_MAX_DOWNLOADS` or `DCE_WARM_START_THREADS`.

**Schedule options (pick one):**

- **A — Aggressive one-day catch-up (to hit 15/09):** run the cache endpoint **every 15 min** for 24 h → 96 runs/day × 30 = **2,880 DCEs/day**; two days (14→15 Sep) clears the ~3.5 k backlog with headroom. Each run is independent and memory-bounded, so 96 spaced runs never stack.
- **B — Steady state (post-backfill):** **hourly** cache run (24 × 30 = 720/day) comfortably absorbs the daily new-tender inflow after the backfill, plus the existing 07:00 scrape+digest for discovery.

**Recommended:** **A for 14–15 Sep to backfill, then drop to B.** The daily 07:00 in-app `daily_scheduler` (scrape + digest) stays as-is for *discovery*; DCE *warming* moves to the external cron so heavy download bursts never coincide with the digest send and never run unbounded.

**Wiring (Render cron job, restart-safe):** a Render **Cron Job** service that calls the admin trigger:
```
curl -fsS -X POST "$APP_URL/api/admin/dce-cache" \
     -H "Authorization: Bearer $ADMIN_CRON_TOKEN"
```
`admin_run_dce_cache` already 409s if a run is in progress, so overlapping cron ticks are harmless (the guard `dce_cache_lock` + `PipelineControl.SCRAPE`/`DCE_CACHE` prevent stacking). Because each tick downloads ≤30 and stops, the web worker's RSS returns to baseline between ticks — the OOM/restart/email loop is broken. Env for the backfill window: `DCE_WARM_MAX_DOWNLOADS=30` (default), `SCRAPE_MEMORY_PROFILE=1` on the first tick to capture evidence, then unset.

**Cleanup cadence:** schedule `POST /api/admin/tenders/cleanup-expired?clear_dce_cache=true` **daily** (or weekly) so périmé tenders are archived and their ZIPs + any orphan files are pruned, keeping the 4 GB `DCE_CACHE_MAX_BYTES` budget honest without ever wiping active DCEs.

## Testing
- `test_dce_cache.py`: per-run cap stops after budget, cap=0 disables, cap resumes on next run; `clear_outdated` prunes orphan files; prune disabled leaves files.
- `test_mem_profile.py`: no-op when off (no output, no tracing left on), logs report + stops tracing when on, profiling error never propagates.
- Full suite (`.venv/bin/python -m unittest discover`) green.
