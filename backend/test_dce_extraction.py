import asyncio
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


if __name__ == "__main__":
    unittest.main()
