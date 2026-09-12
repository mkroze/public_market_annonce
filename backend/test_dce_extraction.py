import asyncio
import hashlib
import os
import tempfile
import unittest


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


class SchemaTest(unittest.TestCase):
    def setUp(self):
        import config, database
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        config.DB_PATH = self.tmp.name
        database.DB_PATH = self.tmp.name
        run(database.init_db())

    def tearDown(self):
        if os.path.exists(self.tmp.name):
            os.remove(self.tmp.name)

    def test_dce_extraction_tables_exist(self):
        import database

        async def scenario():
            db = await database.get_db()
            cols = {r["name"] for r in await (await db.execute("PRAGMA table_info(dce_extraction)")).fetchall()}
            log_cols = {r["name"] for r in await (await db.execute("PRAGMA table_info(dce_extraction_log)")).fetchall()}
            await db.close()
            return cols, log_cols

        cols, log_cols = run(scenario())
        self.assertLessEqual(
            {"tender_id", "zip_hash", "status", "ocr_lang", "model",
             "core_json", "key_points_json", "tags_json", "doc_types_json",
             "redaction_stats", "error", "extracted_at"},
            cols,
        )
        self.assertLessEqual(
            {"id", "started_at", "finished_at", "total", "enqueued",
             "skipped", "failed", "status", "actor_email"},
            log_cols,
        )


class StorageTest(unittest.TestCase):
    def setUp(self):
        import config, database
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        config.DB_PATH = self.tmp.name
        database.DB_PATH = self.tmp.name
        self.ctxdir = tempfile.mkdtemp()
        config.DCE_CONTEXT_DIR = self.ctxdir
        run(database.init_db())

    def tearDown(self):
        import shutil
        if os.path.exists(self.tmp.name):
            os.remove(self.tmp.name)
        shutil.rmtree(self.ctxdir, ignore_errors=True)

    def _seed(self, tid):
        import database
        async def s():
            db = await database.get_db()
            await db.execute(
                "INSERT INTO tenders (id, reference, title, entity) VALUES (?, ?, ?, ?)",
                (tid, "R", "T", "E"),
            )
            await db.commit()
            await db.close()
        run(s())

    def test_store_and_get_roundtrip_and_context_md(self):
        import dce_extraction
        self._seed("T1")
        payload = {
            "zip_hash": "abc", "status": "ok", "ocr_lang": "fr", "model": "m",
            "core": {"object": {"value": "Voirie", "confidence": "high", "source_doc": "CPS", "quote": "q"}},
            "key_points": ["Caution 2%"], "tags": ["voirie"],
            "doc_types": {"cps.pdf": "CPS"}, "redaction_stats": {"names": 2}, "error": None,
        }

        async def scenario():
            import database
            db = await database.get_db()
            await dce_extraction.store_extraction(db, "T1", payload)
            row = await dce_extraction.get_extraction(db, "T1")
            await db.close()
            return row

        row = run(scenario())
        self.assertEqual(row["status"], "ok")
        self.assertEqual(row["core"]["object"]["value"], "Voirie")
        self.assertEqual(row["tags"], ["voirie"])
        self.assertEqual(row["key_points"], ["Caution 2%"])
        self.assertEqual(row["doc_types"], {"cps.pdf": "CPS"})
        self.assertEqual(row["redaction_stats"], {"names": 2})
        md_path = dce_extraction.context_md_path("T1")
        self.assertTrue(os.path.exists(md_path))
        with open(md_path, encoding="utf-8") as f:
            body = f.read()
        self.assertIn("Voirie", body)
        self.assertIn("voirie", body)

    def test_zip_content_hash(self):
        import dce_extraction
        with tempfile.NamedTemporaryFile(delete=False) as f:
            test_content = b"test data for hashing"
            f.write(test_content)
            f.flush()
            path = f.name
        try:
            expected_hash = hashlib.sha256(test_content).hexdigest()
            actual_hash = dce_extraction.zip_content_hash(path)
            self.assertEqual(actual_hash, expected_hash)
        finally:
            os.remove(path)


class SigningTest(unittest.TestCase):
    def setUp(self):
        import config
        config.DCE_EXTRACTION_SECRET = "test-secret"
        config.DCE_EXTRACT_SIGNING_TTL = 900

    def test_sign_then_verify_ok(self):
        import dce_signing
        tok = dce_signing.sign_zip_token("T/1", now=1000)
        self.assertTrue(dce_signing.verify_zip_token("T/1", tok, now=1100))

    def test_expired_token_rejected(self):
        import dce_signing
        tok = dce_signing.sign_zip_token("T/1", now=1000)
        self.assertFalse(dce_signing.verify_zip_token("T/1", tok, now=1000 + 901))

    def test_wrong_tender_rejected(self):
        import dce_signing
        tok = dce_signing.sign_zip_token("T/1", now=1000)
        self.assertFalse(dce_signing.verify_zip_token("OTHER", tok, now=1100))

    def test_tampered_signature_rejected(self):
        import dce_signing
        tok = dce_signing.sign_zip_token("T/1", now=1000)
        expiry, _sig = tok.split(".", 1)
        self.assertFalse(dce_signing.verify_zip_token("T/1", f"{expiry}.deadbeef", now=1100))


class ZipFetchApiTest(unittest.TestCase):
    def setUp(self):
        import config, database, dce_cache
        from fastapi.testclient import TestClient
        import main
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        config.DB_PATH = self.tmp.name
        database.DB_PATH = self.tmp.name
        config.DCE_EXTRACTION_SECRET = "test-secret"
        config.DCE_EXTRACT_SIGNING_TTL = 900
        self.cachedir = tempfile.mkdtemp()
        config.DCE_CACHE_DIR = self.cachedir
        dce_cache.DCE_CACHE_DIR = self.cachedir
        run(database.init_db())
        self.client = TestClient(main.app)

    def tearDown(self):
        import shutil
        if os.path.exists(self.tmp.name):
            os.remove(self.tmp.name)
        shutil.rmtree(self.cachedir, ignore_errors=True)

    def _seed_with_zip(self, tid):
        import database, dce_cache
        async def s():
            db = await database.get_db()
            await db.execute("INSERT INTO tenders (id, reference, title, entity) VALUES (?,?,?,?)",
                             (tid, "R", "T", "E"))
            await db.commit()
            path = dce_cache._disk_path(tid)
            os.makedirs(self.cachedir, exist_ok=True)
            with open(path, "wb") as f:
                f.write(b"PK\x03\x04zipbytes")
            await db.execute(
                "INSERT INTO dce_cache (tender_id, filename, size, status) VALUES (?,?,?, 'ok')",
                (tid, "dce.zip", 9),
            )
            await db.commit()
            await db.close()
        run(s())

    def test_valid_token_returns_zip(self):
        import dce_signing
        self._seed_with_zip("T1")
        tok = dce_signing.sign_zip_token("T1")
        r = self.client.get(f"/api/dce/T1/archive?token={tok}")
        self.assertEqual(r.status_code, 200)
        self.assertIn(b"zipbytes", r.content)

    def test_bad_token_is_401(self):
        self._seed_with_zip("T1")
        r = self.client.get("/api/dce/T1/archive?token=nope.deadbeef")
        self.assertEqual(r.status_code, 401)


if __name__ == "__main__":
    unittest.main()
