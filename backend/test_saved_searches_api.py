import os
import tempfile
import unittest

from fastapi import HTTPException

import auth


class SavedSearchesApiTest(unittest.IsolatedAsyncioTestCase):
    """Endpoint-level tests for saved searches: JSON criteria round-trip, unique
    names per user, and per-user scoping. Endpoint functions are called directly
    with a real bearer token (middleware is not in the path)."""

    async def asyncSetUp(self):
        import database

        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self._old_path = database.DB_PATH
        database.DB_PATH = self.tmp.name
        await database.init_db()

        db = await database.get_db()
        c1 = await db.execute(
            "INSERT INTO users (email, password_hash, name) VALUES ('u1@test.com', 'x', 'U1')"
        )
        self.user_id = c1.lastrowid
        c2 = await db.execute(
            "INSERT INTO users (email, password_hash, name) VALUES ('u2@test.com', 'x', 'U2')"
        )
        self.other_id = c2.lastrowid
        await db.commit()
        await db.close()
        self.auth = f"Bearer {auth.create_token(self.user_id, 'u1@test.com')}"
        self.other_auth = f"Bearer {auth.create_token(self.other_id, 'u2@test.com')}"

    async def asyncTearDown(self):
        import database

        database.DB_PATH = self._old_path
        os.unlink(self.tmp.name)

    def _req(self, **over):
        from main import SavedSearchRequest

        return SavedSearchRequest(**over)

    async def test_create_and_list_round_trips_criteria(self):
        import main

        criteria = {"q": "electrique", "sector": "1.12", "location": "Casablanca-Settat"}
        created = await main.create_saved_search(
            self._req(name="Ma recherche", criteria=criteria), self.auth
        )
        self.assertEqual(created["name"], "Ma recherche")
        self.assertEqual(created["criteria"], criteria)

        listing = await main.list_saved_searches(self.auth)
        self.assertEqual(len(listing["data"]), 1)
        self.assertEqual(listing["data"][0]["criteria"], criteria)

    async def test_duplicate_name_conflicts(self):
        import main

        await main.create_saved_search(self._req(name="Dup", criteria={}), self.auth)
        with self.assertRaises(HTTPException) as ctx:
            await main.create_saved_search(self._req(name="Dup", criteria={}), self.auth)
        self.assertEqual(ctx.exception.status_code, 409)

    async def test_blank_name_rejected(self):
        import main

        with self.assertRaises(HTTPException) as ctx:
            await main.create_saved_search(self._req(name="   ", criteria={}), self.auth)
        self.assertEqual(ctx.exception.status_code, 422)

    async def test_update_changes_name_and_criteria(self):
        import main

        created = await main.create_saved_search(self._req(name="Old", criteria={"q": "a"}), self.auth)
        updated = await main.update_saved_search(
            created["id"], self._req(name="New", criteria={"q": "b"}), self.auth
        )
        self.assertEqual(updated["name"], "New")
        self.assertEqual(updated["criteria"], {"q": "b"})

    async def test_update_missing_returns_404(self):
        import main

        with self.assertRaises(HTTPException) as ctx:
            await main.update_saved_search(999, self._req(name="X", criteria={}), self.auth)
        self.assertEqual(ctx.exception.status_code, 404)

    async def test_delete_is_scoped_to_owner(self):
        import main

        created = await main.create_saved_search(self._req(name="Mine", criteria={}), self.auth)
        # Another user's delete must not remove it.
        await main.delete_saved_search(created["id"], self.other_auth)
        self.assertEqual(len((await main.list_saved_searches(self.auth))["data"]), 1)
        # Owner's delete removes it.
        await main.delete_saved_search(created["id"], self.auth)
        self.assertEqual(len((await main.list_saved_searches(self.auth))["data"]), 0)

    async def test_list_is_scoped_per_user(self):
        import main

        await main.create_saved_search(self._req(name="U1 search", criteria={}), self.auth)
        other_listing = await main.list_saved_searches(self.other_auth)
        self.assertEqual(len(other_listing["data"]), 0)


if __name__ == "__main__":
    unittest.main()
