import unittest

from fastapi.testclient import TestClient

from main import app


class V1ApiSurfaceTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_root_redirects_to_public_catalog(self):
        response = self.client.get("/", follow_redirects=False)

        self.assertIn(response.status_code, (302, 307))
        self.assertEqual(response.headers["location"], "/tenders")

    def test_retired_public_routes_are_not_accessible(self):
        # Retired public features stay removed from the surface (404).
        blocked_paths = [
            "/api/stats",
            "/api/cities",
            "/api/regions",
            "/api/sectors",
            "/api/blog",
            "/api/scrape/status",
        ]

        for path in blocked_paths:
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 404)

    def test_catalog_read_routes_are_public(self):
        public_read_paths = [
            "/api/tenders",
            "/api/filters",
        ]

        for path in public_read_paths:
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertNotEqual(response.status_code, 401)
                self.assertNotEqual(response.status_code, 404)

    def test_catalog_actions_still_require_authentication(self):
        gated_paths = [
            "/api/tenders/export",
            "/api/tenders/A/B/pdf",
            "/api/tenders/A/B/dce",
            "/api/alerts",
            "/api/favorites",
            "/api/saved-searches",
            "/api/assistant/ask",
            "/api/auth/resend-verification",
        ]

        for path in gated_paths:
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 401)

    def test_slash_bearing_tender_detail_is_public_read_path(self):
        import main

        self.assertTrue(main.is_public_v1_api_path("/api/tenders/A/B", "GET"))
        self.assertFalse(main.requires_v1_auth("/api/tenders/A/B", "GET"))
        self.assertFalse(main.is_public_v1_api_path("/api/tenders/A/B/pdf", "GET"))
        self.assertTrue(main.requires_v1_auth("/api/tenders/A/B/pdf", "GET"))

    def test_auth_entry_points_are_public(self):
        # Login and registration must be reachable without a session so users
        # can obtain one. They are POST endpoints, so a GET resolves the route
        # (405) rather than being blocked (404) or gated (401).
        public_auth_paths = (
            "/api/auth/login",
            "/api/auth/register",
            "/api/auth/verify-email",
            "/api/auth/request-password-reset",
            "/api/auth/reset-password",
        )
        for path in public_auth_paths:
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
