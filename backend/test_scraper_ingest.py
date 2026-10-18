"""Ingestion refresh behaviour for the sector sweep.

The sweep used to `INSERT OR IGNORE` notices, so a tender that changed at the
source (a deadline extension, a corrected title) kept its first-seen values
forever and the admin still reported a clean import. These tests pin the
refresh contract: source fields follow the portal, moderation decisions do
not, deadlines are normalized at ingestion rather than at startup, and the
run counters say what actually happened.
"""

import os
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

import scraper


SECTOR = {"1.1": "Travaux divers"}



def tender(tid="T1", **over):
    row = {
        "id": tid,
        "reference": f"REF-{tid}",
        "title": "Travaux de voirie",
        "entity": "Commune de Rabat",
        "entity_code": f"ORG-{tid}",
        "sector_code": "1.1",
        "sector_name": "Travaux divers",
        "category": "Travaux",
        "deadline": "31/12/2026 10:00",
        "publication_date": "01/12/2026",
        "status": "open",
        "procedure_type": "AOO",
        "location": "Rabat",
        "detail_url": f"https://portal.test/t/{tid}",
    }
    row.update(over)
    return row


class ScrapeIngestTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        import config, database

        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self._old_config_path = config.DB_PATH
        self._old_db_path = database.DB_PATH
        config.DB_PATH = self.tmp.name
        database.DB_PATH = self.tmp.name
        await database.init_db()

    async def asyncTearDown(self):
        import config, database

        config.DB_PATH = self._old_config_path
        database.DB_PATH = self._old_db_path
        if os.path.exists(self.tmp.name):
            os.remove(self.tmp.name)

    async def sweep(self, tenders, *, actor_email="ops@test", trigger="manual"):
        """Run the real sweep with one mocked sector response."""
        with patch.object(scraper, "SECTORS", SECTOR), \
             patch.object(scraper, "scrape_sector", AsyncMock(return_value=list(tenders))):
            return await scraper.scrape_all_sectors(actor_email=actor_email, trigger=trigger)

    async def row(self, tid):
        import database

        db = await database.get_db()
        try:
            return dict(await (await db.execute(
                "SELECT * FROM tenders WHERE id = ?", (tid,)
            )).fetchone())
        finally:
            await db.close()

    async def last_log(self):
        import database

        db = await database.get_db()
        try:
            return dict(await (await db.execute(
                "SELECT * FROM scrape_log ORDER BY id DESC LIMIT 1"
            )).fetchone())
        finally:
            await db.close()

    # --- refresh ---------------------------------------------------------

    async def test_changed_source_fields_are_refreshed(self):
        await self.sweep([tender()])
        await self.sweep([tender(
            title="Travaux de voirie - lot 2",
            deadline="15/01/2027 09:00",
            status="extended",
            location="Salé",
        )])

        row = await self.row("T1")
        self.assertEqual(row["title"], "Travaux de voirie - lot 2")
        self.assertEqual(row["deadline"], "15/01/2027 09:00")
        self.assertEqual(row["status"], "extended")
        self.assertEqual(row["location"], "Salé")
        # the normalized deadline must follow the source deadline, not lag it
        self.assertEqual(row["deadline_date"], "2027-01-15")

    async def test_refresh_preserves_moderation_state(self):
        import database

        await self.sweep([tender()])
        db = await database.get_db()
        await db.execute(
            """UPDATE tenders
               SET admin_status = 'archived', review_status = 'reviewed', flag_note = 'hors périmètre'
               WHERE id = 'T1'"""
        )
        await db.commit()
        await db.close()

        await self.sweep([tender(title="Travaux de voirie (rectificatif)")])

        row = await self.row("T1")
        self.assertEqual(row["title"], "Travaux de voirie (rectificatif)")
        self.assertEqual(row["admin_status"], "archived")
        self.assertEqual(row["review_status"], "reviewed")
        self.assertEqual(row["flag_note"], "hors périmètre")

    # --- lifecycle metadata written at ingestion -------------------------

    async def test_ingestion_normalizes_deadline_and_records_last_seen(self):
        await self.sweep([tender()])

        row = await self.row("T1")
        log = await self.last_log()
        self.assertEqual(row["deadline_date"], "2026-12-31")
        self.assertIsNotNone(row["source_last_seen_at"])
        self.assertEqual(row["last_seen_import_id"], log["id"])

    async def test_last_seen_advances_on_every_sweep(self):
        await self.sweep([tender()])
        first = await self.row("T1")
        await self.sweep([tender()])  # byte-identical notice
        second = await self.row("T1")

        self.assertGreater(second["last_seen_import_id"], first["last_seen_import_id"])

    async def test_fresh_expired_notice_is_counted_without_a_restart(self):
        """A just-scraped past-deadline notice must land in the expired counts
        immediately, not only after init_db()'s backfill runs again.

        These are the predicates the admin dashboard counts with (admin.py
        current/expired queries), which read `deadline_date` directly rather
        than through the lifecycle expression's raw-deadline fallback. With an
        unpopulated `deadline_date` an expired notice reads as current.
        """
        import database

        await self.sweep([tender(deadline="01/01/2020 10:00")])

        db = await database.get_db()
        try:
            counts = await (await db.execute(
                """SELECT
                     SUM(CASE WHEN COALESCE(deadline_date, '') = ''
                                OR deadline_date >= date('now') THEN 1 ELSE 0 END) AS current,
                     SUM(CASE WHEN COALESCE(deadline_date, '') != ''
                               AND deadline_date < date('now') THEN 1 ELSE 0 END) AS expired
                   FROM tenders"""
            )).fetchone()
        finally:
            await db.close()
        self.assertEqual(counts["expired"], 1)
        self.assertEqual(counts["current"], 0)

    # --- honest counters -------------------------------------------------

    async def test_counters_distinguish_new_updated_and_unchanged(self):
        await self.sweep([tender("T1"), tender("T2")])
        result = await self.sweep([
            tender("T1", title="Travaux de voirie - lot 2"),  # updated
            tender("T2"),                                     # unchanged
            tender("T3"),                                     # new
        ])

        self.assertEqual(result["total_found"], 3)
        self.assertEqual(result["total_new"], 1)
        self.assertEqual(result["total_updated"], 1)
        self.assertEqual(result["total_unchanged"], 1)

        log = await self.last_log()
        self.assertEqual(log["tenders_found"], 3)
        self.assertEqual(log["tenders_new"], 1)
        self.assertEqual(log["tenders_updated"], 1)
        self.assertEqual(log["tenders_skipped"], 1)
        self.assertEqual(log["status"], "done")

    async def test_new_ids_excludes_refreshed_tenders(self):
        """new_ids drives the alert digest: a deadline change must not re-alert
        every subscriber who was already notified about that tender."""
        await self.sweep([tender("T1")])
        result = await self.sweep([
            tender("T1", deadline="15/01/2027 09:00"),
            tender("T2"),
        ])

        self.assertEqual(result["new_ids"], ["T2"])


if __name__ == "__main__":
    unittest.main()
