import os
import shutil
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

import aiosqlite

import dce_cache


class EnsureDceCachedTest(unittest.IsolatedAsyncioTestCase):
    async def test_returns_cached_without_downloading(self):
        db = AsyncMock()
        with patch.object(dce_cache, "get_cached", AsyncMock(return_value=("/cache/x.zip", "x.zip"))), \
             patch.object(dce_cache, "download_dce", AsyncMock()) as dl:
            result = await dce_cache.ensure_dce_cached(db, "T1", "https://example.test/dce")

        self.assertEqual(result, ("/cache/x.zip", "x.zip"))
        dl.assert_not_awaited()  # cache hit must not hit the portal

    async def test_downloads_and_stores_on_miss(self):
        db = AsyncMock()
        with patch.object(dce_cache, "get_cached", AsyncMock(return_value=None)), \
             patch.object(dce_cache, "download_dce", AsyncMock(return_value=("ok", (b"PKzip", "DCE.zip")))), \
             patch.object(dce_cache, "_store", AsyncMock(return_value=("/cache/T1.zip", "DCE.zip"))) as store:
            result = await dce_cache.ensure_dce_cached(db, "T1", "https://example.test/dce")

        self.assertEqual(result, ("/cache/T1.zip", "DCE.zip"))
        store.assert_awaited_once()

    async def test_records_failure_and_returns_none(self):
        db = AsyncMock()
        with patch.object(dce_cache, "get_cached", AsyncMock(return_value=None)), \
             patch.object(dce_cache, "download_dce", AsyncMock(return_value=("failed", None))):
            result = await dce_cache.ensure_dce_cached(db, "T1", "https://example.test/dce")

        self.assertIsNone(result)
        # a 'failed' row is recorded so repeat clicks don't hammer the portal blindly
        db.execute.assert_awaited()


class DiskPathTest(unittest.TestCase):
    def test_slash_bearing_ids_get_safe_filenames(self):
        p = dce_cache._disk_path("org/ref/123")
        self.assertNotIn("/", p.rsplit("/", 1)[-1])  # basename has no stray slash
        self.assertTrue(p.endswith(".zip"))


class DceCacheCapAndClearTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.cachedir = os.path.join(self.tmpdir, "cache")
        self._dir_patch = patch.object(dce_cache, "DCE_CACHE_DIR", self.cachedir)
        self._dir_patch.start()
        self.db = await aiosqlite.connect(os.path.join(self.tmpdir, "t.db"))
        self.db.row_factory = aiosqlite.Row
        await self.db.execute(
            "CREATE TABLE dce_cache (tender_id TEXT PRIMARY KEY, filename TEXT, size INTEGER, "
            "status TEXT DEFAULT 'ok', error TEXT, cached_at TEXT DEFAULT (datetime('now')))"
        )
        await self.db.execute("CREATE TABLE tenders (id TEXT PRIMARY KEY, deadline TEXT, admin_status TEXT)")
        await self.db.commit()

    async def asyncTearDown(self):
        await self.db.close()
        self._dir_patch.stop()
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    async def test_evicts_oldest_when_over_cap(self):
        with patch.object(dce_cache, "DCE_CACHE_MAX_BYTES", 100):
            await dce_cache._store(self.db, "T1", b"x" * 60, "a.zip")
            await dce_cache._store(self.db, "T2", b"y" * 60, "b.zip")

        # T1 (oldest) is evicted so T2 fits under the 100-byte cap.
        self.assertIsNone(await dce_cache.get_cached(self.db, "T1"))
        self.assertIsNotNone(await dce_cache.get_cached(self.db, "T2"))
        self.assertEqual(await dce_cache.cache_total_bytes(self.db), 60)
        self.assertFalse(os.path.exists(dce_cache._disk_path("T1")))

    async def test_clear_all_removes_everything(self):
        await dce_cache._store(self.db, "T1", b"x" * 10, "a.zip")
        await dce_cache._store(self.db, "T2", b"y" * 10, "b.zip")

        res = await dce_cache.clear_dce_cache(self.db, mode="all")

        self.assertEqual(res["removed"], 2)
        self.assertEqual(await dce_cache.cache_total_bytes(self.db), 0)
        self.assertFalse(os.path.exists(dce_cache._disk_path("T1")))

    async def test_clear_outdated_keeps_active(self):
        await self.db.execute("INSERT INTO tenders (id, deadline, admin_status) VALUES ('T1', '01/01/2099 10:00', '')")
        await self.db.execute("INSERT INTO tenders (id, deadline, admin_status) VALUES ('T2', '01/01/2020 10:00', '')")
        await self.db.commit()
        await dce_cache._store(self.db, "T1", b"x" * 10, "a.zip")  # active (future deadline)
        await dce_cache._store(self.db, "T2", b"y" * 10, "b.zip")  # past deadline

        res = await dce_cache.clear_dce_cache(self.db, mode="outdated")

        self.assertEqual(res["removed"], 1)
        self.assertIsNotNone(await dce_cache.get_cached(self.db, "T1"))
        self.assertIsNone(await dce_cache.get_cached(self.db, "T2"))


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


if __name__ == "__main__":
    unittest.main()
