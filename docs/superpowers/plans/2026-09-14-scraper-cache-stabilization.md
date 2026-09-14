# Scraper & DCE-Cache Stabilization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to work this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.
> Design: [`../specs/2026-09-14-scraper-cache-stabilization-design.md`](../specs/2026-09-14-scraper-cache-stabilization-design.md).

**Goal:** Stop an in-process scrape/cache run from OOM-killing → restarting the Render container (and firing the restart email). Bound per-run memory (cap downloads to 30, release buffers), prune périmé cache folders, add env-gated tracemalloc profiling, and stand up a restart-safe cron schedule that reaches 100 % DCE coverage.

**Architecture:** Sweeps stay in-process for now but are **batch-bounded**. `dce_cache.cache_all_dces` fetches at most `DCE_WARM_MAX_DOWNLOADS` new ZIPs per run then stops cleanly; a resumable sweep means many small cron-triggered runs cover the whole catalog. External Render cron drives cadence; the daily in-app scheduler keeps doing scrape+digest for discovery.

**Tech Stack:** Python 3, FastAPI, aiosqlite, `unittest`; `tracemalloc`; React/TS admin. Backend tests: `cd backend && .venv/bin/python -m unittest ...` (venv has **no pytest** — use `unittest`).

## Global Constraints
- Never `git add -A` — the repo has many unrelated untracked files. Path-limited commits only. **Do not commit or push in this session.**
- Profiling must be **off by default** and never break a run (wrap in try/except).
- The download cap must be **configurable** and `0` must mean "no cap" (legacy behavior).
- "Outdated" cleanup must **never** remove active DCEs (future-deadline, non-archived, still in catalog).
- Any admin-response field added must be reflected in the frontend type + `tsc --noEmit` clean.

---

## Task 1 — tracemalloc profiler (diagnostic backbone) — DONE
**Files:** new `backend/mem_profile.py`; new `backend/test_mem_profile.py`.
- [x] `profile_run(label)` async CM, gated by `SCRAPE_MEMORY_PROFILE` (`1/true/yes/on`).
- [x] On exit: log `traced_current/peak`, `rss_start/end`, top-N (`SCRAPE_MEMORY_TOP_N`, default 10) allocation sites; stop tracing if we started it.
- [x] RSS via `/proc/self/statm` (Linux/Render) with `ru_maxrss` fallback (bytes on macOS, KiB on Linux).
- [x] Tests: disabled = no output + no tracing left; enabled = report emitted + tracing stopped; profiling error swallowed.

## Task 2 — cap downloads to 30/run — DONE
**Files:** `backend/config.py`, `backend/dce_cache.py`, `backend/test_dce_cache.py`.
- [x] `DCE_WARM_MAX_DOWNLOADS = int(os.getenv(..., "30"))`; `0` disables.
- [x] `_run_sweep`: count fresh stores; new `download_cap` stop reason both before pulling work and right after a store hitting the budget.
- [x] `cache_all_dces`: handle `download_cap` → `status="stopped"`, non-error message "remaining … next run"; wrap loop in `profile_run("cache_all_dces")`.
- [x] Tests: stops at budget (cached == cap), cap=0 uncapped (all cached, `done`), resumes next run (skips already-cached).

## Task 3 — reduce batch / release buffers — DONE
**Files:** `backend/dce_cache.py`, `backend/scraper.py`.
- [x] `del file_bytes, payload` after `_store` (un-pin ZIP across inter-download sleep).
- [x] `scrape_all_sectors`: wrap sector loop in `profile_run("scrape_all_sectors")`; `del tenders` between sectors.

## Task 4 — prune périmé / orphan cache folders — DONE
**Files:** `backend/config.py`, `backend/dce_cache.py`, `backend/test_dce_cache.py`.
- [x] `DCE_CACHE_PRUNE_ORPHANS` (default on).
- [x] `prune_orphan_files(db)`: delete `*.zip` on disk with no matching `ok` row; returns `(files, bytes)`.
- [x] `clear_dce_cache("outdated")` also calls `prune_orphan_files` and folds counts in.
- [x] Tests: orphan swept + active kept; prune disabled leaves files.

## Task 5 — surface the cap in admin UI — DONE
**Files:** `backend/admin.py`, `frontend/src/admin/pages/DceCache.tsx`, `frontend/src/admin/types.ts`.
- [x] `/dce-cache` returns `max_downloads_per_run`.
- [x] DceCache page shows "max N/run" chip; `tsc --noEmit` clean.

## Task 6 — cron scheduling (design decision) — DONE (documented)
**Files:** design spec (§ *Cron scheduling to reach 100 % coverage*).
- [x] Sized against **live ~3,549 open tenders / 45 sectors** ⇒ ⌈3549/30⌉ = **119 runs** for cold coverage.
- [x] **Schedule A** (every 15 min, 96 runs/day = 2,880 DCEs/day) for the 14→15 Sep backfill; then **Schedule B** (hourly, 720/day) steady-state.
- [x] Wiring: Render **Cron Job** → `POST /api/admin/dce-cache` (409-guarded, `dce_cache_lock` prevents stacking, RSS returns to baseline between ticks → OOM/restart/email loop broken). Daily 07:00 in-app scheduler unchanged for scrape+digest.
- [x] Cleanup cron: daily/weekly `POST /api/admin/tenders/cleanup-expired?clear_dce_cache=true`.

---

## Verification (run before claiming done)
- [x] `cd backend && .venv/bin/python -m unittest test_mem_profile test_dce_cache test_download_dce` → green.
- [x] `cd backend && .venv/bin/python -m unittest discover -p "test_*.py"` → **235 tests, OK**.
- [x] `cd frontend && npx tsc --noEmit` → clean.
- [x] Manual smoke: `SCRAPE_MEMORY_PROFILE=1` around an allocation logs a plausible RSS report.

## Follow-ups (not in this session)
- [ ] Move heavy sweeps to a **dedicated worker / Render background service** for true process isolation (durable fix beyond batch-bounding).
- [ ] Stream `download_dce` straight to disk (drop peak RSS to ~1 ZIP) instead of returning full `content`.
- [ ] Provision the Render cron job(s) + `ADMIN_CRON_TOKEN`; capture one `SCRAPE_MEMORY_PROFILE=1` run's numbers into the design's restart-safe budget section.
