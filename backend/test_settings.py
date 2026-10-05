import os
import tempfile
import unittest
from unittest.mock import patch

# Neutralizes any ambient SMTP_* env so tests exercise DB values deterministically.
NO_ENV = {
    "SMTP_HOST": "", "SMTP_PORT": "", "SMTP_USER": "",
    "SMTP_PASSWORD": "", "SMTP_FROM": "", "SMTP_FROM_NAME": "",
}

OWNER = {"id": 1, "email": "owner@test.com", "role": "owner", "status": "active"}


class _TempDbCase(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        import database

        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self._old_path = database.DB_PATH
        database.DB_PATH = self.tmp.name
        await database.init_db()

    async def asyncTearDown(self):
        import database

        database.DB_PATH = self._old_path
        os.unlink(self.tmp.name)


class ResolveEmailConfigTest(_TempDbCase):
    async def test_env_fallback_when_db_empty(self):
        import settings

        env = {"SMTP_HOST": "envhost", "SMTP_PORT": "25", "SMTP_FROM": "env@x.ma"}
        with patch.dict(os.environ, {**NO_ENV, **env}, clear=False):
            config = await settings.resolve_email_config()
        self.assertEqual(config["smtp_host"], "envhost")
        self.assertEqual(config["smtp_port"], "25")
        self.assertEqual(config["smtp_from"], "env@x.ma")

    async def test_db_value_overrides_env(self):
        import database
        import settings

        db = await database.get_db()
        await settings.set_email_settings(db, {"smtp_host": "dbhost"}, updated_by="owner@test.com")
        await db.close()

        with patch.dict(os.environ, {**NO_ENV, "SMTP_HOST": "envhost"}, clear=False):
            config = await settings.resolve_email_config()
        self.assertEqual(config["smtp_host"], "dbhost")

    async def test_set_ignores_unknown_keys(self):
        import database
        import settings

        db = await database.get_db()
        await settings.set_email_settings(db, {"smtp_host": "h", "bogus": "x"})
        cursor = await db.execute("SELECT key FROM app_settings ORDER BY key")
        keys = [r["key"] for r in await cursor.fetchall()]
        await db.close()
        self.assertEqual(keys, ["smtp_host"])


class AdminEmailSettingsEndpointTest(_TempDbCase):
    async def test_get_never_returns_password_and_reports_status(self):
        import admin
        import database
        import settings

        db = await database.get_db()
        await settings.set_email_settings(db, {"smtp_host": "h", "smtp_password": "secret"})
        await db.close()

        with patch.dict(os.environ, NO_ENV, clear=False):
            view = await admin.admin_get_email_settings(user=OWNER)
        self.assertNotIn("smtp_password", view)
        self.assertTrue(view["password_set"])
        self.assertTrue(view["configured"])

    async def test_put_stores_and_audits_with_redacted_password(self):
        import admin
        import database

        req = admin.EmailSettingsPatch(smtp_host="relay.test", smtp_password="topsecret")
        with patch.dict(os.environ, NO_ENV, clear=False):
            res = await admin.admin_update_email_settings(req, None, user=OWNER)
        self.assertTrue(res["password_updated"])
        self.assertTrue(res["password_set"])

        db = await database.get_db()
        # Password is stored...
        cursor = await db.execute("SELECT value FROM app_settings WHERE key = 'smtp_password'")
        self.assertEqual((await cursor.fetchone())["value"], "topsecret")
        # ...but the audit row redacts it.
        cursor = await db.execute(
            "SELECT after_json FROM admin_audit_logs WHERE action = 'settings.email.update'"
        )
        after = (await cursor.fetchone())["after_json"]
        await db.close()
        self.assertIn("***", after)
        self.assertNotIn("topsecret", after)

    async def test_blank_password_preserves_stored(self):
        import admin
        import database

        with patch.dict(os.environ, NO_ENV, clear=False):
            await admin.admin_update_email_settings(
                admin.EmailSettingsPatch(smtp_host="h", smtp_password="keepme"), None, user=OWNER
            )
            # Second update omits the password → stored one must survive.
            res = await admin.admin_update_email_settings(
                admin.EmailSettingsPatch(smtp_host="h2"), None, user=OWNER
            )
        self.assertFalse(res["password_updated"])
        self.assertTrue(res["password_set"])

        db = await database.get_db()
        cursor = await db.execute("SELECT value FROM app_settings WHERE key = 'smtp_password'")
        self.assertEqual((await cursor.fetchone())["value"], "keepme")
        cursor = await db.execute("SELECT value FROM app_settings WHERE key = 'smtp_host'")
        self.assertEqual((await cursor.fetchone())["value"], "h2")
        await db.close()

    async def test_test_endpoint_sends_when_configured(self):
        import admin
        import database
        import settings

        db = await database.get_db()
        await settings.set_email_settings(db, {"smtp_host": "relay.test", "smtp_password": "x"})
        await db.close()

        sent = []
        with patch.dict(os.environ, NO_ENV, clear=False), patch.object(
            admin, "send_email", side_effect=lambda cfg, to, s, h, t: sent.append((to, cfg["smtp_host"]))
        ):
            res = await admin.admin_test_email_settings(None, user=OWNER)
        self.assertEqual(res["status"], "sent")
        self.assertEqual(sent, [("owner@test.com", "relay.test")])


if __name__ == "__main__":
    unittest.main()
