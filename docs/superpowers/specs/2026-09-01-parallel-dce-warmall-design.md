# Parallel DCE warm-all with self-throttling backoff

**Date:** 2026-09-01
**Status:** Design approved, pending spec review
**Area:** `backend/dce_cache.py`, `backend/scraper.py`, `backend/config.py`, `backend/database.py`

## Problem

`cache_all_dces` warms the DCE cache serially: one tender at a time, with a fixed
5–7s pause after each download (added to avoid hammering `marchespublics.gov.ma`
from our single Render IP). Caching ~170 files (the 4 GB cap) that way takes
~20–30 minutes. The pause was **precautionary, not measured** — we have no
evidence the portal has ever rate-limited or blocked us (the earlier 43-file
stop was our own cache cap, not a ban).

We want the warm-all to run **as fast as the portal actually tolerates**, without
guessing a magic delay, and without risking an IP block — while staying
**single-IP** (no proxies, no member sessions in this iteration).

## Goal

Replace the serial loop with **bounded parallelism plus one-directional
(downward-only) self-throttling**:

- Run N downloads concurrently, starting at a fixed N that **never increases**.
- Hold N steady as long as the portal isn't pushing back.
- The moment the portal pushes back (a "flag"), **pause, then resume with fewer
  threads**. Keep backing off toward a floor of 1. If flagged even at 1 thread,
  stop the run cleanly.

## Non-goals

- Multi-IP distribution (proxy pool, member-sourced sessions). Explicitly out of
  scope; may follow if this iteration proves the portal is too strict at N=4.
- Ramping concurrency **up**. Adaptation is downward-only by design — simpler,
  more conservative, predictable.
- Changing the lazy on-demand path (`ensure_dce_cached` single-download) beyond
  the shared `download_dce` signal change below.
- Changing the 4 GB cap / 500 MB free-disk guard behavior (they remain terminal
  stop conditions).

## Approach: sweep-based warm-all

`cache_all_dces` is already **resumable** — it skips tenders that are already
cached (`get_cached`). We exploit that instead of live-resizing a running pool:

- Run the warm-all as a series of **sweeps**. A sweep processes all
  not-yet-cached tenders using a pool of `concurrency` async workers pulling from
  a shared queue.
- A sweep terminates on exactly one of:
  - **finished** — queue drained → run is `done`.
  - **terminal guard** — 4 GB cap reached or free disk < 500 MB → run is
    `stopped` (unchanged from today).
  - **flagged** — a worker detected the portal pushing back → cancel in-flight
    work, back off, start the next sweep.
- Because each sweep re-scans and skips already-cached tenders, "pause and resume
  at fewer threads" is simply **starting the next sweep at a lower
  `concurrency`**. No fragile live pool-resizing; resumability gives it to us for
  free.

Rejected alternative: live-resizing a single long-lived worker pool (adjusting
semaphore permits mid-flight). More code, more edge cases (in-flight cancellation,
permit accounting) for no real benefit over sweeps.

## The backoff state machine

```
concurrency = DCE_WARM_START_THREADS      # fixed start; NEVER increases
loop:
    outcome = run_sweep(concurrency)
    if outcome in (FINISHED, CAP_REACHED, LOW_DISK):
        STOP                              # done | stopped (as today)
    elif outcome == FLAGGED:
        cancel in-flight workers
        log a "paused" event (record concurrency at time of flag)
        sleep DCE_WARM_PAUSE_SECONDS
        concurrency -= DCE_WARM_BACKOFF_STEP     # default step = 1
        if concurrency < 1:
            STOP  status=stopped
                  error="Portal pushing back even at 1 thread — try again later."
        # else: loop → next sweep resumes (skips already-cached), fewer threads
```

Key property: concurrency is **monotonically non-increasing** within a run. A run
can only ever slow down, never speed up.

## Flag classification (the crux)

We must separate *"the portal is pushing back on us"* (global → back off) from
*"this one tender's page is malformed"* (local → count `failed`, keep going).

**Flag — global, triggers backoff:**
- HTTP `429` (Too Many Requests)
- HTTP `503` (Service Unavailable)
- Connection-level failures: `httpx.ConnectError`, `httpx.ReadTimeout`,
  `httpx.RemoteProtocolError` (connection reset)
- A CAPTCHA / rate-limit interstitial: HTML response where a ZIP was expected AND
  the body matches a rate-limit marker (e.g. contains `captcha`,
  `trop de requêtes`, or `access denied`, case-insensitive)

**Not a flag — local, counts as `failed`, no backoff:**
- Missing `PRADO_PAGESTATE` on a single tender's form
- HTTP `404` (tender removed)
- Unexpected content-type / non-ZIP body for a single tender with no rate-limit
  marker

`403` treatment: treat as **local** by default (many are per-resource
permission), to avoid over-reacting. Revisit only if field data shows 403 tracks
with blocking.

### `download_dce` signal change

Today `download_dce` swallows every error and returns `None`
(`scraper.py:404`), so a 429 is indistinguishable from a malformed page. It must
**surface the reason**. Chosen shape (typed result, no exceptions across the
boundary):

- Success: return `("ok", (file_bytes, filename))`
- Local failure: return `("failed", None)`
- Global flag: return `("flagged", <signal_str>)` — e.g. `"http_429"`,
  `"conn_reset"`, `"captcha"`

Implementation notes:
- Replace the blanket `except Exception` with explicit handling: catch
  `httpx.HTTPStatusError` and branch on `e.response.status_code` (429/503 →
  flagged; 404 → failed); catch the connection exceptions above → flagged;
  inspect the download response body for the CAPTCHA marker before deciding.
- **The warm-all worker consumes the typed `download_dce` result directly**
  (it does not delegate to `ensure_dce_cached`). That is what lets it tell
  `"flagged"` from `"failed"`: `"ok"` → `_store` + `cached++`; `"failed"` →
  `failed++` and write a `'failed'` row; `"flagged"` → signal backoff, write **no
  row** (so the next sweep retries the tender). It still calls `get_cached` first
  to skip already-cached tenders.
- `ensure_dce_cached` (lazy single-click path) is updated only to consume the new
  typed return while keeping its **observable behavior unchanged**: any
  non-`"ok"` result (`"failed"` or `"flagged"`) collapses to the existing
  `None` + `'failed'`-row outcome. A lone user click that happens to hit a
  rate-limit just shows "download failed", as today — the flag distinction is a
  warm-all concern only.

## Config knobs (all env-overridable, in `config.py`)

| Name | Default | Meaning |
|------|---------|---------|
| `DCE_WARM_START_THREADS` | `4` | Fixed starting concurrency; never exceeded. |
| `DCE_WARM_PAUSE_SECONDS` | `60` | Sleep after a flag before resuming. |
| `DCE_WARM_BACKOFF_STEP` | `1` | Threads shed per flag. |
| `DCE_WARM_MIN_THREADS` | `1` | Floor; flag at this level → stop the run. |
| `DCE_WARM_DELAY_MIN` | `1` | Per-download jitter min (reduced from 5). |
| `DCE_WARM_DELAY_MAX` | `2` | Per-download jitter max (reduced from 7). |

The existing `DCE_WARM_DELAY_MIN/MAX` are **reduced from 5–7s to 1–2s**:
concurrency is now the throughput lever and backoff is the safety mechanism, so
the per-worker pause need only add mild jitter.

Unchanged terminal guards: `DCE_CACHE_MAX_BYTES` (4 GB), `DCE_MIN_FREE_BYTES`
(500 MB).

## Data model & observability

Extend `dce_cache_log` (schema at `database.py:94`) with:

- `concurrency INTEGER` — the thread count the run is *currently* at (updated on
  each backoff).
- `pauses INTEGER DEFAULT 0` — how many times it flagged + backed off.

The admin DCE-cache panel reads these so the operator sees, live:
> *"running at 4 threads… paused (flagged: http_429)… resumed at 3 threads
> (pauses: 1)."*

The `error` column continues to hold the terminal reason on a `stopped`/`failed`
run (cap reached, low disk, or "pushing back even at 1 thread"). The last flag
signal is surfaced via the running status text.

Counter updates (`total/cached/skipped/failed`) keep working, now written from
concurrent workers. Workers increment **in-memory** counters guarded by a single
`asyncio.Lock`; the **supervisor** flushes those counters to `dce_cache_log`
periodically (e.g. after each worker completion it schedules a debounced write),
so we don't issue a DB write per worker per file and the shared connection isn't
contended. This keeps the polling admin UI fresh without per-row write storms.

## Error handling

- **In-flight cancellation on flag:** when a worker returns `"flagged"`, the
  supervisor signals the sweep to stop scheduling new work and cancels
  outstanding tasks; partially-downloaded tenders are simply not stored (no
  partial writes — `_store` only writes after a full in-memory download, which is
  already the case).
- **Idempotency:** a cancelled/failed tender is left uncached, so the next sweep
  retries it. No `'failed'` row is written for a *flagged* download (it wasn't the
  tender's fault) — only genuine local failures record a `'failed'` row, matching
  today's semantics.
- **One run at a time:** the existing `dce_cache_lock` still serializes warm-all
  runs.
- **Unexpected exceptions** in a worker are caught and treated as **local
  failed** (not flagged), so one weird tender can't trigger a false backoff.

## Testing

- **Classifier tests** (`download_dce` result mapping): mock the httpx client so
  the download step returns 429 / 503 / raises `ConnectError` / returns a CAPTCHA
  HTML page → assert `("flagged", ...)`; returns 404 / a page with no PAGESTATE /
  a non-ZIP body without markers → assert `("failed", None)`; returns a real ZIP
  → assert `("ok", (bytes, name))`.
- **State-machine tests** (`cache_all_dces` supervisor, with `download_dce`
  mocked, pause/delay patched to 0):
  - All-clean → runs at `DCE_WARM_START_THREADS` the whole time, `pauses == 0`,
    concurrency never exceeds start (asserts no upward ramp).
  - Flag on the Kth download → asserts one pause, `concurrency` drops by
    `DCE_WARM_BACKOFF_STEP`, run resumes and completes remaining tenders.
  - Persistent flag down to the floor → run ends `stopped` with the
    "pushing back even at 1 thread" reason.
  - Cap / low-disk during a sweep → still terminates `stopped` as today.
- **Regression:** existing `test_dce_cache.py` (7 cases) stays green; the lazy
  `ensure_dce_cached` behavior (cache hit, miss→store, failure→`'failed'` row) is
  unchanged.

## Rollout

- All knobs env-overridable, so behavior is tunable in Render without a redeploy;
  defaults chosen conservatively (start 4, pause 60s, floor 1).
- Ships on `next-prod`; Render auto-deploys on commit. First real run is the
  observable test — watch the admin panel for whether it ever flags at N=4.
- If it never flags: we keep full 4-thread speed. If it's touchy: it self-settles
  to the portal's real tolerance, and that data tells us whether the multi-IP
  (non-goal) step is ever worth it.
