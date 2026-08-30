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
             patch.object(dce_cache, "download_dce", AsyncMock(return_value=(b"PKzip", "DCE.zip"))), \
             patch.object(dce_cache, "_store", AsyncMock(return_value=("/cache/T1.zip", "DCE.zip"))) as store:
            result = await dce_cache.ensure_dce_cached(db, "T1", "https://example.test/dce")

        self.assertEqual(result, ("/cache/T1.zip", "DCE.zip"))
        store.assert_awaited_once()

    async def test_records_failure_and_returns_none(self):
        db = AsyncMock()
        with patch.object(dce_cache, "get_cached", AsyncMock(return_value=None)), \
             patch.object(dce_cache, "download_dce", AsyncMock(return_value=None)):
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


if __name__ == "__main__":
    unittest.main()
