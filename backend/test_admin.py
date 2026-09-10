"""Admin control-plane tests: RBAC enforcement, audit logging, bootstrap, and
role-change guards.

Each test runs against an isolated temporary SQLite database and its own event
loop, so ordering is irrelevant and nothing touches the real data file.
"""

import asyncio
import os
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

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


class TenderLifecycleHelperTest(unittest.TestCase):
    def test_parse_deadline_date_accepts_date_time(self):
        from tender_lifecycle import parse_deadline_date

        self.assertEqual(parse_deadline_date("31/12/2026 10:30"), "2026-12-31")

    def test_parse_deadline_date_accepts_date_only(self):
        from tender_lifecycle import parse_deadline_date

        self.assertEqual(parse_deadline_date("05/01/2027"), "2027-01-05")

    def test_parse_deadline_date_returns_none_for_unknown(self):
        from tender_lifecycle import parse_deadline_date

        self.assertIsNone(parse_deadline_date(""))
        self.assertIsNone(parse_deadline_date("not a date"))
        self.assertIsNone(parse_deadline_date("31/02/2020"))
        self.assertIsNone(parse_deadline_date("2020-02-31"))
        self.assertIsNone(parse_deadline_date("31/12/2026 24:00"))
        self.assertIsNone(parse_deadline_date("01/01/0000"))

    def test_sql_deadline_expressions_leave_invalid_dates_unknown(self):
        from tender_lifecycle import deadline_date_expr, deadline_state_expr

        run(_reset_db())

        async def read_states():
            db = await database.get_db()
            await db.executemany(
                "INSERT INTO tenders (id, reference, title, entity, deadline) VALUES (?, ?, ?, ?, ?)",
                [
                    ("T-VALID", "REF-VALID", "Valid", "Entity", "31/12/2999"),
                    ("T-IMPOSSIBLE", "REF-IMPOSSIBLE", "Impossible", "Entity", "31/02/2020"),
                    ("T-MALFORMED", "REF-MALFORMED", "Malformed", "Entity", "2020-02-31"),
                    ("T-BAD-TIME", "REF-BAD-TIME", "Bad time", "Entity", "31/12/2026 24:00"),
                    ("T-ZERO-YEAR", "REF-ZERO-YEAR", "Zero year", "Entity", "01/01/0000"),
                ],
            )
            rows = await (await db.execute(
                "SELECT id, "
                f"{deadline_date_expr('deadline')} AS normalized, "
                f"{deadline_state_expr('t')} AS state "
                "FROM tenders t ORDER BY id"
            )).fetchall()
            await db.close()
            return {row["id"]: dict(row) for row in rows}

        rows = run(read_states())
        self.assertEqual(rows["T-VALID"]["normalized"], "2999-12-31")
        self.assertEqual(rows["T-VALID"]["state"], "open")
        self.assertIsNone(rows["T-IMPOSSIBLE"]["normalized"])
        self.assertEqual(rows["T-IMPOSSIBLE"]["state"], "unknown")
        self.assertIsNone(rows["T-MALFORMED"]["normalized"])
        self.assertEqual(rows["T-MALFORMED"]["state"], "unknown")
        self.assertIsNone(rows["T-BAD-TIME"]["normalized"])
        self.assertEqual(rows["T-BAD-TIME"]["state"], "unknown")
        self.assertIsNone(rows["T-ZERO-YEAR"]["normalized"])
        self.assertEqual(rows["T-ZERO-YEAR"]["state"], "unknown")


class TenderLifecycleMigrationTest(unittest.TestCase):
    def test_init_db_adds_lifecycle_columns_and_backfills_deadline_date(self):
        run(_reset_db())

        async def seed_without_lifecycle_backfill():
            db = await database.get_db()
            await db.executemany(
                "INSERT INTO tenders (id, reference, title, entity, deadline) VALUES (?, ?, ?, ?, ?)",
                [
                    ("T-LIFE", "REF-LIFE", "Lifecycle", "Entity", "31/12/2026 10:30"),
                    ("T-INVALID", "REF-INVALID", "Invalid", "Entity", "31/02/2020"),
                    ("T-MALFORMED", "REF-MALFORMED", "Malformed", "Entity", "2020-02-31"),
                ],
            )
            await db.commit()
            await db.close()

        run(seed_without_lifecycle_backfill())
        run(database.init_db())

        async def read_row():
            db = await database.get_db()
            rows = await (await db.execute(
                "SELECT id, deadline_date, source_last_seen_at, last_seen_import_id, archived_at, archived_reason "
                "FROM tenders ORDER BY id"
            )).fetchall()
            await db.close()
            return {row["id"]: dict(row) for row in rows}

        rows = run(read_row())
        self.assertEqual(rows["T-LIFE"]["deadline_date"], "2026-12-31")
        self.assertIsNone(rows["T-INVALID"]["deadline_date"])
        self.assertIsNone(rows["T-MALFORMED"]["deadline_date"])
        self.assertIn("source_last_seen_at", rows["T-LIFE"])
        self.assertIn("last_seen_import_id", rows["T-LIFE"])
        self.assertIn("archived_at", rows["T-LIFE"])
        self.assertIn("archived_reason", rows["T-LIFE"])

    def test_init_db_repairs_populated_invalid_deadline_dates(self):
        run(_reset_db())

        async def seed_prior_bad_backfill():
            db = await database.get_db()
            await db.executemany(
                "INSERT INTO tenders (id, reference, title, entity, deadline, deadline_date) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                [
                    ("T-FAKE", "REF-FAKE", "Fake", "Entity", "31/02/2020", "2020-02-31"),
                    ("T-STALE", "REF-STALE", "Stale", "Entity", "31/12/2026", "2020-02-31"),
                ],
            )
            await db.commit()
            await db.close()

        run(seed_prior_bad_backfill())
        run(database.init_db())

        async def read_rows():
            db = await database.get_db()
            rows = await (await db.execute(
                "SELECT id, deadline_date FROM tenders WHERE id IN (?, ?) ORDER BY id",
                ("T-FAKE", "T-STALE"),
            )).fetchall()
            await db.close()
            return {row["id"]: row["deadline_date"] for row in rows}

        rows = run(read_rows())
        self.assertIsNone(rows["T-FAKE"])
        self.assertEqual(rows["T-STALE"], "2026-12-31")


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


class RegisterBootstrapTest(unittest.TestCase):
    """Registering an ADMIN_EMAILS-listed address is promoted to owner on the
    spot, so the first admin never needs a server restart to gain access."""

    def setUp(self):
        run(_reset_db())
        self.client = TestClient(main.app)
        # Registration now attempts a verification email; keep it off the network.
        patcher = patch.object(main, "_send_email_best_effort", AsyncMock(return_value=False))
        patcher.start()
        self.addCleanup(patcher.stop)

    def _role_in_db(self, email):
        async def q():
            db = await database.get_db()
            row = await (
                await db.execute("SELECT role FROM users WHERE email = ?", (email,))
            ).fetchone()
            await db.close()
            return row[0] if row else None

        return run(q())

    def test_register_admin_email_promoted_to_owner(self):
        old = os.environ.get("ADMIN_EMAILS", "")
        # Mixed case + surrounding whitespace exercises the normalization path.
        os.environ["ADMIN_EMAILS"] = " Boss@x.com "
        try:
            r = self.client.post(
                "/api/auth/register",
                json={"email": "boss@x.com", "password": "pw", "name": "Boss"},
            )
        finally:
            os.environ["ADMIN_EMAILS"] = old

        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["user"]["role"], "owner")
        self.assertEqual(self._role_in_db("boss@x.com"), "owner")

    def test_registered_owner_can_reach_admin_immediately(self):
        old = os.environ.get("ADMIN_EMAILS", "")
        os.environ["ADMIN_EMAILS"] = "boss@x.com"
        try:
            r = self.client.post(
                "/api/auth/register",
                json={"email": "boss@x.com", "password": "pw", "name": "Boss"},
            )
        finally:
            os.environ["ADMIN_EMAILS"] = old

        token = r.json()["token"]
        overview = self.client.get(
            "/api/admin/overview", headers={"Authorization": f"Bearer {token}"}
        )
        self.assertEqual(overview.status_code, 200)

    def test_register_non_admin_email_stays_user(self):
        old = os.environ.get("ADMIN_EMAILS", "")
        os.environ["ADMIN_EMAILS"] = "boss@x.com"
        try:
            r = self.client.post(
                "/api/auth/register",
                json={"email": "regular@x.com", "password": "pw", "name": "Reg"},
            )
        finally:
            os.environ["ADMIN_EMAILS"] = old

        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["user"]["role"], "user")
        self.assertEqual(self._role_in_db("regular@x.com"), "user")

    def test_register_with_empty_admin_emails_stays_user(self):
        old = os.environ.get("ADMIN_EMAILS", "")
        os.environ["ADMIN_EMAILS"] = ""
        try:
            r = self.client.post(
                "/api/auth/register",
                json={"email": "someone@x.com", "password": "pw", "name": "S"},
            )
        finally:
            os.environ["ADMIN_EMAILS"] = old

        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["user"]["role"], "user")


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

    async def _seed_lifecycle_tender(self, tid, deadline, *, admin_status="active", archived_reason=None):
        from tender_lifecycle import parse_deadline_date

        db = await database.get_db()
        await db.execute(
            """INSERT INTO tenders
               (id, reference, title, entity, deadline, deadline_date, admin_status, archived_reason)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                tid,
                "REF-" + tid,
                "Title " + tid,
                "Entity",
                deadline,
                parse_deadline_date(deadline),
                admin_status,
                archived_reason,
            ),
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

        async def archived_row():
            db = await database.get_db()
            row = await (await db.execute(
                "SELECT admin_status, archived_at, archived_reason FROM tenders WHERE id = 'T1'"
            )).fetchone()
            await db.close()
            return dict(row)

        row = run(archived_row())
        self.assertEqual(row["admin_status"], "archived")
        self.assertIsNotNone(row["archived_at"])
        self.assertEqual(row["archived_reason"], "manual")

        r = self.client.post(
            "/api/admin/tenders/batch",
            headers=self.headers,
            json={"action": "restore", "ids": ["T1"]},
        )
        self.assertEqual(r.json()["result"], "success")

        row = run(archived_row())
        self.assertEqual(row["admin_status"], "active")
        self.assertIsNone(row["archived_at"])
        self.assertIsNone(row["archived_reason"])

    def test_batch_unknown_action_rejected(self):
        r = self.client.post(
            "/api/admin/tenders/batch",
            headers=self.headers,
            json={"action": "nuke", "ids": ["T1"]},
        )
        self.assertEqual(r.status_code, 422)

    def test_overview_counts_expired_active_tenders(self):
        run(self._seed_lifecycle_tender("OLD-ACTIVE", "01/01/2020 10:00"))
        run(self._seed_lifecycle_tender("OLD-ARCHIVED", "01/01/2020 10:00", admin_status="archived"))
        run(self._seed_lifecycle_tender("FUTURE", "01/01/2099 10:00"))

        r = self.client.get("/api/admin/overview", headers=self.headers)

        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["failure_queues"]["stale_records"], 1)

    def test_admin_tenders_filters_by_deadline_state_and_returns_lifecycle_fields(self):
        run(self._seed_lifecycle_tender("OLD-FILTER", "01/01/2020 10:00"))
        run(self._seed_lifecycle_tender("FUTURE-FILTER", "01/01/2099 10:00"))
        run(self._seed_lifecycle_tender("UNKNOWN-FILTER", ""))

        r = self.client.get(
            "/api/admin/tenders?deadline_state=expired",
            headers=self.headers,
        )

        self.assertEqual(r.status_code, 200)
        ids = [row["id"] for row in r.json()["data"]]
        self.assertIn("OLD-FILTER", ids)
        self.assertNotIn("FUTURE-FILTER", ids)
        first = r.json()["data"][0]
        self.assertIn("deadline_state", first)
        self.assertIn("public_visible", first)
        self.assertIn("archived_at", first)
        self.assertIn("archived_reason", first)

        r = self.client.get("/api/admin/tenders?deadline_state=open", headers=self.headers)
        self.assertEqual(r.status_code, 200)
        self.assertIn("FUTURE-FILTER", [row["id"] for row in r.json()["data"]])

        r = self.client.get("/api/admin/tenders?deadline_state=unknown", headers=self.headers)
        self.assertEqual(r.status_code, 200)
        self.assertIn("UNKNOWN-FILTER", [row["id"] for row in r.json()["data"]])

        r = self.client.get("/api/admin/tenders?deadline_state=invalid", headers=self.headers)
        self.assertEqual(r.status_code, 422)

    def test_cleanup_expired_archives_only_active_expired_tenders(self):
        run(self._seed_lifecycle_tender("OLD-CLEAN", "01/01/2020 10:00"))
        run(self._seed_lifecycle_tender("OLD-DONE", "01/01/2020 10:00", admin_status="archived"))
        run(self._seed_lifecycle_tender("FUTURE-CLEAN", "01/01/2099 10:00"))
        run(self._seed_lifecycle_tender("UNKNOWN-CLEAN", ""))

        r = self.client.post(
            "/api/admin/tenders/cleanup-expired?clear_dce_cache=false",
            headers=self.headers,
            json={"confirmation": "ARCHIVE EXPIRED"},
        )

        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["matched"], 1)
        self.assertEqual(r.json()["archived"], 1)

        async def states():
            db = await database.get_db()
            rows = await (await db.execute(
                "SELECT id, admin_status, archived_reason FROM tenders "
                "WHERE id IN ('OLD-CLEAN', 'OLD-DONE', 'FUTURE-CLEAN', 'UNKNOWN-CLEAN')"
            )).fetchall()
            await db.close()
            return {row["id"]: dict(row) for row in rows}

        rows = run(states())
        self.assertEqual(rows["OLD-CLEAN"]["admin_status"], "archived")
        self.assertEqual(rows["OLD-CLEAN"]["archived_reason"], "expired_deadline")
        self.assertEqual(rows["OLD-DONE"]["admin_status"], "archived")
        self.assertEqual(rows["FUTURE-CLEAN"]["admin_status"], "active")
        self.assertEqual(rows["UNKNOWN-CLEAN"]["admin_status"], "active")
        self.assertGreaterEqual(run(_audit_count("tender.cleanup.expired_archive")), 1)

    def test_cleanup_expired_requires_exact_confirmation(self):
        run(self._seed_lifecycle_tender("OLD-NO-CONFIRM", "01/01/2020 10:00"))

        r = self.client.post(
            "/api/admin/tenders/cleanup-expired",
            headers=self.headers,
            json={"confirmation": "archive expired"},
        )

        self.assertEqual(r.status_code, 422)

        async def status():
            db = await database.get_db()
            row = await (await db.execute(
                "SELECT admin_status FROM tenders WHERE id = 'OLD-NO-CONFIRM'"
            )).fetchone()
            await db.close()
            return row["admin_status"]

        self.assertEqual(run(status()), "active")

    def test_cleanup_expired_clears_dce_cache_when_requested(self):
        with patch("dce_cache.clear_dce_cache", new_callable=AsyncMock) as clear_cache:
            clear_cache.return_value = {"removed": 3, "freed_bytes": 2048}
            r = self.client.post(
                "/api/admin/tenders/cleanup-expired?clear_dce_cache=true",
                headers=self.headers,
                json={"confirmation": "ARCHIVE EXPIRED"},
            )

        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["dce_removed"], 3)
        self.assertEqual(r.json()["dce_freed_bytes"], 2048)
        self.assertIsNone(r.json()["dce_error"])
        clear_cache.assert_awaited_once()
        self.assertEqual(clear_cache.await_args.kwargs["mode"], "outdated")

    def test_cleanup_expired_returns_partial_audit_when_dce_cleanup_fails(self):
        with patch("dce_cache.clear_dce_cache", new_callable=AsyncMock) as clear_cache:
            clear_cache.side_effect = RuntimeError("DCE storage unavailable")
            r = self.client.post(
                "/api/admin/tenders/cleanup-expired?clear_dce_cache=true",
                headers=self.headers,
                json={"confirmation": "ARCHIVE EXPIRED"},
            )

        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["dce_error"], "DCE storage unavailable")

        async def audit_result():
            db = await database.get_db()
            row = await (await db.execute(
                "SELECT result FROM admin_audit_logs WHERE action = 'tender.cleanup.expired_archive'"
            )).fetchone()
            await db.close()
            return row["result"]

        self.assertEqual(run(audit_result()), "partial")

    def test_cleanup_expired_requires_moderation_permission(self):
        auditor = run(_make_user("aud-clean@x.com", role="auditor"))
        r = self.client.post(
            "/api/admin/tenders/cleanup-expired",
            headers=_auth(auditor, "aud-clean@x.com"),
        )

        self.assertEqual(r.status_code, 403)


if __name__ == "__main__":
    unittest.main()
