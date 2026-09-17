import os
import tempfile
import unittest
from datetime import datetime, timedelta

import scheduler
from scheduler import MOROCCO_TZ


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
        import database
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self._old = database.DB_PATH
        database.DB_PATH = self.tmp.name
        await database.init_db()

    async def asyncTearDown(self):
        import database
        database.DB_PATH = self._old
        os.unlink(self.tmp.name)

    async def test_seed_creates_three_jobs(self):
        import database
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
        import database
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
        import database
        db = await database.get_db()
        try:
            with self.assertRaises(ValueError):
                await scheduler.update_schedule(db, "dce_cache", {"schedule_kind": "weekly"})
        finally:
            await db.close()


if __name__ == "__main__":
    unittest.main()
