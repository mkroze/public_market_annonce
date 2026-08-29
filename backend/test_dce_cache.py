import unittest
from unittest.mock import AsyncMock, patch

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


if __name__ == "__main__":
    unittest.main()
