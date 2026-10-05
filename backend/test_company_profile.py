import os
import tempfile
import unittest

from fastapi import HTTPException

import auth


PROFILE_COLUMNS = {
    "legal_form", "ice", "rc_number", "rc_city", "if_number", "cnss_number",
    "patente_number", "hq_city", "profile_sectors_json", "profile_categories_json",
    "qualifications_json", "certifications_json", "coverage_regions_json",
    "profile_keywords", "size_band", "revenue_band", "contract_min", "contract_max",
    "bids_in_groupement", "preferred_procedures_json", "eligibility_filter_default",
}


class CompanyProfileSchemaTest(unittest.IsolatedAsyncioTestCase):
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

    async def test_init_db_adds_all_profile_columns(self):
        import database

        db = await database.get_db()
        cursor = await db.execute("PRAGMA table_info(users)")
        cols = {row["name"] for row in await cursor.fetchall()}
        await db.close()

        missing = PROFILE_COLUMNS - cols
        self.assertEqual(missing, set(), f"missing profile columns: {missing}")


class CompanyProfileApiTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        import database

        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self._old_path = database.DB_PATH
        database.DB_PATH = self.tmp.name
        await database.init_db()

        db = await database.get_db()
        cursor = await db.execute(
            """INSERT INTO users (email, password_hash, name, company, status)
               VALUES (?, ?, ?, ?, ?)""",
            ("member@test.com", auth.hash_password("old-password"), "Member", "ACME", "active"),
        )
        self.user_id = cursor.lastrowid
        await db.commit()
        await db.close()
        self.authorization = f"Bearer {auth.create_token(self.user_id, 'member@test.com')}"

    async def asyncTearDown(self):
        import database

        database.DB_PATH = self._old_path
        os.unlink(self.tmp.name)

    async def test_get_account_returns_empty_profile_defaults(self):
        import main

        account = await main.get_account(self.authorization)

        self.assertIn("profile", account)
        profile = account["profile"]
        self.assertEqual(profile["legal_form"], "")
        self.assertEqual(profile["sectors"], [])
        self.assertEqual(profile["categories"], [])
        self.assertEqual(profile["coverage_regions"], [])
        self.assertEqual(profile["certifications"], [])
        self.assertFalse(profile["bids_in_groupement"])
        self.assertFalse(profile["eligibility_filter_default"])
        self.assertNotIn("password_hash", account)

    async def test_update_profile_roundtrips_and_is_progressive(self):
        import main

        updated = await main.update_account_profile(
            main.ProfileUpdate(legal_form="sarl", sectors=["1.12"], size_band="pme"),
            self.authorization,
        )
        self.assertEqual(updated["profile"]["legal_form"], "sarl")
        self.assertEqual(updated["profile"]["sectors"], ["1.12"])
        self.assertEqual(updated["profile"]["size_band"], "pme")

        # A second partial patch must not wipe previously-set fields.
        updated2 = await main.update_account_profile(
            main.ProfileUpdate(hq_city="Casablanca"),
            self.authorization,
        )
        self.assertEqual(updated2["profile"]["hq_city"], "Casablanca")
        self.assertEqual(updated2["profile"]["legal_form"], "sarl")
        self.assertEqual(updated2["profile"]["sectors"], ["1.12"])

    async def test_update_profile_rejects_invalid_legal_form(self):
        import main

        with self.assertRaises(HTTPException) as ctx:
            await main.update_account_profile(
                main.ProfileUpdate(legal_form="wizard"),
                self.authorization,
            )
        self.assertEqual(ctx.exception.status_code, 422)

    async def test_update_profile_rejects_invalid_size_band(self):
        import main

        with self.assertRaises(HTTPException) as ctx:
            await main.update_account_profile(
                main.ProfileUpdate(size_band="enormous"),
                self.authorization,
            )
        self.assertEqual(ctx.exception.status_code, 422)

    async def test_update_profile_requires_authentication(self):
        import main

        with self.assertRaises(HTTPException) as ctx:
            await main.update_account_profile(main.ProfileUpdate(legal_form="sarl"), None)
        self.assertEqual(ctx.exception.status_code, 401)

    async def test_update_profile_rejects_non_active_user(self):
        import database
        import main

        db = await database.get_db()
        await db.execute("UPDATE users SET status = 'suspended' WHERE id = ?", (self.user_id,))
        await db.commit()
        await db.close()

        with self.assertRaises(HTTPException) as ctx:
            await main.update_account_profile(
                main.ProfileUpdate(legal_form="sarl"),
                self.authorization,
            )
        self.assertEqual(ctx.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
