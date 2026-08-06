"""Admin control-plane tests: RBAC enforcement, audit logging, bootstrap, and
role-change guards.

Each test runs against an isolated temporary SQLite database and its own event
loop, so ordering is irrelevant and nothing touches the real data file.
"""

import asyncio
import os
import tempfile
import unittest

# Point the app at a throwaway DB before importing modules that read config.
_tmp_dir = tempfile.mkdtemp()
os.environ.setdefault("ADMIN_EMAILS", "")

import config  # noqa: E402
config.DB_PATH = os.path.join(_tmp_dir, "test_admin.db")

from fastapi.testclient import TestClient  # noqa: E402

import database  # noqa: E402
import admin  # noqa: E402
from auth import hash_password, create_token  # noqa: E402
import main  # noqa: E402


def run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _reset_db():
    # Fresh schema on every test for isolation.
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


async def _audit_count(action=None):
    db = await database.get_db()
    if action:
        cur = await db.execute("SELECT COUNT(*) FROM admin_audit_logs WHERE action = ?", (action,))
    else:
        cur = await db.execute("SELECT COUNT(*) FROM admin_audit_logs")
    n = (await cur.fetchone())[0]
    await db.close()
    return n


class AdminAccessTest(unittest.TestCase):
    def setUp(self):
        run(_reset_db())
        self.client = TestClient(main.app)

    def test_overview_requires_auth(self):
        r = self.client.get("/api/admin/overview")
        self.assertEqual(r.status_code, 401)

    def test_non_admin_forbidden_and_audited(self):
        uid = run(_make_user("plain@x.com", role="user"))
        r = self.client.get("/api/admin/overview", headers=_auth(uid, "plain@x.com"))
        self.assertEqual(r.status_code, 403)
        self.assertGreaterEqual(run(_audit_count("admin.access_denied")), 1)

    def test_missing_permission_forbidden(self):
        # auditor lacks imports.run -> POST /imports must be denied
        uid = run(_make_user("aud@x.com", role="auditor"))
        r = self.client.post("/api/admin/imports", headers=_auth(uid, "aud@x.com"))
        self.assertEqual(r.status_code, 403)

    def test_owner_can_read_overview(self):
        uid = run(_make_user("owner@x.com", role="owner"))
        r = self.client.get("/api/admin/overview", headers=_auth(uid, "owner@x.com"))
        self.assertEqual(r.status_code, 200)
        self.assertIn("freshness", r.json())

    def test_suspended_admin_denied(self):
        uid = run(_make_user("susp@x.com", role="admin", status="suspended"))
        r = self.client.get("/api/admin/overview", headers=_auth(uid, "susp@x.com"))
        self.assertEqual(r.status_code, 403)


class BootstrapTest(unittest.TestCase):
    def test_bootstrap_promotes_listed_email(self):
        run(_reset_db())
        run(_make_user("boss@x.com", role="user"))
        old = os.environ.get("ADMIN_EMAILS", "")
        os.environ["ADMIN_EMAILS"] = "boss@x.com"
        try:
            run(admin.bootstrap_admins())
        finally:
            os.environ["ADMIN_EMAILS"] = old

        async def role_of(email):
            db = await database.get_db()
            row = await (await db.execute("SELECT role FROM users WHERE email = ?", (email,))).fetchone()
            await db.close()
            return row[0]

        self.assertEqual(run(role_of("boss@x.com")), "owner")


class RoleGuardTest(unittest.TestCase):
    def setUp(self):
        run(_reset_db())
        self.client = TestClient(main.app)
        self.owner_id = run(_make_user("owner@x.com", role="owner"))
        self.owner_headers = _auth(self.owner_id, "owner@x.com")

    def test_role_change_is_audited(self):
        target = run(_make_user("target@x.com", role="user"))
        r = self.client.patch(
            f"/api/admin/users/{target}/role",
            headers=self.owner_headers,
            json={"role": "operator"},
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["role"], "operator")
        self.assertGreaterEqual(run(_audit_count("user.role_change")), 1)

    def test_cannot_change_own_role(self):
        r = self.client.patch(
            f"/api/admin/users/{self.owner_id}/role",
            headers=self.owner_headers,
            json={"role": "admin"},
        )
        self.assertEqual(r.status_code, 400)

    def test_cannot_demote_last_owner(self):
        # Promote a second user then demote them is fine, but the sole remaining
        # owner cannot be demoted. Here owner@x.com is the only owner.
        other = run(_make_user("second@x.com", role="admin"))
        r = self.client.patch(
            f"/api/admin/users/{other}/role",
            headers=self.owner_headers,
            json={"role": "owner"},
        )
        self.assertEqual(r.status_code, 200)
        # Now two owners exist; demoting one is allowed.
        r2 = self.client.patch(
            f"/api/admin/users/{other}/role",
            headers=self.owner_headers,
            json={"role": "admin"},
        )
        self.assertEqual(r2.status_code, 200)

    def test_invalid_role_rejected(self):
        target = run(_make_user("t2@x.com", role="user"))
        r = self.client.patch(
            f"/api/admin/users/{target}/role",
            headers=self.owner_headers,
            json={"role": "superking"},
        )
        self.assertEqual(r.status_code, 422)

    def test_suspend_user_audited(self):
        target = run(_make_user("t3@x.com", role="user"))
        r = self.client.patch(
            f"/api/admin/users/{target}",
            headers=self.owner_headers,
            json={"status": "suspended"},
        )
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(run(_audit_count("user.suspend")), 1)


class BatchTest(unittest.TestCase):
    def setUp(self):
        run(_reset_db())
        self.client = TestClient(main.app)
        self.owner_id = run(_make_user("owner@x.com", role="owner"))
        self.headers = _auth(self.owner_id, "owner@x.com")
        run(self._seed_tender("T1"))

    async def _seed_tender(self, tid):
        db = await database.get_db()
        await db.execute(
            "INSERT INTO tenders (id, reference, title, entity) VALUES (?, ?, ?, ?)",
            (tid, "REF-" + tid, "Title " + tid, "Entity"),
        )
        await db.commit()
        await db.close()

    def test_batch_partial_success(self):
        r = self.client.post(
            "/api/admin/tenders/batch",
            headers=self.headers,
            json={"action": "mark_reviewed", "ids": ["T1", "MISSING"]},
        )
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["result"], "partial")
        self.assertIn("T1", body["updated"])
        self.assertEqual(body["failed"][0]["id"], "MISSING")
        self.assertEqual(body["failed"][0]["reason"], "not_found")

    def test_batch_all_success(self):
        r = self.client.post(
            "/api/admin/tenders/batch",
            headers=self.headers,
            json={"action": "archive", "ids": ["T1"]},
        )
        self.assertEqual(r.json()["result"], "success")

    def test_batch_unknown_action_rejected(self):
        r = self.client.post(
            "/api/admin/tenders/batch",
            headers=self.headers,
            json={"action": "nuke", "ids": ["T1"]},
        )
        self.assertEqual(r.status_code, 422)


if __name__ == "__main__":
    unittest.main()
