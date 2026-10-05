import os
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

import auth

# Resolved email config with a host → treated as "configured" without real SMTP.
ENABLED_CFG = {"smtp_host": "smtp.test", "smtp_port": "587"}


class AlertsApiTest(unittest.IsolatedAsyncioTestCase):
    """Endpoint-level tests for the beta alert rules: one alert per account and
    the confirmation-email lifecycle. Endpoint functions are called directly
    with a real bearer token (middleware is not in the path)."""

    async def asyncSetUp(self):
        import database

        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self._old_path = database.DB_PATH
        database.DB_PATH = self.tmp.name
        await database.init_db()

        db = await database.get_db()
        cursor = await db.execute(
            "INSERT INTO users (email, password_hash, name) VALUES ('u1@test.com', 'x', 'U1')"
        )
        await db.commit()
        self.user_id = cursor.lastrowid
        await db.close()
        self.auth = f"Bearer {auth.create_token(self.user_id, 'u1@test.com')}"

    async def asyncTearDown(self):
        import database

        database.DB_PATH = self._old_path
        os.unlink(self.tmp.name)

    def _req(self, **over):
        from main import AlertRequest

        return AlertRequest(**over)

    async def _count_alerts(self):
        import database

        db = await database.get_db()
        cursor = await db.execute("SELECT COUNT(*) AS n FROM alert_preferences")
        n = (await cursor.fetchone())["n"]
        await db.close()
        return n

    async def test_one_alert_limit_blocks_second_create(self):
        import main

        with patch.object(main, "resolve_email_config", AsyncMock(return_value={})):
            await main.create_alert(self._req(name="A1"), self.auth)
            with self.assertRaises(HTTPException) as ctx:
                await main.create_alert(self._req(name="A2"), self.auth)
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertEqual(await self._count_alerts(), 1)

    async def test_confirmation_sent_on_enabled_create(self):
        import main

        sent = []
        with patch.object(main, "resolve_email_config", AsyncMock(return_value=ENABLED_CFG)), patch.object(
            main, "send_email", side_effect=lambda cfg, to, s, h, t: sent.append(to)
        ):
            res = await main.create_alert(self._req(name="A1", enabled=True), self.auth)
        self.assertTrue(res["email"]["attempted"])
        self.assertTrue(res["email"]["delivered"])
        self.assertEqual(sent, ["u1@test.com"])

    async def test_no_confirmation_on_disabled_create(self):
        import main

        with patch.object(main, "resolve_email_config", AsyncMock(return_value=ENABLED_CFG)), patch.object(
            main, "send_email"
        ) as mock_send:
            res = await main.create_alert(self._req(name="A1", enabled=False), self.auth)
        self.assertFalse(res["email"]["attempted"])
        self.assertEqual(res["email"]["reason"], "disabled_alert")
        mock_send.assert_not_called()

    async def test_confirmation_on_reactivation(self):
        import main

        with patch.object(main, "resolve_email_config", AsyncMock(return_value=ENABLED_CFG)), patch.object(
            main, "send_email"
        ) as mock_send:
            created = await main.create_alert(self._req(name="A1", enabled=False), self.auth)
            mock_send.assert_not_called()  # disabled create sends nothing
            res = await main.update_alert(created["id"], self._req(name="A1", enabled=True), self.auth)
        self.assertTrue(res["email"]["delivered"])
        self.assertEqual(mock_send.call_count, 1)

    async def test_confirmation_on_enabled_edit(self):
        import main

        with patch.object(main, "resolve_email_config", AsyncMock(return_value=ENABLED_CFG)), patch.object(
            main, "send_email"
        ) as mock_send:
            created = await main.create_alert(self._req(name="A1", enabled=True), self.auth)
            res = await main.update_alert(
                created["id"], self._req(name="A1 modifiee", enabled=True), self.auth
            )
        self.assertTrue(res["email"]["delivered"])
        self.assertEqual(mock_send.call_count, 2)  # create + edit both confirm

    async def test_update_missing_alert_returns_404(self):
        import main

        with patch.object(main, "resolve_email_config", AsyncMock(return_value={})):
            with self.assertRaises(HTTPException) as ctx:
                await main.update_alert(999, self._req(name="X"), self.auth)
        self.assertEqual(ctx.exception.status_code, 404)

    async def test_save_succeeds_when_confirmation_send_fails(self):
        import main

        def boom(*a, **k):
            raise RuntimeError("smtp down")

        with patch.object(main, "resolve_email_config", AsyncMock(return_value=ENABLED_CFG)), patch.object(
            main, "send_email", side_effect=boom
        ):
            res = await main.create_alert(self._req(name="A1", enabled=True), self.auth)

        # Alert persists even though the confirmation email failed.
        self.assertEqual(res["status"], "created")
        self.assertTrue(res["email"]["attempted"])
        self.assertFalse(res["email"]["delivered"])
        self.assertEqual(res["email"]["reason"], "send_failed")
        self.assertEqual(await self._count_alerts(), 1)


if __name__ == "__main__":
    unittest.main()
