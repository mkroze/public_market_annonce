import os
import tempfile
import unittest

from fastapi import HTTPException

import auth


class AccountApiTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        import database

        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self._old_path = database.DB_PATH
        database.DB_PATH = self.tmp.name
        await database.init_db()

        db = await database.get_db()
        cursor = await db.execute(
            """INSERT INTO users (email, password_hash, name, company, phone, status)
               VALUES (?, ?, ?, ?, ?, ?)""",
            ("member@test.com", auth.hash_password("old-password"), "Member", "ACME", "0600000000", "active"),
        )
        self.user_id = cursor.lastrowid
        await db.commit()
        await db.close()
        self.authorization = f"Bearer {auth.create_token(self.user_id, 'member@test.com')}"

    async def asyncTearDown(self):
        import database

        database.DB_PATH = self._old_path
        os.unlink(self.tmp.name)

    async def test_get_account_requires_authentication(self):
        import main

        with self.assertRaises(HTTPException) as ctx:
            await main.get_account(None)

        self.assertEqual(ctx.exception.status_code, 401)

    async def test_get_account_returns_safe_current_account(self):
        import main

        account = await main.get_account(self.authorization)

        self.assertEqual(account["email"], "member@test.com")
        self.assertEqual(account["name"], "Member")
        self.assertEqual(account["company"], "ACME")
        self.assertEqual(account["phone"], "0600000000")
        self.assertEqual(account["theme"], "system")
        self.assertNotIn("password_hash", account)

    async def test_update_theme_accepts_allowed_values(self):
        import main

        for theme in ("system", "light", "dark"):
            account = await main.update_account_preferences(
                main.AccountPreferencesRequest(theme=theme),
                self.authorization,
            )
            self.assertEqual(account["theme"], theme)

    async def test_update_theme_rejects_invalid_value(self):
        import main

        with self.assertRaises(HTTPException) as ctx:
            await main.update_account_preferences(
                main.AccountPreferencesRequest(theme="blue"),
                self.authorization,
            )

        self.assertEqual(ctx.exception.status_code, 422)

    async def test_change_password_rejects_wrong_current_password(self):
        import main

        with self.assertRaises(HTTPException) as ctx:
            await main.change_account_password(
                main.ChangePasswordRequest(
                    current_password="wrong-password",
                    new_password="new-password",
                ),
                self.authorization,
            )

        self.assertEqual(ctx.exception.status_code, 400)

    async def test_change_password_rejects_short_password(self):
        import main

        with self.assertRaises(HTTPException) as ctx:
            await main.change_account_password(
                main.ChangePasswordRequest(
                    current_password="old-password",
                    new_password="short",
                ),
                self.authorization,
            )

        self.assertEqual(ctx.exception.status_code, 400)

    async def test_change_password_rejects_same_password(self):
        import main

        with self.assertRaises(HTTPException) as ctx:
            await main.change_account_password(
                main.ChangePasswordRequest(
                    current_password="old-password",
                    new_password="old-password",
                ),
                self.authorization,
            )

        self.assertEqual(ctx.exception.status_code, 400)

    async def test_change_password_updates_hash(self):
        import database
        import main

        result = await main.change_account_password(
            main.ChangePasswordRequest(
                current_password="old-password",
                new_password="new-password",
            ),
            self.authorization,
        )

        self.assertEqual(result, {"status": "updated"})

        db = await database.get_db()
        cursor = await db.execute("SELECT password_hash FROM users WHERE id = ?", (self.user_id,))
        stored = (await cursor.fetchone())["password_hash"]
        await db.close()

        self.assertTrue(auth.verify_password("new-password", stored))
        self.assertFalse(auth.verify_password("old-password", stored))

    async def test_login_rejects_non_active_user(self):
        import database
        import main

        db = await database.get_db()
        await db.execute("UPDATE users SET status = 'suspended' WHERE id = ?", (self.user_id,))
        await db.commit()
        await db.close()

        with self.assertRaises(HTTPException) as ctx:
            await main.login(main.LoginRequest(email="member@test.com", password="old-password"))

        self.assertEqual(ctx.exception.status_code, 403)

    async def test_require_user_rejects_non_active_user(self):
        import database
        import main

        db = await database.get_db()
        await db.execute("UPDATE users SET status = 'deleted' WHERE id = ?", (self.user_id,))
        await db.commit()
        await db.close()

        with self.assertRaises(HTTPException) as ctx:
            await main.require_user(self.authorization)

        self.assertEqual(ctx.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
