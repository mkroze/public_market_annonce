import os
import tempfile
import unittest
from datetime import datetime, timedelta

from mpm import scheduler
from mpm.scheduler import MOROCCO_TZ


def _now(hour=7, minute=0, day=15):
    return datetime(2026, 9, day, hour, minute, tzinfo=MOROCCO_TZ)


def _row(**over):
    base = {
        "job": "scrape_digest", "enabled": 1, "schedule_kind": "daily",
        "hour": 7, "interval_minutes": 30, "last_run_at": None, "last_status": None,
    }
    base.update(over)
    return base


class IsDueTest(unittest.TestCase):
    def test_disabled_never_due(self):
        self.assertFalse(scheduler.is_due(_row(enabled=0), _now(7)))

    def test_daily_due_inside_hour_when_never_run(self):
        self.assertTrue(scheduler.is_due(_row(hour=7), _now(7, 3)))

    def test_daily_not_due_outside_hour(self):
        self.assertFalse(scheduler.is_due(_row(hour=7), _now(9)))

    def test_daily_not_due_twice_same_day(self):
        row = _row(hour=7, last_run_at=_now(7, 1).isoformat())
        self.assertFalse(scheduler.is_due(row, _now(7, 40)))

    def test_daily_due_next_day(self):
        row = _row(hour=7, last_run_at=_now(7, 1, day=14).isoformat())
        self.assertTrue(scheduler.is_due(row, _now(7, 1, day=15)))

    def test_interval_due_when_never_run(self):
        self.assertTrue(scheduler.is_due(_row(schedule_kind="interval", interval_minutes=30), _now()))

    def test_interval_not_due_before_elapsed(self):
        row = _row(schedule_kind="interval", interval_minutes=30,
                   last_run_at=(_now(8) - timedelta(minutes=10)).isoformat())
        self.assertFalse(scheduler.is_due(row, _now(8)))

    def test_interval_due_after_elapsed(self):
        row = _row(schedule_kind="interval", interval_minutes=30,
                   last_run_at=(_now(8) - timedelta(minutes=31)).isoformat())
        self.assertTrue(scheduler.is_due(row, _now(8)))


class NextRunTest(unittest.TestCase):
    def test_disabled_has_no_next_run(self):
        self.assertIsNone(scheduler.compute_next_run(_row(enabled=0), _now()))

    def test_daily_next_is_tomorrow_after_hour(self):
        row = _row(hour=7, last_run_at=_now(7, 1).isoformat())
        nxt = scheduler.compute_next_run(row, _now(9))
        self.assertEqual(nxt.day, 16)
        self.assertEqual(nxt.hour, 7)

    def test_interval_next_from_last_run(self):
        last = _now(8)
        row = _row(schedule_kind="interval", interval_minutes=30, last_run_at=last.isoformat())
        nxt = scheduler.compute_next_run(row, _now(8, 5))
        self.assertEqual(nxt, last + timedelta(minutes=30))


class ValidateUpdateTest(unittest.TestCase):
    def test_valid_subset(self):
        out = scheduler.validate_update({"enabled": True, "schedule_kind": "interval", "interval_minutes": 45})
        self.assertEqual(out, {"enabled": 1, "schedule_kind": "interval", "interval_minutes": 45})

    def test_bad_kind(self):
        with self.assertRaises(ValueError):
            scheduler.validate_update({"schedule_kind": "hourly"})

    def test_bad_hour(self):
        with self.assertRaises(ValueError):
            scheduler.validate_update({"hour": 27})

    def test_interval_too_small(self):
        with self.assertRaises(ValueError):
            scheduler.validate_update({"interval_minutes": 1})

    def test_ignores_unknown_keys(self):
        self.assertEqual(scheduler.validate_update({"job": "x", "bogus": 1}), {})


class SeedAndPersistTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        from mpm.db import database
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self._old = database.DB_PATH
        database.DB_PATH = self.tmp.name
        await database.init_db()

    async def asyncTearDown(self):
        from mpm.db import database
        database.DB_PATH = self._old
        os.unlink(self.tmp.name)

    async def test_seed_creates_all_jobs(self):
        from mpm.db import database
        db = await database.get_db()
        try:
            jobs = await scheduler.list_schedules(db)
        finally:
            await db.close()
        keys = {j["job"] for j in jobs}
        self.assertEqual(keys, set(scheduler.VALID_JOBS))
        scrape = next(j for j in jobs if j["job"] == "scrape_digest")
        self.assertTrue(scrape["enabled"])
        cache = next(j for j in jobs if j["job"] == "dce_cache")
        self.assertFalse(cache["enabled"])
        self.assertEqual(cache["schedule_kind"], "interval")

    async def test_update_persists_and_reprojects_next_run(self):
        from mpm.db import database
        db = await database.get_db()
        try:
            updated = await scheduler.update_schedule(
                db, "dce_cache", {"enabled": True, "interval_minutes": 20}, updated_by="admin@x.com",
            )
            self.assertTrue(updated["enabled"])
            self.assertEqual(updated["interval_minutes"], 20)
            self.assertIsNotNone(updated["next_run_at"])
        finally:
            await db.close()

    async def test_update_rejects_bad_value(self):
        from mpm.db import database
        db = await database.get_db()
        try:
            with self.assertRaises(ValueError):
                await scheduler.update_schedule(db, "dce_cache", {"schedule_kind": "weekly"})
        finally:
            await db.close()


class ScheduledRunTraceTest(SeedAndPersistTest):
    async def test_tick_audits_each_scheduled_firing(self):
        from mpm.db import database
        from unittest.mock import AsyncMock, patch
        db = await database.get_db()
        try:
            await scheduler.ensure_seeded(db)
            await db.execute("UPDATE job_schedules SET enabled = 0 WHERE job != 'dce_cache'")
            await db.execute("UPDATE job_schedules SET enabled = 1, schedule_kind = 'interval' WHERE job = 'dce_cache'")
            await db.commit()
        finally:
            await db.close()

        with patch.object(scheduler, "run_job", new=AsyncMock(return_value=True)):
            fired = await scheduler.tick()
        self.assertEqual(fired, ["dce_cache"])

        db = await database.get_db()
        try:
            rows = await (await db.execute(
                "SELECT actor_email, actor_role, target_id FROM admin_audit_logs WHERE action = 'cron.scheduled_run'"
            )).fetchall()
        finally:
            await db.close()
        self.assertEqual([tuple(r) for r in rows], [("scheduler", "system", "dce_cache")])


class CleanupJobTest(unittest.IsolatedAsyncioTestCase):
    def test_default_is_daily_and_disabled(self):
        row = next(r for r in scheduler._default_rows() if r["job"] == "dce_cache_cleanup")
        self.assertEqual((row["enabled"], row["schedule_kind"]), (0, "daily"))

    async def test_busy_while_a_warm_all_run_holds_the_cache(self):
        from mpm.pipeline import stage_02_archives as dce_cache
        self.assertFalse(await scheduler._job_is_busy("dce_cache_cleanup"))
        async with dce_cache.dce_cache_lock:
            self.assertTrue(await scheduler._job_is_busy("dce_cache_cleanup"))
            self.assertFalse(await scheduler.run_job("dce_cache_cleanup"))

    async def test_dispatches_to_the_outdated_cleanup(self):
        from unittest.mock import MagicMock, patch
        from mpm.pipeline import stage_02_archives as dce_cache
        with patch.object(dce_cache, "cleanup_outdated_dces", new=MagicMock()) as cleanup:
            scheduler._job_coro("dce_cache_cleanup", actor_email="scheduler", base_url=None)
        cleanup.assert_called_once_with(actor_email="scheduler")


class TenderStatsJobTest(unittest.TestCase):
    def test_default_is_daily_at_the_scrape_hour_and_enabled(self):
        rows = {r["job"]: r for r in scheduler._default_rows()}
        stats, scrape = rows["tender_stats"], rows["scrape_digest"]
        self.assertEqual((stats["enabled"], stats["schedule_kind"]), (1, "daily"))
        self.assertEqual(stats["hour"], scrape["hour"])
        self.assertEqual(stats["interval_minutes"], 60)

    def test_fires_after_the_scrape_within_a_tick(self):
        self.assertLess(scheduler.VALID_JOBS.index("scrape_digest"),
                        scheduler.VALID_JOBS.index("tender_stats"))
        self.assertEqual(scheduler.VALID_JOBS[-1], "tender_stats")


class JobTriggerTest(unittest.TestCase):
    def test_run_now_by_an_admin_is_a_manual_scrape(self):
        from unittest.mock import MagicMock, patch
        from mpm.api import main
        with patch.object(main, "run_scrape_and_digest", new=MagicMock()) as scrape:
            scheduler._job_coro("scrape_digest", actor_email="admin@x.com", base_url=None)
            scheduler._job_coro("scrape_digest", actor_email=scheduler.SCHEDULER_ACTOR, base_url=None)
        self.assertEqual([c.kwargs["trigger"] for c in scrape.call_args_list], ["manual", "scheduled"])


if __name__ == "__main__":
    unittest.main()
