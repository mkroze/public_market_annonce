import unittest

from fastapi.testclient import TestClient

from main import app


class V1ApiSurfaceTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_non_catalog_api_routes_are_not_accessible(self):
        blocked_paths = [
            "/api/auth/login",
            "/api/alerts",
            "/api/favorites",
            "/api/stats",
            "/api/cities",
            "/api/regions",
            "/api/sectors",
            "/api/blog",
            "/api/assistant/ask",
            "/api/scrape/status",
        ]

        for path in blocked_paths:
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 404)

    def test_catalog_api_routes_remain_addressable(self):
        allowed_paths = [
            "/api/tenders",
            "/api/tenders/export",
            "/api/filters",
        ]

        for path in allowed_paths:
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertNotEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
