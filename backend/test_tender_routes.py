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


if __name__ == "__main__":
    unittest.main()
