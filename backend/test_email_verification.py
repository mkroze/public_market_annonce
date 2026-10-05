import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

import auth
import tokens


class EmailVerificationTest(unittest.IsolatedAsyncioTestCase):
    """Endpoint-level tests for the email verification + password reset flow.
    Endpoint functions are called directly; email rendering/transport is patched
    so we can capture the raw one-time token without real SMTP."""

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

    async def _register(self, main, email="new@test.com", password="password123", sent=True):
        """Register a user, capturing the raw verification token from the
        (patched) template renderer. Returns (response, raw_token, auth_header)."""
        from main import RegisterRequest

        captured = {}

        def fake_verify(token):
            captured["token"] = token
            return ("subject", "<p>html</p>", "text")

        with patch.object(main, "render_verify_email", side_effect=fake_verify), patch.object(
            main, "_send_email_best_effort", AsyncMock(return_value=sent)
        ):
            res = await main.register(RegisterRequest(email=email, password=password, name="New"))
        header = f"Bearer {auth.create_token(res['user']['id'], res['user']['email'])}"
        return res, captured.get("token"), header

    async def test_register_creates_unverified_user(self):
        import database
        import main

        res, raw, _ = await self._register(main)
        self.assertFalse(res["user"]["email_verified"])
        self.assertTrue(res["verification_email_sent"])
        self.assertIsNotNone(raw)

        db = await database.get_db()
        cursor = await db.execute("SELECT email_verified_at FROM users WHERE email = 'new@test.com'")
        row = await cursor.fetchone()
        await db.close()
        self.assertIsNone(row["email_verified_at"])

    async def test_register_succeeds_when_smtp_unconfigured(self):
        import main

        res, _, _ = await self._register(main, sent=False)
        self.assertFalse(res["verification_email_sent"])
        self.assertIn("token", res)  # user still gets a session

    async def test_verify_email_marks_verified(self):
        import main
        from main import TokenRequest

        res, raw, header = await self._register(main)
        result = await main.verify_email(TokenRequest(token=raw))
        self.assertTrue(result["email_verified"])

        me = await main.me(header)
        self.assertTrue(me["email_verified"])

    async def test_verify_email_rejects_unknown_token(self):
        import main
        from main import TokenRequest

        await self._register(main)
        with self.assertRaises(HTTPException) as ctx:
            await main.verify_email(TokenRequest(token="nope"))
        self.assertEqual(ctx.exception.status_code, 400)

    async def test_verify_email_rejects_used_token(self):
        import main
        from main import TokenRequest

        _, raw, _ = await self._register(main)
        await main.verify_email(TokenRequest(token=raw))
        with self.assertRaises(HTTPException) as ctx:
            await main.verify_email(TokenRequest(token=raw))
        self.assertEqual(ctx.exception.status_code, 400)

    async def test_verify_email_rejects_expired_token(self):
        import database
        import main
        from main import TokenRequest

        res, _, _ = await self._register(main)
        uid = res["user"]["id"]
        raw = "expired-raw-token"
        db = await database.get_db()
        await db.execute(
            "INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at) VALUES (?, ?, ?, ?)",
            (
                uid,
                tokens.VERIFY_EMAIL,
                tokens._hash_token(raw),
                (datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=1)).strftime(
                    "%Y-%m-%d %H:%M:%S"
                ),
            ),
        )
        await db.commit()
        await db.close()
        with self.assertRaises(HTTPException) as ctx:
            await main.verify_email(TokenRequest(token=raw))
        self.assertEqual(ctx.exception.status_code, 400)

    async def test_resend_verification_rate_limited(self):
        import main

        _, _, header = await self._register(main)
        # register just issued a token < 2 min ago → resend refused.
        with patch.object(main, "_send_email_best_effort", AsyncMock(return_value=True)):
            with self.assertRaises(HTTPException) as ctx:
                await main.resend_verification(header)
        self.assertEqual(ctx.exception.status_code, 429)

    async def test_resend_verification_noop_when_already_verified(self):
        import main
        from main import TokenRequest

        _, raw, header = await self._register(main)
        await main.verify_email(TokenRequest(token=raw))
        result = await main.resend_verification(header)
        self.assertTrue(result["already_verified"])

    async def test_password_reset_no_account_enumeration(self):
        import main
        from main import RequestPasswordReset

        with patch.object(main, "_send_email_best_effort", AsyncMock(return_value=True)) as mock_send:
            result = await main.request_password_reset(RequestPasswordReset(email="ghost@test.com"))
        self.assertEqual(result, {"status": "ok"})
        mock_send.assert_not_awaited()

    async def test_password_reset_changes_password(self):
        import database
        import main
        from main import RequestPasswordReset, ResetPasswordRequest

        await self._register(main, password="oldpassword")

        captured = {}

        def fake_reset(token):
            captured["token"] = token
            return ("s", "h", "t")

        with patch.object(main, "render_password_reset", side_effect=fake_reset), patch.object(
            main, "_send_email_best_effort", AsyncMock(return_value=True)
        ):
            await main.request_password_reset(RequestPasswordReset(email="new@test.com"))
        raw = captured["token"]

        await main.reset_password(ResetPasswordRequest(token=raw, password="brandnewpass"))

        db = await database.get_db()
        cursor = await db.execute("SELECT password_hash FROM users WHERE email = 'new@test.com'")
        stored = (await cursor.fetchone())["password_hash"]
        await db.close()
        self.assertTrue(auth.verify_password("brandnewpass", stored))
        self.assertFalse(auth.verify_password("oldpassword", stored))

    async def test_reset_password_rejects_short(self):
        import main
        from main import ResetPasswordRequest

        with self.assertRaises(HTTPException) as ctx:
            await main.reset_password(ResetPasswordRequest(token="whatever", password="short"))
        self.assertEqual(ctx.exception.status_code, 400)

    async def test_reset_password_rejects_unknown_token(self):
        import main
        from main import ResetPasswordRequest

        with self.assertRaises(HTTPException) as ctx:
            await main.reset_password(ResetPasswordRequest(token="unknown-token", password="longenough"))
        self.assertEqual(ctx.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
