"""One source of truth for whether a job is running, and what it ended as.

Three defects this pins:

1. `_supervise()` wrote last_status="ok" whenever the awaited coroutine
   returned without raising. Extraction catches its own exceptions and returns
   {"status": "failed"}; cancellation returns {"status": "stopped"}. Both were
   recorded as successes.
2. `/dce-extraction/status` derived `active` from the latest persisted log row
   while `/workflows` derived it from the in-memory control, so the stage view
   and the dashboard disagreed after a restart.
3. Nothing reconciled run rows left `running` by a killed process, so a stale
   row claimed work was in flight forever.
"""

import asyncio
import os
import tempfile
import unittest

_tmp_dir = tempfile.mkdtemp()
os.environ.setdefault("ADMIN_EMAILS", "")

from mpm.core import config  # noqa: E402
config.DB_PATH = os.path.join(_tmp_dir, "test_run_status.db")

from fastapi.testclient import TestClient  # noqa: E402

from mpm.db import database  # noqa: E402
from mpm import scheduler  # noqa: E402
from mpm.security.auth import hash_password, create_token  # noqa: E402
from mpm.api import main  # noqa: E402
from mpm.pipeline.control import DCE_EXTRACTION  # noqa: E402


def run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


class JobOutcomeTest(unittest.TestCase):
    """A job's reported status, not merely 'it did not raise', decides the run."""

    def test_explicit_failure_is_not_recorded_as_success(self):
        self.assertEqual(scheduler.job_outcome({"status": "failed", "failed": 3}), "failed")

    def test_cancellation_keeps_its_own_outcome(self):
        self.assertEqual(scheduler.job_outcome({"status": "stopped"}), "stopped")

    def test_partial_is_preserved(self):
        self.assertEqual(scheduler.job_outcome({"status": "partial"}), "partial")

    def test_done_and_ok_are_success(self):
        self.assertEqual(scheduler.job_outcome({"status": "done"}), "ok")
        self.assertEqual(scheduler.job_outcome({"status": "ok"}), "ok")

    def test_failure_counter_without_status_is_partial(self):
        self.assertEqual(scheduler.job_outcome({"total": 10, "failed": 2}), "partial")

    def test_clean_payload_is_success(self):
        self.assertEqual(scheduler.job_outcome({"total": 10, "failed": 0}), "ok")
        self.assertEqual(scheduler.job_outcome(None), "ok")


class SuperviseTest(unittest.TestCase):
    def setUp(self):
        run(self._reset())

    async def _reset(self):
        if os.path.exists(config.DB_PATH):
            os.remove(config.DB_PATH)
        await database.init_db()
        db = await database.get_db()
        await scheduler.ensure_seeded(db)
        await db.close()

    async def _status(self, job):
        db = await database.get_db()
        row = await (await db.execute(
            "SELECT last_status FROM job_schedules WHERE job = ?", (job,)
        )).fetchone()
        await db.close()
        return row["last_status"]

    def test_failed_job_is_recorded_as_failed(self):
        async def scenario():
            async def job():
                return {"status": "failed", "failed": 3}
            await scheduler._supervise("dce_extraction", job())
            return await self._status("dce_extraction")

        self.assertEqual(run(scenario()), "failed")

    def test_stopped_job_is_recorded_as_stopped(self):
        async def scenario():
            async def job():
                return {"status": "stopped"}
            await scheduler._supervise("dce_extraction", job())
            return await self._status("dce_extraction")

        self.assertEqual(run(scenario()), "stopped")

    def test_raising_job_is_recorded_as_failed(self):
        async def scenario():
            async def job():
                raise RuntimeError("boom")
            await scheduler._supervise("dce_cache", job())
            return await self._status("dce_cache")

        self.assertEqual(run(scenario()), "failed")

    def test_successful_job_is_recorded_as_ok(self):
        async def scenario():
            async def job():
                return {"total": 3, "failed": 0, "status": "done"}
            await scheduler._supervise("dce_cache", job())
            return await self._status("dce_cache")

        self.assertEqual(run(scenario()), "ok")


class ReconcileInterruptedRunsTest(unittest.TestCase):
    """A process that dies mid-run leaves 'running' rows nobody owns."""

    def setUp(self):
        run(self._reset())

    async def _reset(self):
        if os.path.exists(config.DB_PATH):
            os.remove(config.DB_PATH)
        await database.init_db()

    def test_orphaned_run_rows_are_closed_on_startup(self):
        async def scenario():
            db = await database.get_db()
            await db.execute("INSERT INTO scrape_log (status) VALUES ('running')")
            await db.execute("INSERT INTO dce_cache_log (status) VALUES ('running')")
            await db.execute("INSERT INTO dce_extraction_log (status) VALUES ('running')")
            await db.execute("INSERT INTO scrape_log (status) VALUES ('done')")
            await db.commit()
            await db.close()

            closed = await scheduler.reconcile_interrupted_runs()

            db = await database.get_db()
            rows = {}
            for table in ("scrape_log", "dce_cache_log", "dce_extraction_log"):
                r = await (await db.execute(
                    f"SELECT status, finished_at FROM {table} ORDER BY id DESC LIMIT 1"
                )).fetchone()
                rows[table] = dict(r)
            done = await (await db.execute(
                "SELECT COUNT(*) AS n FROM scrape_log WHERE status = 'done'"
            )).fetchone()
            await db.close()
            return closed, rows, done["n"]

        closed, rows, done_count = run(scenario())
        self.assertEqual(closed, 3)
        for table, row in rows.items():
            if table == "scrape_log":
                continue  # newest scrape row was already 'done'
            self.assertEqual(row["status"], "interrupted", table)
            self.assertIsNotNone(row["finished_at"], table)
        self.assertEqual(done_count, 1)  # a finished run is never rewritten

    def test_reconcile_is_idempotent(self):
        async def scenario():
            db = await database.get_db()
            await db.execute("INSERT INTO scrape_log (status) VALUES ('running')")
            await db.commit()
            await db.close()
            first = await scheduler.reconcile_interrupted_runs()
            second = await scheduler.reconcile_interrupted_runs()
            return first, second

        first, second = run(scenario())
        self.assertEqual(first, 1)
        self.assertEqual(second, 0)


class ActiveFlagAgreementTest(unittest.TestCase):
    """The stage view and the dashboard must not disagree about the same job."""

    def setUp(self):
        run(self._reset())
        self.client = TestClient(main.app)

    async def _reset(self):
        if os.path.exists(config.DB_PATH):
            os.remove(config.DB_PATH)
        await database.init_db()
        db = await database.get_db()
        await scheduler.ensure_seeded(db)
        cur = await db.execute(
            "INSERT INTO users (email, password_hash, name, role, status) VALUES (?, ?, ?, 'owner', 'active')",
            ("owner@x.com", hash_password("pw"), "owner"),
        )
        await db.commit()
        self.uid = cur.lastrowid
        await db.close()

    def tearDown(self):
        DCE_EXTRACTION.end()

    @property
    def headers(self):
        return {"Authorization": f"Bearer {create_token(self.uid, 'owner@x.com')}"}

    def _stage_active(self):
        r = self.client.get("/api/admin/dce-extraction/status", headers=self.headers)
        return r.json()["active"]

    def _workflow_active(self):
        r = self.client.get("/api/admin/workflows", headers=self.headers)
        entry = next(e for e in r.json()["data"] if e["key"] == "dce_extraction")
        return entry["active"]

    def test_a_stale_running_row_does_not_claim_an_active_sweep(self):
        """The reproduction: a persisted 'running' row with no live worker."""
        async def seed():
            db = await database.get_db()
            await db.execute("INSERT INTO dce_extraction_log (status) VALUES ('running')")
            await db.commit()
            await db.close()
        run(seed())

        self.assertFalse(DCE_EXTRACTION.running)
        self.assertEqual(self._stage_active(), self._workflow_active())
        self.assertFalse(self._stage_active())

    def test_a_live_sweep_is_active_in_both_views(self):
        DCE_EXTRACTION.begin({"enqueued": 0})
        try:
            self.assertTrue(self._stage_active())
            self.assertEqual(self._stage_active(), self._workflow_active())
        finally:
            DCE_EXTRACTION.end()


if __name__ == "__main__":
    unittest.main()
