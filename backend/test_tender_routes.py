import unittest
from unittest.mock import AsyncMock, patch

from starlette.routing import Match

from main import app


class TenderRouteTest(unittest.TestCase):
    def test_slash_bearing_tender_ids_match_detail_and_download_routes(self):
        expected_endpoints = {
            "/api/tenders/A/B": "get_tender",
            "/api/tenders/A/B/pdf": "export_tender_pdf",
            "/api/tenders/A/B/dce": "download_tender_dce",
        }

        for path, expected_endpoint in expected_endpoints.items():
            with self.subTest(path=path):
                scope = {
                    "type": "http",
                    "method": "GET",
                    "path": path,
                    "headers": [],
                    "query_string": b"",
                    "scheme": "http",
                    "server": ("testserver", 80),
                    "client": ("testclient", 50000),
                    "root_path": "",
                    "http_version": "1.1",
                }
                endpoints = [
                    route.endpoint.__name__
                    for route in app.routes
                    if route.matches(scope)[0] == Match.FULL
                ]

                self.assertTrue(endpoints)
                self.assertEqual(endpoints[0], expected_endpoint)


class TenderDetailApiTest(unittest.IsolatedAsyncioTestCase):
    async def test_get_tender_uses_stored_details_without_scraping(self):
        import main

        class Cursor:
            def __init__(self, row):
                self.row = row

            async def fetchone(self):
                return self.row

        class Db:
            def __init__(self):
                self.calls = []

            async def execute(self, query, params=()):
                self.calls.append((query, params))
                if "FROM tenders WHERE id" in query:
                    return Cursor({
                        "id": "T1",
                        "reference": "REF-1",
                        "title": "Travaux de voirie - Commune de Zegzel",
                        "entity": "COMMUNE DE ZEGZEL",
                        "location": "BERKANE",
                        "procedure_type": "AOO",
                        "category": "Travaux",
                        "deadline": "15/09/2026 10:00",
                        "detail_url": "https://example.test/detail",
                    })
                if "FROM tender_details WHERE tender_id" in query:
                    return Cursor({
                        "tender_id": "T1",
                        "objet": "Travaux de voirie - Commune de Zegzel",
                        "acheteur": "Commune de Zegzel",
                        "lieu_execution": "Commune de Zegzel",
                        "procedure": "Appel d'offres ouvert",
                        "categorie": "Travaux",
                        "estimation": "1 200 000,00 MAD",
                        "caution_provisoire": "20 000,00 MAD",
                        "prix_plans": "0,00 MAD",
                        "dce_url": "https://example.test/dce",
                    })
                return Cursor(None)

            async def close(self):
                pass

        db = Db()
        with patch.object(main, "get_db", AsyncMock(return_value=db)), patch.object(
            main, "ensure_tender_details", AsyncMock()
        ) as ensure:
            response = await main.get_tender("T1")

        ensure.assert_not_called()
        self.assertEqual(response["details"]["objet"], "Travaux de voirie - Commune de Zegzel")
        self.assertEqual(response["display"]["title"]["value"], "Travaux de voirie")
        self.assertEqual(response["signals"]["estimation"]["status"], "detected")
        self.assertEqual(response["signals"]["dce_available"]["value"], True)

    async def test_get_tender_base_only_still_returns_display_and_signals(self):
        import main

        class Cursor:
            def __init__(self, row):
                self.row = row

            async def fetchone(self):
                return self.row

        class Db:
            async def execute(self, query, params=()):
                if "FROM tenders WHERE id" in query:
                    return Cursor({
                        "id": "T2",
                        "reference": "REF-2",
                        "title": "Fourniture de mobilier",
                        "entity": "Province de Safi",
                        "location": "SAFI",
                        "procedure_type": "AOO",
                        "category": "Fournitures",
                        "deadline": "20/09/2026 09:00",
                        "detail_url": "",
                    })
                if "FROM tender_details WHERE tender_id" in query:
                    return Cursor(None)
                return Cursor(None)

            async def close(self):
                pass

        with patch.object(main, "get_db", AsyncMock(return_value=Db())):
            response = await main.get_tender("T2")

        self.assertNotIn("details", response)
        self.assertEqual(response["display"]["title"]["value"], "Fourniture de mobilier")
        self.assertEqual(response["signals"]["estimation"]["status"], "missing")

    async def test_get_tender_lazily_scrapes_missing_details_for_dce_url(self):
        import main

        class Cursor:
            def __init__(self, row):
                self.row = row

            async def fetchone(self):
                return self.row

        class Db:
            async def execute(self, query, params=()):
                if "FROM tenders WHERE id" in query:
                    return Cursor({
                        "id": "T3",
                        "reference": "REF-3",
                        "title": "Travaux de signalisation",
                        "entity": "Commune de Test",
                        "location": "RABAT",
                        "procedure_type": "AOO",
                        "category": "Travaux",
                        "deadline": "22/09/2026 10:00",
                        "detail_url": "https://example.test/detail",
                    })
                if "FROM tender_details WHERE tender_id" in query:
                    return Cursor(None)
                return Cursor(None)

            async def close(self):
                pass

        scraped_detail = {
            "tender_id": "T3",
            "objet": "Travaux de signalisation",
            "acheteur": "Commune de Test",
            "lieu_execution": "Rabat",
            "procedure": "Appel d'offres ouvert",
            "categorie": "Travaux",
            "dce_url": "https://example.test/dce",
        }

        db = Db()
        with patch.object(main, "get_db", AsyncMock(return_value=db)), patch.object(
            main, "ensure_tender_details", AsyncMock(return_value=scraped_detail)
        ) as ensure:
            response = await main.get_tender("T3")

        ensure.assert_awaited_once_with(db, "T3", "https://example.test/detail")
        self.assertEqual(response["details"]["dce_url"], "https://example.test/dce")
        self.assertEqual(response["signals"]["dce_available"]["value"], True)


class DceDownloadRouteTest(unittest.IsolatedAsyncioTestCase):
    def _db(self, dce_url):
        class Cursor:
            async def fetchone(self):
                return {"dce_url": dce_url}

        class Db:
            async def execute(self, query, params=()):
                return Cursor()

            async def close(self):
                pass

        return Db()

    async def test_download_dce_serves_cached_file(self):
        import os
        import tempfile
        import main
        from fastapi.responses import FileResponse

        tmp = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
        tmp.write(b"PK\x03\x04cached-zip")
        tmp.close()
        try:
            with patch.object(main, "get_db", AsyncMock(return_value=self._db("https://example.test/dce"))), \
                 patch.object(main, "ensure_dce_cached", AsyncMock(return_value=(tmp.name, "DCE AO 03.zip"))) as ensure:
                resp = await main.download_tender_dce("T9")

            ensure.assert_awaited_once()
            _db_arg, tid, url = ensure.await_args.args
            self.assertEqual((tid, url), ("T9", "https://example.test/dce"))
            self.assertIsInstance(resp, FileResponse)
            self.assertEqual(resp.path, tmp.name)
            self.assertEqual(resp.media_type, "application/zip")
        finally:
            os.unlink(tmp.name)

    async def test_download_dce_404_when_no_url(self):
        import main
        with patch.object(main, "get_db", AsyncMock(return_value=self._db(""))):
            resp = await main.download_tender_dce("T9")
        self.assertEqual(resp.status_code, 404)

    async def test_download_dce_502_when_fetch_fails(self):
        import main
        with patch.object(main, "get_db", AsyncMock(return_value=self._db("https://example.test/dce"))), \
             patch.object(main, "ensure_dce_cached", AsyncMock(return_value=None)):
            resp = await main.download_tender_dce("T9")
        self.assertEqual(resp.status_code, 502)


if __name__ == "__main__":
    unittest.main()
