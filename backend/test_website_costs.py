"""Website cost admin tests: schema, RBAC, API behavior, and audit logging."""

import asyncio
import os
import tempfile
import unittest

_tmp_dir = tempfile.mkdtemp()
os.environ.setdefault("ADMIN_EMAILS", "")

import config  # noqa: E402
config.DB_PATH = os.path.join(_tmp_dir, "test_website_costs.db")

from fastapi.testclient import TestClient  # noqa: E402

import database  # noqa: E402
database.DB_PATH = config.DB_PATH

import admin  # noqa: E402
from auth import create_token, hash_password  # noqa: E402
import main  # noqa: E402


def run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _reset_db():
    if os.path.exists(config.DB_PATH):
        os.remove(config.DB_PATH)
    await database.init_db()


async def _make_user(email, role="user", status="active", password="pw"):
    db = await database.get_db()
    cur = await db.execute(
        "INSERT INTO users (email, password_hash, name, role, status) VALUES (?, ?, ?, ?, ?)",
        (email, hash_password(password), email.split("@")[0], role, status),
    )
    await db.commit()
    uid = cur.lastrowid
    await db.close()
    return uid


def _auth(uid, email):
    return {"Authorization": f"Bearer {create_token(uid, email)}"}


async def _audit_count(action):
    db = await database.get_db()
    row = await (await db.execute(
        "SELECT COUNT(*) FROM admin_audit_logs WHERE action = ?",
        (action,),
    )).fetchone()
    await db.close()
    return row[0]


class WebsiteCostsSchemaAndAccessTest(unittest.TestCase):
    def setUp(self):
        run(_reset_db())
        self.client = TestClient(main.app)

    def test_init_db_creates_website_costs_table_and_indexes(self):
        async def inspect():
            db = await database.get_db()
            cols = await (await db.execute("PRAGMA table_info(website_costs)")).fetchall()
            indexes = await (await db.execute("PRAGMA index_list(website_costs)")).fetchall()
            await db.close()
            return {row["name"] for row in cols}, {row["name"] for row in indexes}

        columns, indexes = run(inspect())
        self.assertIn("provider", columns)
        self.assertIn("amount_minor", columns)
        self.assertIn("currency", columns)
        self.assertIn("archived_at", columns)
        self.assertIn("idx_website_costs_status", indexes)
        self.assertIn("idx_website_costs_due_date", indexes)
        self.assertIn("idx_website_costs_category", indexes)

    def test_backend_role_permissions_for_costs(self):
        self.assertTrue(admin.has_permission("owner", "costs.view"))
        self.assertTrue(admin.has_permission("owner", "costs.manage"))
        self.assertTrue(admin.has_permission("admin", "costs.view"))
        self.assertTrue(admin.has_permission("admin", "costs.manage"))
        self.assertTrue(admin.has_permission("auditor", "costs.view"))
        self.assertFalse(admin.has_permission("auditor", "costs.manage"))
        self.assertFalse(admin.has_permission("operator", "costs.view"))
        self.assertFalse(admin.has_permission("support", "costs.view"))

    def test_costs_summary_requires_authentication(self):
        r = self.client.get("/api/admin/costs/summary")
        self.assertEqual(r.status_code, 401)

    def test_operator_cannot_view_costs_and_denial_is_audited(self):
        uid = run(_make_user("operator@x.com", role="operator"))
        r = self.client.get("/api/admin/costs/summary", headers=_auth(uid, "operator@x.com"))
        self.assertEqual(r.status_code, 403)
        self.assertGreaterEqual(run(_audit_count("admin.access_denied")), 1)


class WebsiteCostsReadApiTest(unittest.TestCase):
    def setUp(self):
        run(_reset_db())
        self.client = TestClient(main.app)
        self.owner_id = run(_make_user("owner@x.com", role="owner"))
        self.owner_headers = _auth(self.owner_id, "owner@x.com")
        self.auditor_id = run(_make_user("auditor@x.com", role="auditor"))
        self.auditor_headers = _auth(self.auditor_id, "auditor@x.com")

    def seed_costs(self):
        async def seed():
            db = await database.get_db()
            await db.executemany(
                """INSERT INTO website_costs
                   (provider, category, description, amount_minor, currency, billing_cycle,
                    service_period_start, service_period_end, due_date, paid_date, status,
                    reference, notes, created_by, updated_by, archived_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                [
                    ("OpenAI", "ai_api", "Assistant usage", 4320, "USD", "usage_based",
                     "2026-09-01", "2026-09-30", "2026-10-05", None, "due",
                     "OPENAI-2026-09", "September usage", "owner@x.com", "owner@x.com", None),
                    ("Brevo", "email", "SMTP monthly", 19000, "MAD", "monthly",
                     "2026-09-01", "2026-09-30", "2026-09-25", "2026-09-10", "paid",
                     "BREVO-09", "", "owner@x.com", "owner@x.com", None),
                    ("Old Tool", "software", "Archived old SaaS", 1000, "EUR", "monthly",
                     "2026-09-01", "2026-09-30", "2026-09-15", None, "cancelled",
                     "OLD-1", "", "owner@x.com", "owner@x.com", "2026-09-12 10:00:00"),
                ],
            )
            await db.commit()
            await db.close()

        run(seed())

    def test_auditor_can_read_costs_summary(self):
        self.seed_costs()
        r = self.client.get("/api/admin/costs/summary", headers=self.auditor_headers)
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertIn("current_month", body)
        self.assertIn("annualized_recurring", body)
        self.assertNotIn("EUR", body["current_month"])

    def test_list_costs_filters_archived_by_default_and_searches(self):
        self.seed_costs()
        r = self.client.get("/api/admin/costs?q=openai", headers=self.owner_headers)
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["total"], 1)
        self.assertEqual(body["data"][0]["provider"], "OpenAI")
        self.assertEqual(body["data"][0]["amount_minor"], 4320)

    def test_list_costs_filters_by_category_status_and_currency(self):
        self.seed_costs()
        r = self.client.get(
            "/api/admin/costs?category=email&status=paid&currency=MAD",
            headers=self.owner_headers,
        )
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["total"], 1)
        self.assertEqual(body["data"][0]["provider"], "Brevo")


class WebsiteCostsMutationApiTest(unittest.TestCase):
    def setUp(self):
        run(_reset_db())
        self.client = TestClient(main.app)
        self.owner_id = run(_make_user("owner@x.com", role="owner"))
        self.owner_headers = _auth(self.owner_id, "owner@x.com")
        self.auditor_id = run(_make_user("auditor@x.com", role="auditor"))
        self.auditor_headers = _auth(self.auditor_id, "auditor@x.com")

    def valid_payload(self):
        return {
            "provider": "OpenAI",
            "category": "ai_api",
            "description": "Assistant usage",
            "amount_minor": 4320,
            "currency": "USD",
            "billing_cycle": "usage_based",
            "service_period_start": "2026-09-01",
            "service_period_end": "2026-09-30",
            "due_date": "2026-10-05",
            "paid_date": None,
            "status": "due",
            "reference": "OPENAI-2026-09",
            "notes": "No key material here",
        }

    def test_create_cost_audits_action(self):
        r = self.client.post("/api/admin/costs", headers=self.owner_headers, json=self.valid_payload())
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["provider"], "OpenAI")
        self.assertEqual(body["created_by"], "owner@x.com")
        self.assertGreaterEqual(run(_audit_count("cost.create")), 1)

    def test_auditor_cannot_create_cost(self):
        r = self.client.post("/api/admin/costs", headers=self.auditor_headers, json=self.valid_payload())
        self.assertEqual(r.status_code, 403)

    def test_create_rejects_invalid_amount_and_date(self):
        payload = self.valid_payload()
        payload["amount_minor"] = 0
        payload["due_date"] = "09/30/2026"
        r = self.client.post("/api/admin/costs", headers=self.owner_headers, json=payload)
        self.assertEqual(r.status_code, 422)

    def test_create_rejects_secret_like_notes_without_audit(self):
        payload = self.valid_payload()
        payload["notes"] = "OpenAI key sk-proj-abc123abc123abc123abc123abc123abc123 should not be stored"
        r = self.client.post("/api/admin/costs", headers=self.owner_headers, json=payload)
        self.assertEqual(r.status_code, 422)
        self.assertEqual(run(_audit_count("cost.create")), 0)

    def test_update_mark_paid_and_archive_cost(self):
        created = self.client.post(
            "/api/admin/costs",
            headers=self.owner_headers,
            json=self.valid_payload(),
        ).json()
        payload = self.valid_payload()
        payload["provider"] = "Anthropic"
        payload["amount_minor"] = 9900

        updated = self.client.patch(
            f"/api/admin/costs/{created['id']}",
            headers=self.owner_headers,
            json=payload,
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["provider"], "Anthropic")

        paid = self.client.post(
            f"/api/admin/costs/{created['id']}/mark-paid",
            headers=self.owner_headers,
            json={"paid_date": "2026-10-01"},
        )
        self.assertEqual(paid.status_code, 200)
        self.assertEqual(paid.json()["status"], "paid")
        self.assertEqual(paid.json()["paid_date"], "2026-10-01")

        archived = self.client.post(
            f"/api/admin/costs/{created['id']}/archive",
            headers=self.owner_headers,
        )
        self.assertEqual(archived.status_code, 200)
        self.assertIsNotNone(archived.json()["archived_at"])

        listed = self.client.get("/api/admin/costs", headers=self.owner_headers)
        self.assertEqual(listed.json()["total"], 0)
        self.assertGreaterEqual(run(_audit_count("cost.update")), 1)
        self.assertGreaterEqual(run(_audit_count("cost.mark_paid")), 1)
        self.assertGreaterEqual(run(_audit_count("cost.archive")), 1)

    def test_mutating_missing_cost_returns_404(self):
        r = self.client.post("/api/admin/costs/999/mark-paid", headers=self.owner_headers, json={})
        self.assertEqual(r.status_code, 404)
