"""Simulated extractions must stay out of the real result path.

The admin "Simulate result" affordance used to call the normal
`store_extraction()` with a fabricated payload whose status was `ok`, so sample
data landed in `dce_extraction` via INSERT OR REPLACE: it could overwrite a
real fiche, it was counted as a stored extraction, and the member-facing
endpoint served it. These tests pin the isolation: simulated rows are labelled,
excluded from production counts and member reads, never replace a live result,
always lose to one, and can be purged.
"""

import asyncio
import os
import tempfile
import unittest

_tmp_dir = tempfile.mkdtemp()
os.environ.setdefault("ADMIN_EMAILS", "")

from mpm.core import config  # noqa: E402
config.DB_PATH = os.path.join(_tmp_dir, "test_extraction_sim.db")
config.DCE_CONTEXT_DIR = os.path.join(_tmp_dir, "context")

from fastapi.testclient import TestClient  # noqa: E402

from mpm.db import database  # noqa: E402
from mpm.pipeline import stage_03_fiches as dce_extraction  # noqa: E402
from mpm.security.auth import hash_password, create_token  # noqa: E402
from mpm.api import main  # noqa: E402

def run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


LIVE_PAYLOAD = {
    "zip_hash": "realhash",
    "status": "ok",
    "ocr_lang": "fr",
    "model": "gpt-real",
    "core": {"object": {"value": "Vraie fiche"}},
    "key_points": ["point réel"],
    "tags": ["réel"],
}


class SimulationIsolationTest(unittest.TestCase):
    def setUp(self):
        run(self._setup())
        self.client = TestClient(main.app)

    async def _setup(self):
        if os.path.exists(config.DB_PATH):
            os.remove(config.DB_PATH)
        await database.init_db()
        db = await database.get_db()
        await db.execute(
            "INSERT INTO tenders (id, reference, title, entity) VALUES ('T1', 'REF-1', 'Tender One', 'Entity')"
        )
        await db.execute(
            "INSERT INTO tenders (id, reference, title, entity) VALUES ('T2', 'REF-2', 'Tender Two', 'Entity')"
        )
        cur = await db.execute(
            "INSERT INTO users (email, password_hash, name, role, status) VALUES (?, ?, ?, 'owner', 'active')",
            ("owner@x.com", hash_password("pw"), "owner"),
        )
        self.uid = cur.lastrowid
        cur = await db.execute(
            "INSERT INTO users (email, password_hash, name, role, status) VALUES (?, ?, ?, 'user', 'active')",
            ("member@x.com", hash_password("pw"), "member"),
        )
        self.member_uid = cur.lastrowid
        await db.commit()
        await db.close()

    @property
    def headers(self):
        return {"Authorization": f"Bearer {create_token(self.uid, 'owner@x.com')}"}

    @property
    def member_headers(self):
        # The catalog API is gated for signed-in members, so a member read of a
        # fiche needs a real token, not an anonymous call.
        return {"Authorization": f"Bearer {create_token(self.member_uid, 'member@x.com')}"}

    def _simulate(self, tender_id=""):
        return self.client.post(
            "/api/admin/dce-extraction/simulate",
            headers=self.headers,
            json={"tender_id": tender_id} if tender_id else {},
        )

    def _store_live(self, tender_id="T1"):
        async def s():
            db = await database.get_db()
            await dce_extraction.store_extraction(db, tender_id, LIVE_PAYLOAD)
            await db.close()
        run(s())

    def _row(self, tender_id):
        async def s():
            db = await database.get_db()
            row = await (await db.execute(
                "SELECT * FROM dce_extraction WHERE tender_id = ?", (tender_id,)
            )).fetchone()
            await db.close()
            return dict(row) if row else None
        return run(s())

    # --- labelling -------------------------------------------------------

    def test_simulated_row_is_labelled_as_simulation(self):
        r = self._simulate("T1")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self._row("T1")["source"], "simulation")

    def test_live_row_is_labelled_live(self):
        self._store_live("T1")
        self.assertEqual(self._row("T1")["source"], "live")

    def test_admin_recent_exposes_the_source(self):
        self._simulate("T1")
        r = self.client.get("/api/admin/dce-extraction/status", headers=self.headers)
        self.assertEqual(r.status_code, 200)
        recent = r.json()["recent"]
        self.assertEqual([e["source"] for e in recent], ["simulation"])

    # --- never reaches members -------------------------------------------

    def test_simulation_is_not_served_to_members(self):
        self._simulate("T1")
        r = self.client.get("/api/tenders/T1/dce-extraction", headers=self.member_headers)
        self.assertEqual(r.status_code, 404)

    def test_live_result_is_still_served_to_members(self):
        self._store_live("T1")
        r = self.client.get("/api/tenders/T1/dce-extraction", headers=self.member_headers)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["model"], "gpt-real")

    # --- never inflates production counts --------------------------------

    def test_simulation_is_excluded_from_the_stored_count(self):
        self._simulate("T1")
        r = self.client.get("/api/admin/dce-extraction/status", headers=self.headers)
        body = r.json()
        self.assertEqual(body["extracted_count"], 0)
        self.assertEqual(body["simulated_count"], 1)

    def test_live_result_is_counted(self):
        self._store_live("T1")
        r = self.client.get("/api/admin/dce-extraction/status", headers=self.headers)
        body = r.json()
        self.assertEqual(body["extracted_count"], 1)
        self.assertEqual(body["simulated_count"], 0)

    # --- never destroys real work ----------------------------------------

    def test_simulation_refuses_to_replace_a_live_result(self):
        self._store_live("T1")
        r = self._simulate("T1")

        self.assertEqual(r.status_code, 409)
        row = self._row("T1")
        self.assertEqual(row["source"], "live")
        self.assertEqual(row["model"], "gpt-real")

    def test_random_pick_skips_tenders_that_already_have_a_live_result(self):
        self._store_live("T1")
        r = self._simulate()  # no tender_id: the endpoint picks one

        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["tender_id"], "T2")
        self.assertEqual(self._row("T1")["model"], "gpt-real")

    def test_live_callback_replaces_a_simulated_row(self):
        """Real data always wins over a sample."""
        self._simulate("T1")
        config.DCE_EXTRACTION_SECRET = "s3cret"
        r = self.client.post(
            "/api/dce/extraction-callback",
            headers={"X-Extraction-Secret": "s3cret"},
            json={**LIVE_PAYLOAD, "tender_id": "T1"},
        )

        self.assertEqual(r.status_code, 200)
        row = self._row("T1")
        self.assertEqual(row["source"], "live")
        self.assertEqual(row["model"], "gpt-real")

    # --- removable -------------------------------------------------------

    def test_purge_removes_only_simulated_rows(self):
        self._store_live("T1")
        self._simulate("T2")

        r = self.client.delete("/api/admin/dce-extraction/simulations", headers=self.headers)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["deleted"], 1)
        self.assertIsNone(self._row("T2"))
        self.assertEqual(self._row("T1")["source"], "live")

    def test_simulated_row_does_not_suppress_a_real_extraction(self):
        """A sample must not make the sweep think this tender is already done."""
        self._simulate("T1")

        async def s():
            db = await database.get_db()
            row = await (await db.execute(
                "SELECT zip_hash FROM dce_extraction WHERE tender_id = 'T1'"
            )).fetchone()
            already = await dce_extraction._already_extracted(db, "T1", row["zip_hash"])
            await db.close()
            return already

        self.assertFalse(run(s()))


if __name__ == "__main__":
    unittest.main()
