import unittest

from fastapi.testclient import TestClient

from main import app


class V1ApiSurfaceTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_non_catalog_api_routes_are_not_accessible(self):
        # Retired public features stay blocked. Public registration is closed
        # for launch, so /api/auth/register is blocked too.
        blocked_paths = [
            "/api/auth/register",
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

    def test_admin_surface_is_reachable_but_gated(self):
        # The admin plane ships with the launch: its routes must not be 404'd by
        # the catalog guard, but must reject unauthenticated access.
        response = self.client.get("/api/admin/overview")
        self.assertNotEqual(response.status_code, 404)
        self.assertIn(response.status_code, (401, 403))

    def test_admin_login_endpoints_are_reachable(self):
        # Login/session endpoints must remain addressable so admins can sign in.
        for path in ("/api/auth/login", "/api/auth/me"):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertNotEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
