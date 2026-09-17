import os
import tempfile
import unittest

import auth
import eligibility


def _profile(**overrides):
    base = eligibility.parse_profile({})  # empty defaults
    base.update(overrides)
    return base


class ReservedPmeParseTest(unittest.TestCase):
    def test_positive_markers(self):
        for text in ("Oui", "oui", "Réservé PME", "Réservé aux PME", "PME", "نعم"):
            self.assertTrue(eligibility.is_reserved_pme(text), text)

    def test_negative_or_empty(self):
        for text in ("", None, "Non", "non", "No", "-", "N/A"):
            self.assertFalse(eligibility.is_reserved_pme(text), repr(text))


class EvaluateRuleTest(unittest.TestCase):
    def setUp(self):
        self.tender = {"id": "t1", "category": "Travaux"}
        self.reserved_detail = {"reserved_pme": "Oui"}
        self.open_detail = {"reserved_pme": ""}

    def test_reserved_pme_hides_large_company(self):
        result = eligibility.evaluate(
            self.tender, self.reserved_detail, _profile(size_band="grande")
        )
        self.assertTrue(result["hidden"])
        self.assertTrue(result["reasons"])

    def test_reserved_pme_keeps_pme(self):
        result = eligibility.evaluate(
            self.tender, self.reserved_detail, _profile(size_band="pme")
        )
        self.assertFalse(result["hidden"])

    def test_reserved_pme_keeps_large_company_in_groupement(self):
        result = eligibility.evaluate(
            self.tender,
            self.reserved_detail,
            _profile(size_band="grande", bids_in_groupement=True),
        )
        self.assertFalse(result["hidden"])

    def test_reserved_pme_keeps_when_size_unknown(self):
        result = eligibility.evaluate(self.tender, self.reserved_detail, _profile())
        self.assertFalse(result["hidden"])

    def test_category_mismatch_hidden_when_profile_declares_categories(self):
        tender = {"id": "t2", "category": "Fournitures"}
        result = eligibility.evaluate(
            tender, self.open_detail, _profile(categories=["Travaux"])
        )
        self.assertTrue(result["hidden"])

    def test_category_match_kept(self):
        result = eligibility.evaluate(
            self.tender, self.open_detail, _profile(categories=["Travaux"])
        )
        self.assertFalse(result["hidden"])

    def test_missing_tender_category_kept(self):
        tender = {"id": "t3", "category": ""}
        result = eligibility.evaluate(
            tender, self.open_detail, _profile(categories=["Travaux"])
        )
        self.assertFalse(result["hidden"])

    def test_empty_profile_hides_nothing(self):
        result = eligibility.evaluate(self.tender, self.reserved_detail, _profile())
        self.assertFalse(result["hidden"])


class ProfileHelpersTest(unittest.TestCase):
    def test_parse_profile_defaults(self):
        p = eligibility.parse_profile({})
        self.assertEqual(p["sectors"], [])
        self.assertEqual(p["legal_form"], "")
        self.assertFalse(p["bids_in_groupement"])
        self.assertTrue(eligibility.profile_is_empty(p))

    def test_parse_profile_reads_json_columns(self):
        row = {
            "profile_sectors_json": '["1.12", "1.10"]',
            "profile_categories_json": '["Travaux"]',
            "bids_in_groupement": 1,
            "legal_form": "sarl",
        }
        p = eligibility.parse_profile(row)
        self.assertEqual(p["sectors"], ["1.12", "1.10"])
        self.assertEqual(p["categories"], ["Travaux"])
        self.assertTrue(p["bids_in_groupement"])
        self.assertFalse(eligibility.profile_is_empty(p))

    def test_parse_profile_tolerates_bad_json(self):
        p = eligibility.parse_profile({"profile_sectors_json": "not json"})
        self.assertEqual(p["sectors"], [])


class SectorCategoryTest(unittest.TestCase):
    def test_prefix_maps_to_category(self):
        self.assertEqual(eligibility.sector_category("1.12"), "Travaux")
        self.assertEqual(eligibility.sector_category("2.18"), "Fournitures")
        self.assertEqual(eligibility.sector_category("3.1"), "Services")
        self.assertEqual(eligibility.sector_category("9.9"), "")
        self.assertEqual(eligibility.sector_category(""), "")

    def test_derive_categories_dedupes_and_orders(self):
        self.assertEqual(
            eligibility.derive_categories(["1.12", "1.10", "3.1"]),
            ["Travaux", "Services"],
        )
        self.assertEqual(eligibility.derive_categories([]), [])


class RegionDeriveTest(unittest.TestCase):
    def test_known_cities(self):
        self.assertEqual(eligibility.derive_region("Casablanca"), "Casablanca-Settat")
        self.assertEqual(eligibility.derive_region("FÈS"), "Fès-Meknès")
        self.assertEqual(eligibility.derive_region(" salé "), "Rabat-Salé-Kénitra")
        self.assertEqual(eligibility.derive_region("Laâyoune"), "Laâyoune-Sakia El Hamra")

    def test_unknown_city_is_empty(self):
        self.assertEqual(eligibility.derive_region("Springfield"), "")
        self.assertEqual(eligibility.derive_region(""), "")


class StandingVerdictTest(unittest.TestCase):
    def test_no_answers_unknown(self):
        self.assertEqual(eligibility.evaluate_standing({}), "unknown")

    def test_exclusion_oui_blocks(self):
        self.assertEqual(eligibility.evaluate_standing({"liquidation": "oui"}), "blocked")

    def test_capacity_non_blocks(self):
        self.assertEqual(eligibility.evaluate_standing({"capacite-juridique": "non"}), "blocked")

    def test_uncertain_exclusion_is_risk(self):
        answers = {qid: "non" if kind == "exclusion" else "oui"
                   for qid, kind in eligibility.STANDING_QUESTIONS}
        answers["exclusion-152"] = "nsp"
        self.assertEqual(eligibility.evaluate_standing(answers), "risk")

    def test_all_clear(self):
        answers = {qid: "non" if kind == "exclusion" else "oui"
                   for qid, kind in eligibility.STANDING_QUESTIONS}
        self.assertEqual(eligibility.evaluate_standing(answers), "clear")

    def test_partial_is_unknown(self):
        self.assertEqual(
            eligibility.evaluate_standing({"capacite-juridique": "oui"}), "unknown"
        )


class ClassifyTest(unittest.TestCase):
    def test_empty_profile(self):
        c = eligibility.classify(eligibility.parse_profile({}))
        self.assertEqual(c["completeness"], 0.0)
        self.assertEqual(c["activity_fit"]["categories"], [])
        self.assertIsNone(c["capacity_scale"]["is_pme"])
        self.assertEqual(c["standing"]["verdict"], "unknown")
        self.assertEqual(c["derived"], {})

    def test_categories_derived_from_sectors(self):
        c = eligibility.classify(_profile(sectors=["1.12", "1.13"]))
        self.assertEqual(c["activity_fit"]["categories"], ["Travaux"])
        self.assertEqual(c["activity_fit"]["categories_source"], "derived")
        self.assertEqual(c["derived"]["categories"], ["Travaux"])

    def test_user_categories_win_over_derived(self):
        c = eligibility.classify(_profile(sectors=["1.12"], categories=["Services"]))
        self.assertEqual(c["activity_fit"]["categories"], ["Services"])
        self.assertEqual(c["activity_fit"]["categories_source"], "user")
        self.assertNotIn("categories", c["derived"])

    def test_size_derives_revenue_ceiling_and_pme(self):
        c = eligibility.classify(_profile(size_band="pme"))
        cap = c["capacity_scale"]
        self.assertEqual(cap["revenue_band"], "1m_10m")
        self.assertEqual(cap["revenue_band_source"], "derived")
        self.assertEqual(cap["contract_ceiling"], 20_000_000)
        self.assertTrue(cap["is_pme"])
        self.assertEqual(c["derived"]["revenue_band"], "1m_10m")
        self.assertEqual(c["derived"]["contract_max"], 20_000_000)

    def test_grande_is_not_pme(self):
        c = eligibility.classify(_profile(size_band="grande"))
        self.assertFalse(c["capacity_scale"]["is_pme"])
        self.assertIsNone(c["capacity_scale"]["contract_ceiling"])

    def test_auto_entrepreneur_caps_ceiling_and_is_pme(self):
        c = eligibility.classify(_profile(legal_form="auto_entrepreneur", size_band="eti"))
        # legal form overrides the size default: PME-eligible, ceiling capped.
        self.assertTrue(c["capacity_scale"]["is_pme"])
        self.assertEqual(c["capacity_scale"]["contract_ceiling"],
                         eligibility.AUTO_ENTREPRENEUR_CEILING)

    def test_user_contract_max_not_overwritten(self):
        c = eligibility.classify(_profile(size_band="pme", contract_max=7_000_000))
        self.assertEqual(c["capacity_scale"]["contract_ceiling"], 7_000_000)
        self.assertEqual(c["capacity_scale"]["contract_ceiling_source"], "user")
        self.assertNotIn("contract_max", c["derived"])

    def test_qualification_hint_for_travaux(self):
        c = eligibility.classify(_profile(sectors=["1.12"]))
        self.assertTrue(c["qualifications"]["candidate_families"])

    def test_summary_and_completeness(self):
        profile = _profile(
            legal_form="sarl", sectors=["1.12"], size_band="pme", hq_city="Casablanca",
            standing={qid: "non" if kind == "exclusion" else "oui"
                      for qid, kind in eligibility.STANDING_QUESTIONS},
        )
        c = eligibility.classify(profile)
        self.assertIn("SARL", c["summary"])
        self.assertIn("Travaux", c["summary"])
        self.assertIn("Casablanca-Settat", c["summary"])
        self.assertEqual(c["completeness"], 0.8)  # 4 of 5 groups (no qualifications held)
        self.assertEqual(c["standing"]["verdict"], "clear")


class CatalogEligibleOnlyTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        import database

        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self._old_path = database.DB_PATH
        database.DB_PATH = self.tmp.name
        await database.init_db()

        db = await database.get_db()
        # Two tenders: one PME-reserved, one open. Both public-visible.
        await db.execute(
            """INSERT INTO tenders (id, reference, title, entity, category, status)
               VALUES ('resv', 'R-1', 'Reserved lot', 'Commune X', 'Travaux', 'en_cours')"""
        )
        await db.execute(
            """INSERT INTO tenders (id, reference, title, entity, category, status)
               VALUES ('open', 'O-1', 'Open lot', 'Commune Y', 'Travaux', 'en_cours')"""
        )
        await db.execute(
            "INSERT INTO tender_details (tender_id, reserved_pme) VALUES ('resv', 'Oui')"
        )
        await db.execute(
            "INSERT INTO tender_details (tender_id, reserved_pme) VALUES ('open', '')"
        )
        cur = await db.execute(
            """INSERT INTO users (email, password_hash, name, status, size_band)
               VALUES ('big@test.com', ?, 'Big', 'active', 'grande')""",
            (auth.hash_password("pw"),),
        )
        self.big_id = cur.lastrowid
        cur = await db.execute(
            """INSERT INTO users (email, password_hash, name, status)
               VALUES ('empty@test.com', ?, 'Empty', 'active')""",
            (auth.hash_password("pw"),),
        )
        self.empty_id = cur.lastrowid
        await db.commit()
        await db.close()

    async def asyncTearDown(self):
        import database

        database.DB_PATH = self._old_path
        os.unlink(self.tmp.name)

    def _auth(self, uid, email):
        return f"Bearer {auth.create_token(uid, email)}"

    async def _list(self, **kwargs):
        import main

        defaults = dict(
            q="", category="", sector="", entity="", location="", status="",
            procedure_type="", sort="deadline", order="asc", page=1, per_page=20,
            eligible_only=False, authorization=None,
        )
        defaults.update(kwargs)
        return await main.list_tenders(**defaults)

    async def test_large_company_hides_reserved_tender(self):
        result = await self._list(
            eligible_only=True, authorization=self._auth(self.big_id, "big@test.com")
        )
        ids = {r["id"] for r in result["data"]}
        self.assertIn("open", ids)
        self.assertNotIn("resv", ids)
        self.assertEqual(result["total"], 1)

    async def test_empty_profile_returns_full_catalog(self):
        full = await self._list()  # unfiltered baseline
        filtered = await self._list(
            eligible_only=True, authorization=self._auth(self.empty_id, "empty@test.com")
        )
        self.assertEqual(filtered["total"], full["total"])

    async def test_anonymous_eligible_only_is_unfiltered(self):
        full = await self._list()
        anon = await self._list(eligible_only=True, authorization=None)
        self.assertEqual(anon["total"], full["total"])


if __name__ == "__main__":
    unittest.main()
