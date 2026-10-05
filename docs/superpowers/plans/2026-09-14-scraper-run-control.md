# Scraper Run Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hard 30-live-retrieval cap to manual DCE cache runs and expose clear desktop/mobile admin controls and progress.

**Architecture:** Enforce the retrieval cap inside `backend/dce_cache.py`, close to the worker queue, so direct API calls cannot bypass it. Persist retrieval limit/progress in `dce_cache_log`, return those fields from the admin API, and render them in the DCE cache admin page with a compact active-run summary that works on phone screens.

**Tech Stack:** FastAPI, aiosqlite, Python `unittest.IsolatedAsyncioTestCase`, React 19, TypeScript, Vitest, Testing Library, Tailwind CSS utility classes.

## Global Constraints

- Cap each manual DCE cache run at 30 live DCE retrieval attempts by default.
- Count only live DCE download attempts toward the cap, not already-cached tenders or tenders skipped because no DCE URL exists.
- Stop cleanly when the cap is reached and write the stop reason into the run log.
- Show cap, live progress, and terminal stop reason in the admin DCE cache page.
- Improve mobile operator control for scrape and DCE pages with compact, easy-to-reach run controls and readable live status.
- Preserve pause, resume, cancel, disk-cap, cache-size-cap, and portal-backoff behavior.
- Do not build native iOS or Android apps.
- Do not change the public tender catalog.
- Do not change scheduled import frequency.
- Do not bypass source-site rate limits, CAPTCHA, authentication, or access controls.
- Do not add new external scraping targets.

---

## File Structure

- Modify `backend/config.py`
  - Owns the default `DCE_CACHE_RUN_RETRIEVAL_LIMIT` environment-backed setting.

- Modify `backend/database.py`
  - Adds `retrieval_limit` and `retrievals_attempted` to `dce_cache_log` creation and migration.

- Modify `backend/dce_cache.py`
  - Enforces the retrieval cap in the DCE warm-cache worker loop.
  - Writes `retrieval_limit` and `retrievals_attempted` to run logs.
  - Returns retrieval counters in `cache_all_dces`.

- Modify `backend/admin.py`
  - Returns `retrieval_limit` and active progress from `GET /api/admin/dce-cache`.
  - Starts capped runs using the configured default.

- Modify `backend/test_dce_cache.py`
  - Adds red/green tests for exact cap enforcement, cached skips, no-DCE skips, and log persistence.
  - Updates local test table schema to include new log columns.

- Modify `frontend/src/admin/types.ts`
  - Adds retrieval fields to `DceCacheRun` and `DceCacheStatus`.

- Modify `frontend/src/admin/pages/DceCache.tsx`
  - Renders run cap, active retrieval progress, and stop reason.
  - Improves active controls/status readability for mobile.

- Add `frontend/src/admin/pages/__tests__/DceCache.test.tsx`
  - Verifies cap/progress/stop reason presentation at component level.

---

### Task 1: Backend DCE Retrieval Cap

**Files:**
- Modify: `backend/config.py`
- Modify: `backend/database.py`
- Modify: `backend/dce_cache.py`
- Modify: `backend/test_dce_cache.py`

**Interfaces:**
- Consumes: existing `cache_all_dces(actor_email: str | None = None) -> dict`
- Produces:
  - `config.DCE_CACHE_RUN_RETRIEVAL_LIMIT: int`
  - `cache_all_dces(actor_email: str | None = None, retrieval_limit: int | None = DCE_CACHE_RUN_RETRIEVAL_LIMIT) -> dict`
  - `cache_all_dces` result includes `retrieval_limit: int | None` and `retrievals_attempted: int`
  - `dce_cache_log` rows include `retrieval_limit` and `retrievals_attempted`

- [ ] **Step 1: Write failing backend tests for cap behavior**

Add the two new columns to the test schema in `backend/test_dce_cache.py` inside `WarmAllBackoffTest.asyncSetUp`:

```python
            CREATE TABLE dce_cache_log (id INTEGER PRIMARY KEY AUTOINCREMENT,
                                        started_at TEXT DEFAULT (datetime('now')),
                                        finished_at TEXT, total INTEGER DEFAULT 0,
                                        cached INTEGER DEFAULT 0, skipped INTEGER DEFAULT 0,
                                        failed INTEGER DEFAULT 0, status TEXT DEFAULT 'running',
                                        error TEXT, actor_email TEXT,
                                        concurrency INTEGER, pauses INTEGER DEFAULT 0,
                                        retrieval_limit INTEGER,
                                        retrievals_attempted INTEGER DEFAULT 0);
```

Then append these tests to `WarmAllBackoffTest`:

```python
    async def test_retrieval_limit_starts_no_more_than_limit_downloads(self):
        ok = ("ok", (b"PK\x03\x04zip", "d.zip"))
        with patch.object(dce_cache, "DCE_WARM_START_THREADS", 3), \
             patch.object(dce_cache, "download_dce", AsyncMock(return_value=ok)) as dl:
            res = await dce_cache.cache_all_dces("admin@test", retrieval_limit=2)

        self.assertEqual(res["status"], "stopped")
        self.assertEqual(res["retrieval_limit"], 2)
        self.assertEqual(res["retrievals_attempted"], 2)
        self.assertEqual(dl.await_count, 2)
        self.assertEqual(res["cached"], 2)

        log = await self._last_log()
        self.assertEqual(log["retrieval_limit"], 2)
        self.assertEqual(log["retrievals_attempted"], 2)
        self.assertIn("Run limit reached: 2 retrievals", log["error"] or "")

    async def test_cached_and_missing_dce_items_do_not_consume_retrieval_limit(self):
        details = {
            "T0": {"dce_url": ""},
            "T1": {"dce_url": "http://t/dce/1"},
            "T2": {"dce_url": "http://t/dce/2"},
            "T3": {"dce_url": "http://t/dce/3"},
            "T4": {"dce_url": "http://t/dce/4"},
        }

        async def detail_for_tender(db, tender_id, detail_url):
            return details[tender_id]

        await dce_cache._store(
            await dce_cache.get_db(),
            "T1",
            b"PK\x03\x04already",
            "cached.zip",
        )

        ok = ("ok", (b"PK\x03\x04zip", "d.zip"))
        with patch.object(dce_cache, "DCE_WARM_START_THREADS", 1), \
             patch.object(dce_cache, "ensure_tender_details", AsyncMock(side_effect=detail_for_tender)), \
             patch.object(dce_cache, "download_dce", AsyncMock(return_value=ok)) as dl:
            res = await dce_cache.cache_all_dces("admin@test", retrieval_limit=2)

        self.assertEqual(dl.await_count, 2)
        self.assertEqual(res["retrievals_attempted"], 2)
        self.assertEqual(res["cached"], 2)
        self.assertGreaterEqual(res["skipped"], 2)
```

If the second test creates a separate connection for `_store`, close it after storing:

```python
        db = await dce_cache.get_db()
        await dce_cache._store(db, "T1", b"PK\x03\x04already", "cached.zip")
        await db.close()
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd backend && python -m unittest test_dce_cache.WarmAllBackoffTest -v
```

Expected:

- The new tests fail because `cache_all_dces` does not accept `retrieval_limit`.
- Existing tests may error if the schema references new fields before implementation.

- [ ] **Step 3: Add config and database columns**

In `backend/config.py`, add this setting after `DCE_CACHE_MAX_BYTES`:

```python
# Maximum live DCE download attempts started by one warm-cache run. Already
# cached tenders and tenders without a DCE URL do not consume this limit.
DCE_CACHE_RUN_RETRIEVAL_LIMIT = int(os.getenv("DCE_CACHE_RUN_RETRIEVAL_LIMIT", "30"))
```

In `backend/database.py`, extend the `CREATE TABLE IF NOT EXISTS dce_cache_log` block:

```sql
            concurrency INTEGER,            -- threads the run is currently at
            pauses INTEGER DEFAULT 0,        -- times it flagged + backed off
            retrieval_limit INTEGER,         -- max live DCE retrievals for this run
            retrievals_attempted INTEGER DEFAULT 0
```

In the migration section near the existing DCE cache log migration, add:

```python
    await _add_column_if_missing(db, "dce_cache_log", "retrieval_limit", "retrieval_limit INTEGER")
    await _add_column_if_missing(db, "dce_cache_log", "retrievals_attempted", "retrievals_attempted INTEGER DEFAULT 0")
```

- [ ] **Step 4: Enforce retrieval limit in `backend/dce_cache.py`**

Update imports from `config`:

```python
    DCE_CACHE_RUN_RETRIEVAL_LIMIT,
```

Update `_write_run_log`:

```python
async def _write_run_log(db, log_id: int, state: dict, status: str) -> None:
    """Flush the in-memory counters to dce_cache_log so the polling admin UI
    stays fresh. Status stays 'running' for the whole run; the terminal status
    is written once in cache_all_dces's finally block."""
    await db.execute(
        """UPDATE dce_cache_log
           SET total=?, cached=?, skipped=?, failed=?, pauses=?, concurrency=?,
               retrieval_limit=?, retrievals_attempted=?, status=?
           WHERE id=?""",
        (state["total"], state["cached"], state["skipped"], state["failed"],
         state["pauses"], state["concurrency"], state["retrieval_limit"],
         state["retrievals_attempted"], status, log_id),
    )
    await db.commit()
```

Update `_run_sweep` signature:

```python
async def _run_sweep(db, log_id: int, items, concurrency: int,
                     state: dict, counter_lock) -> str:
```

Inside `worker`, immediately before `dl_status, payload = await download_dce(dce_url)`, add:

```python
                async with counter_lock:
                    limit = state.get("retrieval_limit")
                    if limit is not None and state["retrievals_attempted"] >= limit:
                        stop["reason"] = "limit"
                        await _write_run_log(db, log_id, state, "running")
                        return
                    state["retrievals_attempted"] += 1
                    await _write_run_log(db, log_id, state, "running")
```

Update `cache_all_dces` signature:

```python
async def cache_all_dces(
    actor_email: str | None = None,
    retrieval_limit: int | None = DCE_CACHE_RUN_RETRIEVAL_LIMIT,
) -> dict:
```

Update log insert:

```python
        log_cursor = await db.execute(
            "INSERT INTO dce_cache_log (status, actor_email, concurrency, pauses, retrieval_limit, retrievals_attempted) "
            "VALUES ('running', ?, ?, 0, ?, 0)",
            (actor_email, concurrency, retrieval_limit),
        )
```

Update state:

```python
        state = {"total": 0, "cached": 0, "skipped": 0, "failed": 0,
                 "pauses": 0, "concurrency": concurrency,
                 "retrieval_limit": retrieval_limit, "retrievals_attempted": 0}
```

Add outcome handling in the main loop before the flagged branch:

```python
                if outcome == "limit":
                    final_status = "stopped"
                    err = f"Run limit reached: {retrieval_limit} retrievals."
                    break
```

Update final log write:

```python
                """UPDATE dce_cache_log
                   SET finished_at = datetime('now'),
                       total=?, cached=?, skipped=?, failed=?, pauses=?, concurrency=?,
                       retrieval_limit=?, retrievals_attempted=?,
                       status=?, error=?
                   WHERE id = ?""",
                (state["total"], state["cached"], state["skipped"], state["failed"],
                 state["pauses"], state["concurrency"], state["retrieval_limit"],
                 state["retrievals_attempted"], final_status, err, log_id),
```

Update the return:

```python
        return {"total": state["total"], "cached": state["cached"],
                "skipped": state["skipped"], "failed": state["failed"],
                "pauses": state["pauses"], "status": final_status,
                "retrieval_limit": state["retrieval_limit"],
                "retrievals_attempted": state["retrievals_attempted"]}
```

- [ ] **Step 5: Run backend cap tests to verify they pass**

Run:

```bash
cd backend && python -m unittest test_dce_cache.WarmAllBackoffTest -v
```

Expected:

- All `WarmAllBackoffTest` tests pass.

- [ ] **Step 6: Run full DCE cache test module**

Run:

```bash
cd backend && python -m unittest test_dce_cache -v
```

Expected:

- All tests in `test_dce_cache.py` pass.

- [ ] **Step 7: Commit backend cap**

Run:

```bash
git add backend/config.py backend/database.py backend/dce_cache.py backend/test_dce_cache.py
git commit -m "feat: cap dce cache retrieval runs"
```

Expected:

- Commit succeeds.

---

### Task 2: Admin API Retrieval Progress

**Files:**
- Modify: `backend/admin.py`
- Modify: `backend/test_admin.py`

**Interfaces:**
- Consumes:
  - `config.DCE_CACHE_RUN_RETRIEVAL_LIMIT`
  - `DCE_CACHE.progress`
  - `dce_cache_log.retrieval_limit`
  - `dce_cache_log.retrievals_attempted`
- Produces:
  - `GET /api/admin/dce-cache` response includes `retrieval_limit: int` and `progress: dict | None`
  - `POST /api/admin/dce-cache` still returns `{ "status": "started" }`

- [ ] **Step 1: Write failing admin API test**

Find the admin DCE cache tests in `backend/test_admin.py`. Add or update a test that logs in as admin and calls `/api/admin/dce-cache`. Use this assertion pattern:

```python
    def test_dce_cache_status_includes_retrieval_limit_and_progress(self):
        token = self._admin_token()
        response = self.client.get(
            "/api/admin/dce-cache",
            headers={"Authorization": f"Bearer {token}"},
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("retrieval_limit", body)
        self.assertEqual(body["retrieval_limit"], 30)
        self.assertIn("progress", body)
```

If the file uses a different helper than `_admin_token`, follow the existing test pattern for authenticated admin requests and keep only the assertion body above.

- [ ] **Step 2: Run the focused admin test to verify it fails**

Run:

```bash
cd backend && python -m unittest test_admin -v
```

Expected:

- The new assertion fails because the response does not include `retrieval_limit` or `progress`.

- [ ] **Step 3: Update `backend/admin.py` DCE status response**

In `backend/admin.py`, update `admin_dce_cache` imports:

```python
    from config import DCE_CACHE_MAX_BYTES, DCE_CACHE_RUN_RETRIEVAL_LIMIT
```

Update the returned dict:

```python
        return {
            "data": [dict(r) for r in rows],
            "active": active,
            "paused": DCE_CACHE.paused if active else False,
            "progress": DCE_CACHE.progress if active else None,
            "cached_total": cached_total,
            "cached_bytes": cached_bytes,
            "cap_bytes": DCE_CACHE_MAX_BYTES,
            "retrieval_limit": DCE_CACHE_RUN_RETRIEVAL_LIMIT,
        }
```

- [ ] **Step 4: Ensure `backend/dce_cache.py` updates live progress**

Inside `cache_all_dces`, change:

```python
        DCE_CACHE.begin()
```

to:

```python
        DCE_CACHE.begin({
            "total": 0,
            "cached": 0,
            "skipped": 0,
            "failed": 0,
            "retrieval_limit": retrieval_limit,
            "retrievals_attempted": 0,
        })
```

After setting `state["total"] = len(items)`, add:

```python
            DCE_CACHE.update(total=state["total"])
```

After each state counter mutation in `_run_sweep`, call `DCE_CACHE.update(...)` through a helper to avoid repeating the same fields. Add this helper near `_write_run_log`:

```python
def _publish_progress(state: dict) -> None:
    DCE_CACHE.update(
        total=state["total"],
        cached=state["cached"],
        skipped=state["skipped"],
        failed=state["failed"],
        pauses=state["pauses"],
        concurrency=state["concurrency"],
        retrieval_limit=state["retrieval_limit"],
        retrievals_attempted=state["retrievals_attempted"],
    )
```

Call `_publish_progress(state)` after changing `cached`, `skipped`, `failed`, `pauses`, `concurrency`, or `retrievals_attempted`.

- [ ] **Step 5: Run admin and DCE tests**

Run:

```bash
cd backend && python -m unittest test_dce_cache test_admin -v
```

Expected:

- `test_dce_cache` passes.
- `test_admin` passes, including the new DCE cache status assertions.

- [ ] **Step 6: Commit admin API progress**

Run:

```bash
git add backend/admin.py backend/dce_cache.py backend/test_admin.py
git commit -m "feat: expose dce cache retrieval progress"
```

Expected:

- Commit succeeds.

---

### Task 3: Admin UI Retrieval Cap And Mobile Status

**Files:**
- Modify: `frontend/src/admin/types.ts`
- Modify: `frontend/src/admin/pages/DceCache.tsx`
- Add: `frontend/src/admin/pages/__tests__/DceCache.test.tsx`

**Interfaces:**
- Consumes:
  - `DceCacheStatus.retrieval_limit: number`
  - `DceCacheStatus.progress: DceCacheProgress | null`
  - `DceCacheRun.retrieval_limit: number | null`
  - `DceCacheRun.retrievals_attempted: number | null`
  - `DceCacheRun.error: string | null`
- Produces:
  - DCE cache page shows `Max 30 live retrievals per run`
  - Active DCE cache page shows `12 / 30 retrievals attempted`
  - History shows capped stop reason in an accessible visible cell

- [ ] **Step 1: Write failing frontend component tests**

Create `frontend/src/admin/pages/__tests__/DceCache.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import DceCache from "../DceCache";

vi.mock("../../../lib/auth", () => ({
  useAuth: () => ({ user: { role: "admin" } }),
}));

vi.mock("../../api", async () => {
  class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  return {
    ApiError,
    getDceCache: vi.fn(),
    runDceCache: vi.fn(),
    clearDceCache: vi.fn(),
    steerPipeline: vi.fn(),
  };
});

vi.mock("../../hooks", () => ({
  usePipelinePolling: () => undefined,
}));

const api = await import("../../api");

describe("DceCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders retrieval cap, active progress, and stop reason", async () => {
    vi.mocked(api.getDceCache).mockResolvedValue({
      data: [{
        id: 7,
        started_at: "2026-09-14T10:00:00",
        finished_at: "2026-09-14T10:02:00",
        total: 80,
        cached: 30,
        skipped: 4,
        failed: 1,
        status: "stopped",
        error: "Run limit reached: 30 retrievals.",
        actor_email: "admin@test",
        concurrency: 2,
        pauses: 0,
        retrieval_limit: 30,
        retrievals_attempted: 30,
      }],
      active: true,
      paused: false,
      cached_total: 30,
      cached_bytes: 1024,
      cap_bytes: 4096,
      retrieval_limit: 30,
      progress: {
        total: 80,
        cached: 12,
        skipped: 3,
        failed: 1,
        pauses: 0,
        concurrency: 2,
        retrieval_limit: 30,
        retrievals_attempted: 12,
      },
    });

    render(<DceCache />);

    expect(await screen.findByText("Max 30 live retrievals per run")).toBeInTheDocument();
    expect(screen.getByText("12 / 30 retrievals attempted")).toBeInTheDocument();
    expect(screen.getByText("Run limit reached: 30 retrievals.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run frontend test to verify it fails**

Run:

```bash
cd frontend && npm test -- src/admin/pages/__tests__/DceCache.test.tsx --run
```

Expected:

- Test fails because `DceCacheStatus` and the page do not expose/render retrieval cap/progress.

- [ ] **Step 3: Update TypeScript admin types**

In `frontend/src/admin/types.ts`, update `DceCacheRun`:

```ts
export interface DceCacheRun {
  id: number;
  started_at: string;
  finished_at: string | null;
  total: number;
  cached: number;
  skipped: number;
  failed: number;
  status: string; // running | done | failed | stopped
  error: string | null;
  actor_email: string | null;
  concurrency: number | null;
  pauses: number | null;
  retrieval_limit: number | null;
  retrievals_attempted: number | null;
}
```

Add:

```ts
export interface DceCacheProgress {
  total: number;
  cached: number;
  skipped: number;
  failed: number;
  pauses: number;
  concurrency: number;
  retrieval_limit: number | null;
  retrievals_attempted: number;
}
```

Update `DceCacheStatus`:

```ts
export interface DceCacheStatus {
  data: DceCacheRun[];
  active: boolean;
  paused: boolean;
  progress: DceCacheProgress | null;
  cached_total: number;
  cached_bytes: number;
  cap_bytes: number;
  retrieval_limit: number;
}
```

- [ ] **Step 4: Render cap and active progress in `DceCache.tsx`**

In `frontend/src/admin/pages/DceCache.tsx`, after:

```ts
  const capBytes = status?.cap_bytes ?? 0;
```

add:

```ts
  const retrievalLimit = status?.retrieval_limit ?? 30;
  const progress = status?.progress ?? null;
  const attempted = progress?.retrievals_attempted ?? 0;
  const activeLimit = progress?.retrieval_limit ?? retrievalLimit;
```

Inside the `PageHeader` `description`, keep the existing sentence. Immediately after `PageHeader`, add:

```tsx
      <div className="mb-4 rounded-lg border border-[var(--color-border-subtle)] bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--color-charcoal)]">
              Max {retrievalLimit} live retrievals per run
            </p>
            <p className="text-xs font-sans text-[var(--color-muted-light)]">
              Cached and missing-DCE tenders do not consume the run limit.
            </p>
          </div>
          {active && (
            <div className="text-sm font-sans text-[var(--color-slate)]">
              <span className="font-semibold text-[var(--color-charcoal)] tabular-nums">
                {attempted} / {activeLimit ?? retrievalLimit}
              </span>{" "}
              retrievals attempted
            </div>
          )}
        </div>
        {active && progress && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-sans text-[var(--color-slate)] sm:grid-cols-4">
            <span><strong className="text-[var(--color-charcoal)] tabular-nums">{progress.cached}</strong> cached</span>
            <span><strong className="text-[var(--color-charcoal)] tabular-nums">{progress.skipped}</strong> skipped</span>
            <span><strong className="text-[var(--color-crimson)] tabular-nums">{progress.failed}</strong> failed</span>
            <span><strong className="text-[var(--color-charcoal)] tabular-nums">{progress.concurrency}</strong> threads</span>
          </div>
        )}
      </div>
```

Update the history columns to include retrieval attempts and stop reason:

```tsx
    { header: "Retrievals", align: "right", cell: (r) => (
      <span className="tabular-nums">
        {r.retrievals_attempted ?? "—"}{r.retrieval_limit ? ` / ${r.retrieval_limit}` : ""}
      </span>
    ) },
    { header: "Stop reason", cell: (r) => (
      <span className="text-[var(--color-slate)]">{r.error || "—"}</span>
    ) },
```

Place these after the `Pauses` column and before `Cached`.

- [ ] **Step 5: Make shared pipeline controls more mobile-friendly**

In `frontend/src/admin/components/PipelineControls.tsx`, update the wrapper class:

```tsx
    <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
```

Add `justify-center sm:justify-start` to each button class in the active controls:

```tsx
className="inline-flex items-center justify-center sm:justify-start gap-1.5 px-3 py-1.5 text-sm font-sans rounded-lg border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] disabled:opacity-45 disabled:cursor-not-allowed"
```

and:

```tsx
className="inline-flex items-center justify-center sm:justify-start gap-1.5 px-3 py-1.5 text-sm font-sans rounded-lg border border-[var(--color-crimson)]/40 text-[var(--color-crimson)] hover:bg-[var(--color-crimson)]/5 focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] disabled:opacity-45 disabled:cursor-not-allowed"
```

If `GatedButton` already centers content, do not change it. If it does not, update `frontend/src/admin/components/ui.tsx` so `GatedButton` uses `justify-center sm:justify-start`.

- [ ] **Step 6: Run frontend DCE page test**

Run:

```bash
cd frontend && npm test -- src/admin/pages/__tests__/DceCache.test.tsx --run
```

Expected:

- Test passes.

- [ ] **Step 7: Run frontend build**

Run:

```bash
cd frontend && npm run build
```

Expected:

- TypeScript and Vite build pass.

- [ ] **Step 8: Commit admin UI**

Run:

```bash
git add frontend/src/admin/types.ts frontend/src/admin/pages/DceCache.tsx frontend/src/admin/pages/__tests__/DceCache.test.tsx frontend/src/admin/components/PipelineControls.tsx frontend/src/admin/components/ui.tsx
git commit -m "feat: show dce cache retrieval controls"
```

Expected:

- Commit succeeds.

---

### Task 4: End-To-End Verification And Cleanup

**Files:**
- Modify only if a verification failure reveals a missed integration detail.

**Interfaces:**
- Consumes all outputs from Tasks 1-3.
- Produces verified implementation ready for review.

- [ ] **Step 1: Run backend DCE-focused tests**

Run:

```bash
cd backend && python -m unittest test_dce_cache test_admin -v
```

Expected:

- All tests pass.

- [ ] **Step 2: Run frontend test and build**

Run:

```bash
cd frontend && npm test -- src/admin/pages/__tests__/DceCache.test.tsx --run
cd frontend && npm run build
```

Expected:

- DCE cache component test passes.
- Build passes.

- [ ] **Step 3: Manual API shape check**

Run the backend locally if needed:

```bash
npm run dev:backend
```

Then authenticate as an admin through the existing app flow and call:

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/admin/dce-cache
```

Expected response fields include:

```json
{
  "active": false,
  "paused": false,
  "progress": null,
  "cached_total": 0,
  "cached_bytes": 0,
  "cap_bytes": 4294967296,
  "retrieval_limit": 30
}
```

Stop any dev server session before finishing.

- [ ] **Step 4: Review changed files**

Run:

```bash
git diff --stat HEAD
git diff HEAD -- backend/config.py backend/database.py backend/dce_cache.py backend/admin.py backend/test_dce_cache.py backend/test_admin.py frontend/src/admin/types.ts frontend/src/admin/pages/DceCache.tsx frontend/src/admin/pages/__tests__/DceCache.test.tsx frontend/src/admin/components/PipelineControls.tsx frontend/src/admin/components/ui.tsx
```

Expected:

- Diff contains only the retrieval cap, admin API progress, and UI status/control changes.
- No unrelated worktree changes are included.

- [ ] **Step 5: Final commit if verification required fixes**

If Step 4 found and fixed integration issues, commit only those fixes:

```bash
git add backend/config.py backend/database.py backend/dce_cache.py backend/admin.py backend/test_dce_cache.py backend/test_admin.py frontend/src/admin/types.ts frontend/src/admin/pages/DceCache.tsx frontend/src/admin/pages/__tests__/DceCache.test.tsx frontend/src/admin/components/PipelineControls.tsx frontend/src/admin/components/ui.tsx
git commit -m "fix: verify scraper run control integration"
```

Expected:

- Commit succeeds if fixes were made.
- If no fixes were made, skip this commit.

---

## Self-Review Notes

- Spec coverage: Task 1 covers the hard 30-retrieval cap, log persistence, and preservation of existing stop conditions. Task 2 covers admin API progress. Task 3 covers desktop/mobile admin presentation. Task 4 covers verification.
- Placeholder scan: no red-flag planning language remains.
- Type consistency: backend uses `retrieval_limit` and `retrievals_attempted`; frontend uses the same names in `DceCacheRun`, `DceCacheProgress`, and `DceCacheStatus`.
