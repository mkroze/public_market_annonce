import asyncio
import hashlib
import os
import tempfile
import unittest


def run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


class SchemaTest(unittest.TestCase):
    def setUp(self):
        import config, database
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self._old_config_path = config.DB_PATH
        self._old_db_path = database.DB_PATH
        config.DB_PATH = self.tmp.name
        database.DB_PATH = self.tmp.name
        run(database.init_db())

    def tearDown(self):
        import config, database
        config.DB_PATH = self._old_config_path
        database.DB_PATH = self._old_db_path
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
             "skipped", "failed", "status", "actor_email", "error"},
            log_cols,
        )


class StorageTest(unittest.TestCase):
    def setUp(self):
        import config, database
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self._old_config_path = config.DB_PATH
        self._old_db_path = database.DB_PATH
        self._old_ctx_dir = config.DCE_CONTEXT_DIR
        config.DB_PATH = self.tmp.name
        database.DB_PATH = self.tmp.name
        self.ctxdir = tempfile.mkdtemp()
        config.DCE_CONTEXT_DIR = self.ctxdir
        run(database.init_db())

    def tearDown(self):
        import shutil, config, database
        config.DB_PATH = self._old_config_path
        database.DB_PATH = self._old_db_path
        config.DCE_CONTEXT_DIR = self._old_ctx_dir
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
        self._old_secret = config.DCE_EXTRACTION_SECRET
        self._old_ttl = config.DCE_EXTRACT_SIGNING_TTL
        config.DCE_EXTRACTION_SECRET = "test-secret"
        config.DCE_EXTRACT_SIGNING_TTL = 900

    def tearDown(self):
        import config
        config.DCE_EXTRACTION_SECRET = self._old_secret
        config.DCE_EXTRACT_SIGNING_TTL = self._old_ttl

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
        self._old_config_path = config.DB_PATH
        self._old_db_path = database.DB_PATH
        self._old_secret = config.DCE_EXTRACTION_SECRET
        self._old_ttl = config.DCE_EXTRACT_SIGNING_TTL
        self._old_cache_dir = config.DCE_CACHE_DIR
        self._old_dce_cache_dir = dce_cache.DCE_CACHE_DIR
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
        import shutil, config, database, dce_cache
        config.DB_PATH = self._old_config_path
        database.DB_PATH = self._old_db_path
        config.DCE_EXTRACTION_SECRET = self._old_secret
        config.DCE_EXTRACT_SIGNING_TTL = self._old_ttl
        config.DCE_CACHE_DIR = self._old_cache_dir
        dce_cache.DCE_CACHE_DIR = self._old_dce_cache_dir
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


class CallbackApiTest(unittest.TestCase):
    def setUp(self):
        import config, database
        from fastapi.testclient import TestClient
        import main
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self._old_config_path = config.DB_PATH
        self._old_db_path = database.DB_PATH
        self._old_secret = config.DCE_EXTRACTION_SECRET
        self._old_ctx_dir = config.DCE_CONTEXT_DIR
        config.DB_PATH = self.tmp.name
        database.DB_PATH = self.tmp.name
        config.DCE_EXTRACTION_SECRET = "test-secret"
        self.ctxdir = tempfile.mkdtemp()
        config.DCE_CONTEXT_DIR = self.ctxdir
        run(database.init_db())
        self.client = TestClient(main.app)
        run(self._seed("T1"))

    def tearDown(self):
        import shutil, config, database
        config.DB_PATH = self._old_config_path
        database.DB_PATH = self._old_db_path
        config.DCE_EXTRACTION_SECRET = self._old_secret
        config.DCE_CONTEXT_DIR = self._old_ctx_dir
        if os.path.exists(self.tmp.name):
            os.remove(self.tmp.name)
        shutil.rmtree(self.ctxdir, ignore_errors=True)

    async def _seed(self, tid):
        import database
        db = await database.get_db()
        await db.execute("INSERT INTO tenders (id, reference, title, entity) VALUES (?,?,?,?)",
                         (tid, "R", "T", "E"))
        await db.commit()
        await db.close()

    def _body(self):
        return {"tender_id": "T1", "zip_hash": "abc", "status": "ok", "ocr_lang": "fr",
                "model": "m", "core": {"object": {"value": "Voirie", "confidence": "high"}},
                "key_points": [], "tags": ["voirie"], "doc_types": {}, "redaction_stats": {}, "error": None}

    def test_bad_secret_is_401(self):
        r = self.client.post("/api/dce/extraction-callback", json=self._body(),
                             headers={"X-Extraction-Secret": "wrong"})
        self.assertEqual(r.status_code, 401)

    def test_empty_secret_config_is_401(self):
        """An unset DCE_EXTRACTION_SECRET must fail-closed (reject all requests)."""
        import config
        config.DCE_EXTRACTION_SECRET = ""
        try:
            r = self.client.post("/api/dce/extraction-callback", json=self._body(),
                                 headers={"X-Extraction-Secret": ""})
            self.assertEqual(r.status_code, 401)
        finally:
            config.DCE_EXTRACTION_SECRET = self._old_secret

    def test_unknown_tender_is_404(self):
        b = self._body(); b["tender_id"] = "MISSING"
        r = self.client.post("/api/dce/extraction-callback", json=b,
                             headers={"X-Extraction-Secret": "test-secret"})
        self.assertEqual(r.status_code, 404)

    def test_valid_callback_stores(self):
        r = self.client.post("/api/dce/extraction-callback", json=self._body(),
                             headers={"X-Extraction-Secret": "test-secret"})
        self.assertEqual(r.status_code, 200)
        import database, dce_extraction
        async def check():
            db = await database.get_db()
            row = await dce_extraction.get_extraction(db, "T1")
            await db.close()
            return row
        row = run(check())
        self.assertEqual(row["core"]["object"]["value"], "Voirie")


class ReadApiTest(unittest.TestCase):
    def setUp(self):
        import config, database, auth
        from fastapi.testclient import TestClient
        import main
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self._old_config_path = config.DB_PATH
        self._old_db_path = database.DB_PATH
        self._old_ctx_dir = config.DCE_CONTEXT_DIR
        config.DB_PATH = self.tmp.name
        database.DB_PATH = self.tmp.name
        self.ctxdir = tempfile.mkdtemp()
        config.DCE_CONTEXT_DIR = self.ctxdir
        run(database.init_db())
        self.client = TestClient(main.app)

        async def _create_user():
            db = await database.get_db()
            c = await db.execute(
                "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)",
                ("reader@test.com", "x", "Reader"),
            )
            uid = c.lastrowid
            await db.commit()
            await db.close()
            return uid

        uid = run(_create_user())
        self.auth_header = {"Authorization": f"Bearer {auth.create_token(uid, 'reader@test.com')}"}

    def tearDown(self):
        import shutil, config, database
        config.DB_PATH = self._old_config_path
        database.DB_PATH = self._old_db_path
        config.DCE_CONTEXT_DIR = self._old_ctx_dir
        if os.path.exists(self.tmp.name):
            os.remove(self.tmp.name)
        shutil.rmtree(self.ctxdir, ignore_errors=True)

    def _seed(self, tid, admin_status="active", store=True):
        import database, dce_extraction
        async def s():
            db = await database.get_db()
            await db.execute("INSERT INTO tenders (id, reference, title, entity, admin_status) VALUES (?,?,?,?,?)",
                             (tid, "R", "T", "E", admin_status))
            await db.commit()
            if store:
                await dce_extraction.store_extraction(db, tid, {"status": "ok", "core": {"object": {"value": "V"}}, "tags": ["t"]})
            await db.close()
        run(s())

    def test_returns_extraction(self):
        self._seed("T1")
        r = self.client.get("/api/tenders/T1/dce-extraction", headers=self.auth_header)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["core"]["object"]["value"], "V")

    def test_missing_extraction_is_404(self):
        self._seed("T2", store=False)
        r = self.client.get("/api/tenders/T2/dce-extraction", headers=self.auth_header)
        self.assertEqual(r.status_code, 404)

    def test_archived_tender_is_404(self):
        self._seed("T3", admin_status="archived")
        r = self.client.get("/api/tenders/T3/dce-extraction", headers=self.auth_header)
        self.assertEqual(r.status_code, 404)

    def test_no_token_is_401(self):
        self._seed("T4")
        r = self.client.get("/api/tenders/T4/dce-extraction")
        self.assertEqual(r.status_code, 401)


class EnqueueTest(unittest.TestCase):
    def setUp(self):
        import config, database
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self._old_config_path = config.DB_PATH
        self._old_db_path = database.DB_PATH
        self._old_webhook = config.N8N_EXTRACT_WEBHOOK_URL
        self._old_secret = config.DCE_EXTRACTION_SECRET
        self._old_ttl = config.DCE_EXTRACT_SIGNING_TTL
        config.DB_PATH = self.tmp.name
        database.DB_PATH = self.tmp.name
        config.DCE_EXTRACTION_SECRET = "test-secret"
        config.DCE_EXTRACT_SIGNING_TTL = 900
        config.N8N_EXTRACT_WEBHOOK_URL = "https://n8n.example/webhook/extract"
        run(database.init_db())

    def tearDown(self):
        import config, database
        config.DB_PATH = self._old_config_path
        database.DB_PATH = self._old_db_path
        config.N8N_EXTRACT_WEBHOOK_URL = self._old_webhook
        config.DCE_EXTRACTION_SECRET = self._old_secret
        config.DCE_EXTRACT_SIGNING_TTL = self._old_ttl
        if os.path.exists(self.tmp.name):
            os.remove(self.tmp.name)

    def test_enqueue_posts_signed_zip_url(self):
        import dce_extraction

        class FakeResp:
            status_code = 200

        sent = {}

        class FakeClient:
            async def __aenter__(self): return self
            async def __aexit__(self, *a): return False
            async def post(self, url, json=None, timeout=None):
                sent["url"] = url
                sent["json"] = json
                return FakeResp()

        async def scenario():
            import database
            db = await database.get_db()
            await db.execute("INSERT INTO tenders (id, reference, title, entity) VALUES (?,?,?,?)",
                             ("T1", "R", "T", "E"))
            await db.commit()
            ok = await dce_extraction.enqueue_extraction("T1", "https://app.example", client=FakeClient())
            await db.close()
            return ok

        ok = run(scenario())
        self.assertTrue(ok)
        self.assertEqual(sent["url"], "https://n8n.example/webhook/extract")
        self.assertEqual(sent["json"]["tender_id"], "T1")
        self.assertIn("/api/dce/T1/archive?token=", sent["json"]["zip_url"])


if __name__ == "__main__":
    unittest.main()
