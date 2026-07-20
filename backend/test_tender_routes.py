import unittest

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


if __name__ == "__main__":
    unittest.main()
