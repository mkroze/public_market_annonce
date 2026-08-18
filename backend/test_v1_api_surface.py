import unittest

from fastapi.testclient import TestClient

from main import app


class V1ApiSurfaceTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_retired_public_routes_are_not_accessible(self):
        # Retired public features stay removed from the surface (404).
        blocked_paths = [
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

    def test_catalog_requires_authentication(self):
        # Registration unlocks the catalog and a signed-in user's alerts: the
        # data is reachable (not 404) but rejects unauthenticated requests (401).
        gated_paths = [
            "/api/tenders",
            "/api/tenders/export",
            "/api/filters",
            "/api/alerts",
        ]

        for path in gated_paths:
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 401)

    def test_auth_entry_points_are_public(self):
        # Login and registration must be reachable without a session so users
        # can obtain one. They are POST endpoints, so a GET resolves the route
        # (405) rather than being blocked (404) or gated (401).
        for path in ("/api/auth/login", "/api/auth/register"):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertNotIn(response.status_code, (401, 404))

    def test_admin_surface_is_reachable_but_gated(self):
        # The admin export space ships with the launch: its routes must not be
        # 404'd by the catalog guard, but must reject unauthenticated access.
        response = self.client.get("/api/admin/overview")
        self.assertNotEqual(response.status_code, 404)
        self.assertIn(response.status_code, (401, 403))


if __name__ == "__main__":
    unittest.main()
