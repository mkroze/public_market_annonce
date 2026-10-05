# Parallel DCE Warm-All with Self-Throttling Backoff — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the admin DCE warm-all run in parallel and self-throttle downward when the portal pushes back, instead of a fixed serial loop with a 5–7s pause.

**Architecture:** Rewrite `cache_all_dces` as a series of resumable "sweeps." Each sweep runs `concurrency` async workers over the not-yet-cached tenders. A sweep ends on finish, on a terminal guard (cap / low disk), or on a "flag" (the portal pushing back). On a flag, pause then start the next sweep at one fewer thread — down to a floor of 1, where a further flag stops the run. Concurrency never increases. Single-IP throughout; no proxies.

**Tech Stack:** Python 3.12, `asyncio`, `aiosqlite`, `httpx`, `BeautifulSoup`; `unittest` (`IsolatedAsyncioTestCase`). FastAPI admin API + React/TS admin panel.

## Global Constraints

- **Single-IP only.** No proxy pool, no member sessions in this plan.
- **Concurrency is monotonically non-increasing per run.** Never ramp up.
- **Backoff floor = `DCE_WARM_MIN_THREADS` (default 1).** A flag at the floor stops the run cleanly (`status='stopped'`).
- **Flag vs local failure:** a *flag* is the portal pushing back on us (429/503/connection reset/CAPTCHA) → global backoff. A *local failure* is one malformed tender page (404, missing PAGESTATE, non-ZIP body) → count `failed`, keep going. One weird tender must never trigger backoff.
- **Terminal guards unchanged:** `DCE_CACHE_MAX_BYTES` (4 GB) and `DCE_MIN_FREE_BYTES` (500 MB) still stop the run as today.
- **`download_dce` typed contract:** `("ok", (bytes, filename))` | `("failed", None)` | `("flagged", reason_str)`. Nothing outside this contract crosses the function boundary.
- **Run backend tests from `backend/` with `venv/bin/python -m unittest <module> -v`.**
- **All commits end with the repo trailers:**
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01X7SpJN17UXutCaCLqXAF4M
  ```

## File Structure

- **`backend/config.py`** — add 4 backoff knobs; reduce the two delay defaults 5/7 → 1/2. (Task 1)
- **`backend/scraper.py`** — `download_dce` returns the typed result + a rate-limit marker constant. (Task 2)
- **`backend/test_download_dce.py`** *(new)* — classifier tests for `download_dce`. (Task 2)
- **`backend/dce_cache.py`** — `ensure_dce_cached` consumes the typed result (Task 3); `cache_all_dces` rewritten into sweep + backoff supervisor with `_run_sweep` / `_write_run_log` helpers (Task 5).
- **`backend/test_dce_cache.py`** — update two existing `ensure_dce_cached` tests (Task 3); add supervisor/backoff tests (Task 5).
- **`backend/database.py`** — migrate `dce_cache_log`: add `concurrency`, `pauses`. (Task 4)
- **`frontend/src/admin/types.ts`, `frontend/src/admin/pages/Imports.tsx`** — show Threads/Pauses in the run table. (Task 6)

---

### Task 1: Config knobs

**Files:**
- Modify: `backend/config.py` (the DCE cache block, currently ending at the `DCE_WARM_DELAY_MAX` line)

**Interfaces:**
- Produces (module constants, all `os.getenv`-overridable): `DCE_WARM_START_THREADS: int = 4`, `DCE_WARM_PAUSE_SECONDS: float = 60`, `DCE_WARM_BACKOFF_STEP: int = 1`, `DCE_WARM_MIN_THREADS: int = 1`, `DCE_WARM_DELAY_MIN: float = 1`, `DCE_WARM_DELAY_MAX: float = 2`.

- [ ] **Step 1: Reduce the delay defaults and add the backoff knobs**

Replace this exact block:

```python
# Variable pause between DCE downloads in a warm-all run so a bulk pull from one
# server IP doesn't hammer the portal (and risk an IP block). A fresh random
# value in [MIN, MAX] is drawn per download. Override via env.
DCE_WARM_DELAY_MIN = float(os.getenv("DCE_WARM_DELAY_MIN", "5"))  # seconds
DCE_WARM_DELAY_MAX = float(os.getenv("DCE_WARM_DELAY_MAX", "7"))  # seconds
```

with:

```python
# Per-download jitter in a warm-all run. Concurrency is now the throughput lever
# and downward backoff is the safety mechanism, so this only needs to add mild
# jitter (reduced from 5-7s). A fresh random value in [MIN, MAX] is drawn per
# download. Override via env.
DCE_WARM_DELAY_MIN = float(os.getenv("DCE_WARM_DELAY_MIN", "1"))  # seconds
DCE_WARM_DELAY_MAX = float(os.getenv("DCE_WARM_DELAY_MAX", "2"))  # seconds

# Parallel warm-all with downward-only self-throttling. Start at START_THREADS
# concurrent downloads; NEVER increase. On a portal push-back "flag", pause for
# PAUSE_SECONDS then resume with BACKOFF_STEP fewer threads, down to MIN_THREADS.
# A flag at MIN_THREADS stops the run. All env-overridable.
DCE_WARM_START_THREADS = int(os.getenv("DCE_WARM_START_THREADS", "4"))
DCE_WARM_PAUSE_SECONDS = float(os.getenv("DCE_WARM_PAUSE_SECONDS", "60"))
DCE_WARM_BACKOFF_STEP = int(os.getenv("DCE_WARM_BACKOFF_STEP", "1"))
DCE_WARM_MIN_THREADS = int(os.getenv("DCE_WARM_MIN_THREADS", "1"))
```

- [ ] **Step 2: Verify it imports with the expected values**

Run: `cd backend && venv/bin/python -c "import config as c; print(c.DCE_WARM_START_THREADS, c.DCE_WARM_PAUSE_SECONDS, c.DCE_WARM_BACKOFF_STEP, c.DCE_WARM_MIN_THREADS, c.DCE_WARM_DELAY_MIN, c.DCE_WARM_DELAY_MAX)"`
Expected: `4 60.0 1 1 1.0 2.0`

- [ ] **Step 3: Commit**

```bash
git add backend/config.py
git commit -m "feat(dce): add warm-all backoff knobs; reduce per-download jitter to 1-2s"
```

---

### Task 2: `download_dce` typed result + classifier

**Files:**
- Modify: `backend/scraper.py` (`download_dce`, lines ~299-406, and a new module constant near the top)
- Test: `backend/test_download_dce.py` (new)

**Interfaces:**
- Produces: `download_dce(dce_url: str) -> tuple[str, tuple[bytes, str] | str | None]`
  - `("ok", (file_bytes, filename))` on success
  - `("failed", None)` for a local, per-tender failure
  - `("flagged", reason)` where `reason ∈ {"http_429","http_503","conn_error","captcha"}`
- Produces: `scraper._RATE_LIMIT_MARKERS: tuple[str, ...]`

- [ ] **Step 1: Write the failing classifier tests**

Create `backend/test_download_dce.py`:

```python
import unittest
from unittest.mock import patch

import httpx

import scraper


def _resp(status=200, text="", content=b"", headers=None):
    """A stand-in httpx.Response whose raise_for_status mirrors real behavior."""
    r = httpx.Response(status, headers=headers or {}, content=content)
    r._text = text  # ensure .text returns our HTML even when content is bytes
    return r


class _FakeClient:
    """Returns queued responses for successive .get / .post calls; raises a
    queued exception instead if the queued item is an Exception."""
    def __init__(self, gets, posts):
        self._gets = list(gets)
        self._posts = list(posts)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def _next(self, q):
        item = q.pop(0)
        if isinstance(item, Exception):
            raise item
        return item

    async def get(self, *a, **k):
        return await self._next(self._gets)

    async def post(self, *a, **k):
        return await self._next(self._posts)


def _patch_client(gets, posts):
    fake = _FakeClient(gets, posts)
    return patch.object(scraper.httpx, "AsyncClient", lambda *a, **k: fake)


FORM_HTML = '<input id="PRADO_PAGESTATE" value="x"/>'


class DownloadDceClassifierTest(unittest.IsolatedAsyncioTestCase):
    async def test_http_429_is_flagged(self):
        with _patch_client([_resp(status=429)], []):
            self.assertEqual(await scraper.download_dce("http://t/dce"), ("flagged", "http_429"))

    async def test_http_503_is_flagged(self):
        with _patch_client([_resp(status=503)], []):
            self.assertEqual(await scraper.download_dce("http://t/dce"), ("flagged", "http_503"))

    async def test_connection_error_is_flagged(self):
        with _patch_client([httpx.ConnectError("boom")], []):
            self.assertEqual(await scraper.download_dce("http://t/dce"), ("flagged", "conn_error"))

    async def test_404_is_local_failure(self):
        with _patch_client([_resp(status=404)], []):
            self.assertEqual(await scraper.download_dce("http://t/dce"), ("failed", None))

    async def test_missing_pagestate_is_local_failure(self):
        with _patch_client([_resp(text="<html>no form</html>")], []):
            self.assertEqual(await scraper.download_dce("http://t/dce"), ("failed", None))

    async def test_captcha_page_is_flagged(self):
        # GET form -> POST form -> POST download returns an HTML captcha page (200).
        gets = [_resp(text=FORM_HTML)]
        posts = [_resp(text=FORM_HTML),
                 _resp(text="<html>Captcha: trop de requêtes</html>",
                       headers={"content-type": "text/html"})]
        with _patch_client(gets, posts):
            self.assertEqual(await scraper.download_dce("http://t/dce"), ("flagged", "captcha"))

    async def test_zip_is_ok(self):
        gets = [_resp(text=FORM_HTML)]
        posts = [_resp(text=FORM_HTML),
                 _resp(content=b"PK\x03\x04zipbytes",
                       headers={"content-type": "application/zip",
                                "content-disposition": 'attachment; filename="DCE.zip"'})]
        with _patch_client(gets, posts):
            status, payload = await scraper.download_dce("http://t/dce")
            self.assertEqual(status, "ok")
            self.assertEqual(payload, (b"PK\x03\x04zipbytes", "DCE.zip"))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && venv/bin/python -m unittest test_download_dce -v`
Expected: FAIL — `download_dce` currently returns `None`/`(bytes, name)`, so the tuple assertions fail.

- [ ] **Step 3: Add the rate-limit marker constant**

In `backend/scraper.py`, immediately after the imports block (after `from database import get_db`), add:

```python
# Substrings that mark a rate-limit / CAPTCHA interstitial served in place of a
# ZIP. Presence => the portal is pushing back on us (a "flag"), not a bad tender.
_RATE_LIMIT_MARKERS = ("captcha", "trop de requêtes", "trop de requetes", "access denied")
```

- [ ] **Step 4: Convert `download_dce` to the typed contract**

Make these exact replacements inside `download_dce`:

4a. Update the signature + docstring first line:

```python
async def download_dce(dce_url: str) -> tuple[bytes, str] | None:
    """Download the DCE ZIP by filling the form headlessly.

    Returns (file_bytes, filename) or None on failure.
```

→

```python
async def download_dce(dce_url: str) -> tuple[str, tuple[bytes, str] | str | None]:
    """Download the DCE ZIP by filling the form headlessly.

    Returns a typed result:
      ("ok", (file_bytes, filename)) on success
      ("failed", None)               local per-tender failure (skip this tender)
      ("flagged", reason)            portal pushing back (429/503/reset/captcha)
```

4b. First `return None` (missing initial PAGESTATE):

```python
            if not pagestate_el:
                print("[scraper] DCE: no PAGESTATE found")
                return None
```

→

```python
            if not pagestate_el:
                print("[scraper] DCE: no PAGESTATE found")
                return ("failed", None)
```

4c. Second `return None` (missing PAGESTATE after submit):

```python
            if not new_pagestate_el:
                print("[scraper] DCE: no PAGESTATE after form submit")
                return None
```

→

```python
            if not new_pagestate_el:
                print("[scraper] DCE: no PAGESTATE after form submit")
                return ("failed", None)
```

4d. The content-type / non-ZIP block:

```python
            ct = dl_resp.headers.get("content-type", "")
            if "zip" not in ct and "octet" not in ct and dl_resp.content[:2] != b"PK":
                print(f"[scraper] DCE: unexpected content-type: {ct}")
                return None
```

→

```python
            ct = dl_resp.headers.get("content-type", "")
            if "zip" not in ct and "octet" not in ct and dl_resp.content[:2] != b"PK":
                body_lower = dl_resp.text[:2000].lower()
                if any(m in body_lower for m in _RATE_LIMIT_MARKERS):
                    return ("flagged", "captcha")
                print(f"[scraper] DCE: unexpected content-type: {ct}")
                return ("failed", None)
```

4e. The success return:

```python
            return (dl_resp.content, filename)
```

→

```python
            return ("ok", (dl_resp.content, filename))
```

4f. The exception handler at the end of the function:

```python
    except Exception as e:
        print(f"[scraper] DCE download error: {e}")
        return None
```

→

```python
    except httpx.HTTPStatusError as e:
        code = e.response.status_code
        if code in (429, 503):
            return ("flagged", f"http_{code}")
        return ("failed", None)
    except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout,
            httpx.PoolTimeout, httpx.RemoteProtocolError):
        return ("flagged", "conn_error")
    except Exception as e:
        print(f"[scraper] DCE download error: {e}")
        return ("failed", None)
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && venv/bin/python -m unittest test_download_dce -v`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/scraper.py backend/test_download_dce.py
git commit -m "feat(dce): download_dce returns typed ok/failed/flagged result"
```

---

### Task 3: `ensure_dce_cached` consumes the typed result

**Files:**
- Modify: `backend/dce_cache.py` (`ensure_dce_cached`, lines ~116-137)
- Test: `backend/test_dce_cache.py` (update two existing tests)

**Interfaces:**
- Consumes: `download_dce(...) -> ("ok", (bytes, name)) | ("failed", None) | ("flagged", reason)` (Task 2)
- Produces: `ensure_dce_cached(db, tender_id: str, dce_url: str) -> tuple[str, str] | None` — signature and observable behavior unchanged (any non-`"ok"` result → `'failed'` row + `None`).

- [ ] **Step 1: Update the two existing tests to the typed contract**

In `backend/test_dce_cache.py`, in `test_downloads_and_stores_on_miss`, replace:

```python
             patch.object(dce_cache, "download_dce", AsyncMock(return_value=(b"PKzip", "DCE.zip"))), \
```

with:

```python
             patch.object(dce_cache, "download_dce", AsyncMock(return_value=("ok", (b"PKzip", "DCE.zip")))), \
```

In `test_records_failure_and_returns_none`, replace:

```python
             patch.object(dce_cache, "download_dce", AsyncMock(return_value=None)):
```

with:

```python
             patch.object(dce_cache, "download_dce", AsyncMock(return_value=("failed", None))):
```

- [ ] **Step 2: Run those tests to verify they fail**

Run: `cd backend && venv/bin/python -m unittest test_dce_cache.EnsureDceCachedTest -v`
Expected: FAIL — `ensure_dce_cached` still unpacks the old `result` shape, so `test_downloads_and_stores_on_miss` errors/does not store.

- [ ] **Step 3: Rewrite `ensure_dce_cached` to unpack the typed result**

Replace the body from `result = await download_dce(dce_url)` through the final `return await _store(...)`:

```python
    result = await download_dce(dce_url)
    if not result:
        await db.execute(
            """INSERT OR REPLACE INTO dce_cache (tender_id, filename, size, status, error, cached_at)
               VALUES (?, NULL, 0, 'failed', 'download failed', datetime('now'))""",
            (tender_id,),
        )
        await db.commit()
        return None

    file_bytes, filename = result
    return await _store(db, tender_id, file_bytes, filename)
```

→

```python
    status, payload = await download_dce(dce_url)
    if status != "ok":
        # Both "failed" and "flagged" collapse to the existing lazy behavior: a
        # 'failed' row so repeat clicks don't blindly re-hit the portal. The
        # flag distinction only matters to the warm-all supervisor (Task 5).
        await db.execute(
            """INSERT OR REPLACE INTO dce_cache (tender_id, filename, size, status, error, cached_at)
               VALUES (?, NULL, 0, 'failed', 'download failed', datetime('now'))""",
            (tender_id,),
        )
        await db.commit()
        return None

    file_bytes, filename = payload
    return await _store(db, tender_id, file_bytes, filename)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && venv/bin/python -m unittest test_dce_cache.EnsureDceCachedTest -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/dce_cache.py backend/test_dce_cache.py
git commit -m "refactor(dce): ensure_dce_cached consumes typed download_dce result"
```

---

### Task 4: Migrate `dce_cache_log` (concurrency + pauses)

**Files:**
- Modify: `backend/database.py` (the `CREATE TABLE ... dce_cache_log` block at ~line 94, and the migration section at ~line 207)

**Interfaces:**
- Produces: `dce_cache_log` has `concurrency INTEGER` and `pauses INTEGER DEFAULT 0` on both fresh and pre-existing databases.

- [ ] **Step 1: Add the columns to the CREATE TABLE (fresh DBs)**

In the `dce_cache_log` definition, replace:

```python
            status TEXT DEFAULT 'running',  -- running | done | failed | stopped
            error TEXT,
            actor_email TEXT
        );
```

with:

```python
            status TEXT DEFAULT 'running',  -- running | done | failed | stopped
            error TEXT,
            actor_email TEXT,
            concurrency INTEGER,            -- threads the run is currently at
            pauses INTEGER DEFAULT 0        -- times it flagged + backed off
        );
```

- [ ] **Step 2: Add idempotent migrations for existing DBs**

After the `scrape_log` migration lines (right before `await db.commit()` near the end of `init_db`), add:

```python
    # dce_cache_log: parallel warm-all observability
    await _add_column_if_missing(db, "dce_cache_log", "concurrency", "concurrency INTEGER")
    await _add_column_if_missing(db, "dce_cache_log", "pauses", "pauses INTEGER DEFAULT 0")
```

- [ ] **Step 3: Verify the migration adds the columns to an existing DB**

Run:
```bash
cd backend && venv/bin/python -c "
import asyncio, aiosqlite, tempfile, os
import database
async def main():
    d = tempfile.mkdtemp(); p = os.path.join(d, 't.db')
    database.DB_PATH = p  # point init at a temp file
    # simulate an OLD db: create dce_cache_log without the new columns
    db = await aiosqlite.connect(p)
    await db.execute('CREATE TABLE dce_cache_log (id INTEGER PRIMARY KEY, status TEXT)')
    await db.commit(); await db.close()
    await database.init_db()
    db = await aiosqlite.connect(p); db.row_factory = aiosqlite.Row
    cols = {r['name'] for r in await (await db.execute('PRAGMA table_info(dce_cache_log)')).fetchall()}
    await db.close()
    assert 'concurrency' in cols and 'pauses' in cols, cols
    print('OK migrated:', sorted(cols))
asyncio.run(main())
"
```
Expected: `OK migrated: [...]` including `concurrency` and `pauses` (no assertion error).

- [ ] **Step 4: Commit**

```bash
git add backend/database.py
git commit -m "feat(dce): add concurrency + pauses columns to dce_cache_log"
```

---

### Task 5: Sweep-based supervisor + downward backoff

**Files:**
- Modify: `backend/dce_cache.py` (imports at top; replace `cache_all_dces`, lines ~140-216; add `_run_sweep` and `_write_run_log` helpers)
- Test: `backend/test_dce_cache.py` (add `WarmAllBackoffTest`)

**Interfaces:**
- Consumes: `download_dce(...)` typed result (Task 2); `ensure_tender_details`, `get_cached`, `cache_total_bytes`, `_has_free_space`, `_store` (existing); config knobs from Task 1; `dce_cache_log.concurrency/pauses` (Task 4).
- Produces:
  - `cache_all_dces(actor_email: str | None = None) -> dict` — now returns `{"total","cached","skipped","failed","pauses","status"}`.
  - `_run_sweep(db, log_id: int, items: list[tuple[str, str]], concurrency: int, state: dict, counter_lock: asyncio.Lock) -> str` — returns `"finished" | "cap" | "disk" | "flagged"`.
  - `_write_run_log(db, log_id: int, state: dict, status: str) -> None`.

- [ ] **Step 1: Extend the imports**

At the top of `backend/dce_cache.py`, replace:

```python
from config import (
    DCE_CACHE_DIR,
    DCE_MIN_FREE_BYTES,
    DCE_CACHE_MAX_BYTES,
    DCE_WARM_DELAY_MIN,
    DCE_WARM_DELAY_MAX,
)
```

with:

```python
from config import (
    DCE_CACHE_DIR,
    DCE_MIN_FREE_BYTES,
    DCE_CACHE_MAX_BYTES,
    DCE_WARM_DELAY_MIN,
    DCE_WARM_DELAY_MAX,
    DCE_WARM_START_THREADS,
    DCE_WARM_PAUSE_SECONDS,
    DCE_WARM_BACKOFF_STEP,
    DCE_WARM_MIN_THREADS,
)
```

- [ ] **Step 2: Write the failing supervisor tests**

Add to `backend/test_dce_cache.py` (imports `os, shutil, tempfile, aiosqlite, unittest`, `AsyncMock, patch` are already present at the top of the file):

```python
class WarmAllBackoffTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmp = tempfile.mkdtemp()
        self.dbpath = os.path.join(self.tmp, "t.db")
        self.cachedir = os.path.join(self.tmp, "cache")
        self._patches = [
            patch.object(dce_cache, "DCE_CACHE_DIR", self.cachedir),
            patch.object(dce_cache, "DCE_WARM_PAUSE_SECONDS", 0),
            patch.object(dce_cache, "DCE_WARM_DELAY_MIN", 0),
            patch.object(dce_cache, "DCE_WARM_DELAY_MAX", 0),
            patch.object(dce_cache, "DCE_WARM_MIN_THREADS", 1),
            patch.object(dce_cache, "DCE_WARM_BACKOFF_STEP", 1),
            patch.object(dce_cache, "ensure_tender_details",
                         AsyncMock(return_value={"dce_url": "http://t/dce"})),
        ]
        for p in self._patches:
            p.start()

        db = await aiosqlite.connect(self.dbpath)
        db.row_factory = aiosqlite.Row
        await db.executescript(
            """
            CREATE TABLE tenders (id TEXT PRIMARY KEY, detail_url TEXT,
                                  deadline TEXT, admin_status TEXT);
            CREATE TABLE dce_cache (tender_id TEXT PRIMARY KEY, filename TEXT,
                                    size INTEGER, status TEXT DEFAULT 'ok',
                                    error TEXT, cached_at TEXT DEFAULT (datetime('now')));
            CREATE TABLE dce_cache_log (id INTEGER PRIMARY KEY AUTOINCREMENT,
                                        started_at TEXT DEFAULT (datetime('now')),
                                        finished_at TEXT, total INTEGER DEFAULT 0,
                                        cached INTEGER DEFAULT 0, skipped INTEGER DEFAULT 0,
                                        failed INTEGER DEFAULT 0, status TEXT DEFAULT 'running',
                                        error TEXT, actor_email TEXT,
                                        concurrency INTEGER, pauses INTEGER DEFAULT 0);
            """
        )
        for i in range(5):
            await db.execute(
                "INSERT INTO tenders (id, detail_url) VALUES (?, ?)",
                (f"T{i}", f"http://t/detail/{i}"),
            )
        await db.commit()
        await db.close()

        async def _fresh():
            c = await aiosqlite.connect(self.dbpath)
            c.row_factory = aiosqlite.Row
            return c

        self._getdb = patch.object(dce_cache, "get_db", _fresh)
        self._getdb.start()

    async def asyncTearDown(self):
        self._getdb.stop()
        for p in self._patches:
            p.stop()
        shutil.rmtree(self.tmp, ignore_errors=True)

    async def _last_log(self):
        db = await aiosqlite.connect(self.dbpath)
        db.row_factory = aiosqlite.Row
        row = await (await db.execute(
            "SELECT * FROM dce_cache_log ORDER BY id DESC LIMIT 1")).fetchone()
        await db.close()
        return dict(row)

    async def test_clean_run_holds_start_threads_and_never_ramps(self):
        ok = ("ok", (b"PK\x03\x04zip", "d.zip"))
        with patch.object(dce_cache, "DCE_WARM_START_THREADS", 3), \
             patch.object(dce_cache, "download_dce", AsyncMock(return_value=ok)):
            res = await dce_cache.cache_all_dces("admin@test")
        self.assertEqual(res["status"], "done")
        self.assertEqual(res["pauses"], 0)
        self.assertEqual(res["cached"], 5)
        log = await self._last_log()
        self.assertEqual(log["concurrency"], 3)  # never increased
        self.assertEqual(log["pauses"], 0)
        self.assertEqual(log["status"], "done")

    async def test_flag_pauses_then_resumes_at_fewer_threads(self):
        ok = ("ok", (b"PK\x03\x04zip", "d.zip"))
        seen = {"n": 0, "flagged": False}

        async def dl(url):
            seen["n"] += 1
            if seen["n"] == 2 and not seen["flagged"]:
                seen["flagged"] = True
                return ("flagged", "http_429")
            return ok

        with patch.object(dce_cache, "DCE_WARM_START_THREADS", 2), \
             patch.object(dce_cache, "download_dce", AsyncMock(side_effect=dl)):
            res = await dce_cache.cache_all_dces("admin@test")
        self.assertEqual(res["status"], "done")     # resumed and finished
        self.assertEqual(res["pauses"], 1)          # exactly one backoff
        self.assertEqual(res["cached"], 5)          # every tender cached eventually
        log = await self._last_log()
        self.assertEqual(log["concurrency"], 1)     # 2 -> 1 after the flag

    async def test_flag_at_floor_stops_run(self):
        with patch.object(dce_cache, "DCE_WARM_START_THREADS", 1), \
             patch.object(dce_cache, "download_dce",
                          AsyncMock(return_value=("flagged", "http_429"))):
            res = await dce_cache.cache_all_dces("admin@test")
        self.assertEqual(res["status"], "stopped")
        self.assertEqual(res["cached"], 0)
        self.assertGreaterEqual(res["pauses"], 1)
        log = await self._last_log()
        self.assertIn("pushing back", (log["error"] or ""))

    async def test_cap_reached_stops_run(self):
        ok = ("ok", (b"PK\x03\x04zip", "d.zip"))
        with patch.object(dce_cache, "DCE_WARM_START_THREADS", 1), \
             patch.object(dce_cache, "DCE_CACHE_MAX_BYTES", 1), \
             patch.object(dce_cache, "download_dce", AsyncMock(return_value=ok)):
            res = await dce_cache.cache_all_dces("admin@test")
        self.assertEqual(res["status"], "stopped")
        self.assertGreaterEqual(res["cached"], 1)
        log = await self._last_log()
        self.assertIn("cap", (log["error"] or "").lower())
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd backend && venv/bin/python -m unittest test_dce_cache.WarmAllBackoffTest -v`
Expected: FAIL — current `cache_all_dces` has no sweeps/backoff, returns no `pauses` key, and never writes `concurrency`.

- [ ] **Step 4: Replace `cache_all_dces` and add the two helpers**

Replace the entire existing `cache_all_dces` function (from its `async def` through its `return {...}`) with:

```python
async def _write_run_log(db, log_id: int, state: dict, status: str) -> None:
    """Flush the in-memory counters to dce_cache_log so the polling admin UI
    stays fresh. Status stays 'running' for the whole run; the terminal status
    is written once in cache_all_dces's finally block."""
    await db.execute(
        """UPDATE dce_cache_log
           SET total=?, cached=?, skipped=?, failed=?, pauses=?, concurrency=?, status=?
           WHERE id=?""",
        (state["total"], state["cached"], state["skipped"], state["failed"],
         state["pauses"], state["concurrency"], status, log_id),
    )
    await db.commit()


async def _run_sweep(db, log_id: int, items, concurrency: int,
                     state: dict, counter_lock) -> str:
    """Run one sweep over `items` (uncached tenders) with `concurrency` workers.

    Workers share the single aiosqlite connection (aiosqlite serializes SQL, so
    concurrent DB calls are safe); network I/O runs truly in parallel because
    download_dce opens its own client per call. Returns the sweep outcome:
    "finished" | "cap" | "disk" | "flagged". On a terminal/flag outcome, workers
    drain their in-flight download then stop pulling new work.
    """
    queue: asyncio.Queue = asyncio.Queue()
    for item in items:
        queue.put_nowait(item)
    stop = {"reason": None}  # "cap" | "disk" | "flagged"

    async def worker():
        while stop["reason"] is None:
            try:
                tender_id, detail_url = queue.get_nowait()
            except asyncio.QueueEmpty:
                return
            try:
                if await get_cached(db, tender_id):
                    async with counter_lock:
                        state["skipped"] += 1
                    continue
                if await cache_total_bytes(db) >= DCE_CACHE_MAX_BYTES:
                    stop["reason"] = "cap"
                    return
                if not _has_free_space():
                    stop["reason"] = "disk"
                    return

                detail = await ensure_tender_details(db, tender_id, detail_url)
                dce_url = (detail or {}).get("dce_url", "")
                if not dce_url:
                    async with counter_lock:
                        state["skipped"] += 1
                    continue

                dl_status, payload = await download_dce(dce_url)
                if dl_status == "flagged":
                    stop["reason"] = "flagged"
                    return  # no row written -> retried next sweep
                if dl_status == "failed":
                    await db.execute(
                        """INSERT OR REPLACE INTO dce_cache
                           (tender_id, filename, size, status, error, cached_at)
                           VALUES (?, NULL, 0, 'failed', 'download failed', datetime('now'))""",
                        (tender_id,),
                    )
                    await db.commit()
                    async with counter_lock:
                        state["failed"] += 1
                    continue

                file_bytes, filename = payload
                await _store(db, tender_id, file_bytes, filename)
                async with counter_lock:
                    state["cached"] += 1
                await _write_run_log(db, log_id, state, "running")
                await asyncio.sleep(random.uniform(DCE_WARM_DELAY_MIN, DCE_WARM_DELAY_MAX))
            finally:
                queue.task_done()

    workers = [asyncio.create_task(worker()) for _ in range(max(1, concurrency))]
    await asyncio.gather(*workers)
    return stop["reason"] or "finished"


async def cache_all_dces(actor_email: str | None = None) -> dict:
    """Warm the cache for every tender in parallel, self-throttling downward.

    Runs in resumable sweeps. Each sweep uses `concurrency` workers; on a portal
    push-back "flag" it pauses then resumes with fewer threads (never more), down
    to DCE_WARM_MIN_THREADS where a further flag stops the run. Still stops on the
    size cap or low disk. Skips already-cached tenders, so a lower-concurrency
    resume just continues where the last sweep left off.
    """
    async with dce_cache_lock:
        db = await get_db()
        concurrency = DCE_WARM_START_THREADS
        log_cursor = await db.execute(
            "INSERT INTO dce_cache_log (status, actor_email, concurrency, pauses) "
            "VALUES ('running', ?, ?, 0)",
            (actor_email, concurrency),
        )
        log_id = log_cursor.lastrowid
        await db.commit()

        state = {"total": 0, "cached": 0, "skipped": 0, "failed": 0,
                 "pauses": 0, "concurrency": concurrency}
        counter_lock = asyncio.Lock()
        final_status = "done"
        err = None

        try:
            rows = await (await db.execute(
                "SELECT id, detail_url FROM tenders "
                "WHERE detail_url IS NOT NULL AND detail_url != ''"
            )).fetchall()
            items = [(r["id"], r["detail_url"]) for r in rows]
            state["total"] = len(items)

            while True:
                outcome = await _run_sweep(db, log_id, items, concurrency, state, counter_lock)
                if outcome == "finished":
                    final_status = "done"
                    break
                if outcome == "cap":
                    final_status = "stopped"
                    err = "Cache size cap reached — remaining DCEs will cache on demand."
                    break
                if outcome == "disk":
                    final_status = "stopped"
                    err = "Low disk space — stopped to protect the volume."
                    break
                # outcome == "flagged": back off one step, or stop at the floor.
                state["pauses"] += 1
                concurrency -= DCE_WARM_BACKOFF_STEP
                if concurrency < DCE_WARM_MIN_THREADS:
                    final_status = "stopped"
                    err = "Portal pushing back even at the minimum thread count — try again later."
                    break
                state["concurrency"] = concurrency
                await _write_run_log(db, log_id, state, "running")
                await asyncio.sleep(DCE_WARM_PAUSE_SECONDS)
        except Exception as e:  # noqa: BLE001
            final_status = "failed"
            err = str(e)[:500]
        finally:
            await db.execute(
                """UPDATE dce_cache_log
                   SET finished_at = datetime('now'),
                       total=?, cached=?, skipped=?, failed=?, pauses=?, concurrency=?,
                       status=?, error=?
                   WHERE id = ?""",
                (state["total"], state["cached"], state["skipped"], state["failed"],
                 state["pauses"], state["concurrency"], final_status, err, log_id),
            )
            await db.commit()
            await db.close()

        return {"total": state["total"], "cached": state["cached"],
                "skipped": state["skipped"], "failed": state["failed"],
                "pauses": state["pauses"], "status": final_status}
```

- [ ] **Step 5: Run the new tests to verify they pass**

Run: `cd backend && venv/bin/python -m unittest test_dce_cache.WarmAllBackoffTest -v`
Expected: PASS (4 tests).

- [ ] **Step 6: Run the whole DCE + scraper test set for regressions**

Run: `cd backend && venv/bin/python -m unittest test_dce_cache test_download_dce -v`
Expected: PASS (all: 3 ensure + 1 diskpath + 3 cap/clear + 4 backoff + 7 classifier).

- [ ] **Step 7: Commit**

```bash
git add backend/dce_cache.py backend/test_dce_cache.py
git commit -m "feat(dce): parallel warm-all with downward-only self-throttling backoff"
```

---

### Task 6: Surface Threads + Pauses in the admin panel

**Files:**
- Modify: `frontend/src/admin/types.ts` (`DceCacheRun`, lines ~16-27)
- Modify: `frontend/src/admin/pages/Imports.tsx` (the DCE runs table header ~lines 312-321 and body ~lines 326-334)

**Interfaces:**
- Consumes: the `/dce-cache` GET payload rows, which now include `concurrency` and `pauses` (they flow through automatically because the endpoint returns `dict(r)` per row — no backend change needed here).

- [ ] **Step 1: Add the fields to the `DceCacheRun` type**

Replace:

```typescript
  status: string; // running | done | failed | stopped
  error: string | null;
  actor_email: string | null;
}
```

with:

```typescript
  status: string; // running | done | failed | stopped
  error: string | null;
  actor_email: string | null;
  concurrency: number | null;
  pauses: number | null;
}
```

- [ ] **Step 2: Add the two header cells**

In `Imports.tsx`, in the DCE runs table `<thead>`, replace:

```tsx
                    <th scope="col" className="px-4 py-2 font-medium text-right tabular-nums">Cached</th>
                    <th scope="col" className="px-4 py-2 font-medium text-right tabular-nums">Skipped</th>
```

with:

```tsx
                    <th scope="col" className="px-4 py-2 font-medium text-right tabular-nums">Threads</th>
                    <th scope="col" className="px-4 py-2 font-medium text-right tabular-nums">Pauses</th>
                    <th scope="col" className="px-4 py-2 font-medium text-right tabular-nums">Cached</th>
                    <th scope="col" className="px-4 py-2 font-medium text-right tabular-nums">Skipped</th>
```

- [ ] **Step 3: Add the two body cells**

In the DCE runs `<tbody>`, replace:

```tsx
                      <td className="px-4 py-2 text-right tabular-nums">{run.cached}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{run.skipped}</td>
```

with:

```tsx
                      <td className="px-4 py-2 text-right tabular-nums">{run.concurrency ?? "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{run.pauses ?? 0}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{run.cached}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{run.skipped}</td>
```

- [ ] **Step 4: Verify the frontend builds**

Run: `cd frontend && npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/admin/types.ts frontend/src/admin/pages/Imports.tsx
git commit -m "feat(admin): show warm-all threads + pauses in DCE cache panel"
```

---

## Self-Review

**1. Spec coverage:**
- Sweep-based parallel warm-all → Task 5. ✓
- Downward-only backoff state machine (pause, −1 thread, floor 1, stop at floor) → Task 5 (`cache_all_dces` loop) + tests. ✓
- Flag vs local-failure classification → Task 2 (`download_dce`) + Task 5 (worker routing). ✓
- `download_dce` typed return → Task 2; lazy path updated → Task 3. ✓
- Config knobs (start/pause/step/floor) + delay 5–7 → 1–2 → Task 1. ✓
- `dce_cache_log` concurrency/pauses columns → Task 4; surfaced in UI → Task 6. ✓
- Terminal guards (cap/disk) unchanged → preserved in Task 5 worker + covered by `test_cap_reached_stops_run`. ✓
- Counter consistency across workers → `counter_lock` in Task 5. ✓

**2. Placeholder scan:** No TBD/TODO/"handle errors"/"similar to". Every code step shows full old→new content. ✓

**3. Type consistency:** `download_dce` returns `(status, payload)` everywhere it's consumed (`ensure_dce_cached` Task 3, worker Task 5). `_run_sweep` returns the string literals the `cache_all_dces` loop branches on (`finished`/`cap`/`disk`/`flagged`). `state` keys (`total/cached/skipped/failed/pauses/concurrency`) match between `_run_sweep`, `_write_run_log`, and the final UPDATE. Frontend `concurrency/pauses` are `number | null`, rendered with `?? "—"` / `?? 0`. ✓

**Deviations from spec (intentional, minor):** (a) status stays `'running'` during a backoff pause rather than a new `'paused'` status — the `pauses` counter + dropping `concurrency` convey it, and this keeps the admin error-cleanup query (`WHERE status='running'`) valid. (b) On flag/terminal, in-flight workers drain their current download then stop, rather than hard-cancelling — simpler and avoids partial writes; at most `concurrency−1` extra in-flight requests, all already open.
