import os
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

from datetime import datetime

# A resolved email config with a host set — digest.email_is_configured() treats
# this as "configured" without touching real SMTP.
ENABLED_CFG = {"smtp_host": "smtp.test", "smtp_port": "587"}

from digest import (
    budget_ok,
    has_budget_bounds,
    match_alert,
    parse_deadline,
    parse_estimation,
    render_confirmation,
    render_digest,
    sort_by_deadline,
    split_csv,
)


def make_alert(**over):
    alert = {"sectors": "", "regions": "", "keywords": "", "min_budget": "", "max_budget": ""}
    alert.update(over)
    return alert


def make_tender(**over):
    tender = {
        "id": "T1",
        "sector_code": "A",
        "region": "Casablanca-Settat",
        "title": "Construction d'une ecole",
        "entity": "Commune de Casablanca",
        "location": "CASABLANCA",
        "deadline": "01/09/2026 10:00",
        "estimation": "",
    }
    tender.update(over)
    return tender


class SplitCsvTest(unittest.TestCase):
    def test_splits_and_strips(self):
        self.assertEqual(split_csv(" A, B ,,C "), ["A", "B", "C"])

    def test_empty_and_none_like(self):
        self.assertEqual(split_csv(""), [])


class MatchAlertTest(unittest.TestCase):
    def test_empty_alert_matches_everything(self):
        self.assertTrue(match_alert(make_alert(), make_tender()))

    def test_sector_match_and_mismatch(self):
        self.assertTrue(match_alert(make_alert(sectors="A,D"), make_tender(sector_code="A")))
        self.assertFalse(match_alert(make_alert(sectors="D"), make_tender(sector_code="A")))

    def test_region_match_and_mismatch(self):
        self.assertTrue(match_alert(make_alert(regions="Casablanca-Settat,Oriental"), make_tender()))
        self.assertFalse(match_alert(make_alert(regions="Oriental"), make_tender()))

    def test_keywords_or_within_accent_and_case_insensitive(self):
        # "ecole" must match "École" in the title regardless of accents/case
        tender = make_tender(title="Construction d'une École primaire")
        self.assertTrue(match_alert(make_alert(keywords="hopital, ecole"), tender))
        self.assertFalse(match_alert(make_alert(keywords="hopital, pont"), tender))

    def test_keywords_search_entity_and_location(self):
        self.assertTrue(match_alert(make_alert(keywords="commune"), make_tender()))
        self.assertTrue(match_alert(make_alert(keywords="casablanca"), make_tender(title="x", entity="y")))

    def test_criteria_are_anded(self):
        alert = make_alert(sectors="A", regions="Oriental")
        self.assertFalse(match_alert(alert, make_tender()))  # sector ok, region not


class EstimationTest(unittest.TestCase):
    def test_french_format(self):
        self.assertEqual(parse_estimation("1 234 567,89 MAD"), 1234567.89)

    def test_dot_thousands_comma_decimal(self):
        self.assertEqual(parse_estimation("1.500.000,00 DH"), 1500000.0)

    def test_plain_number(self):
        self.assertEqual(parse_estimation("500000"), 500000.0)

    def test_garbage_and_empty(self):
        self.assertIsNone(parse_estimation("N/A"))
        self.assertIsNone(parse_estimation(""))
        self.assertIsNone(parse_estimation(None))


class BudgetTest(unittest.TestCase):
    def test_no_bounds_always_ok(self):
        self.assertFalse(has_budget_bounds(make_alert()))
        self.assertTrue(budget_ok(make_alert(), None))

    def test_lenient_when_estimation_unknown(self):
        alert = make_alert(min_budget="1000")
        self.assertTrue(has_budget_bounds(alert))
        self.assertTrue(budget_ok(alert, None))
        self.assertTrue(budget_ok(alert, "N/A"))

    def test_bounds_enforced_when_estimation_parses(self):
        alert = make_alert(min_budget="1000", max_budget="2000")
        self.assertFalse(budget_ok(alert, "500,00 MAD"))
        self.assertTrue(budget_ok(alert, "1 500,00 MAD"))
        self.assertFalse(budget_ok(alert, "2 500,00 MAD"))


class ParseDeadlineTest(unittest.TestCase):
    def test_parses_datetime_and_date_only(self):
        self.assertEqual(parse_deadline("05/08/2026 15:00"), datetime(2026, 8, 5, 15, 0))
        self.assertEqual(parse_deadline("05/08/2026"), datetime(2026, 8, 5, 0, 0))

    def test_missing_or_garbage_is_none(self):
        self.assertIsNone(parse_deadline(""))
        self.assertIsNone(parse_deadline(None))
        self.assertIsNone(parse_deadline("bientot"))

    def test_sort_by_deadline_orders_ascending_missing_last(self):
        tenders = [
            make_tender(id="late", deadline="10/09/2026 10:00"),
            make_tender(id="missing", deadline=""),
            make_tender(id="early", deadline="01/09/2026 10:00"),
        ]
        self.assertEqual([t["id"] for t in sort_by_deadline(tenders)], ["early", "late", "missing"])


class RenderDigestTest(unittest.TestCase):
    def test_render_contains_titles_links_and_new_count(self):
        subject, html, text = render_digest([make_tender()], [])
        self.assertIn("1", subject)
        self.assertIn("Construction d'une ecole", html)
        self.assertIn("/tenders/T1", html)
        self.assertIn("Nouveaux appels d'offres", html)
        self.assertIn("Construction d'une ecole", text)

    def test_subject_counts_only_new_not_urgent(self):
        new = [make_tender(id="N1"), make_tender(id="N2")]
        urgent = [make_tender(id="U1"), make_tender(id="U2", title="Reminder tender")]
        subject, html, text = render_digest(new, urgent)
        self.assertIn("2 nouveaux", subject)
        self.assertIn("A traiter bientot", html)
        self.assertIn("Reminder tender", html)
        self.assertIn("A traiter bientot", text)

    def test_urgent_block_omitted_when_empty(self):
        _, html, _ = render_digest([make_tender()], [])
        self.assertNotIn("A traiter bientot", html)

    def test_missing_estimation_shows_non_communiquee(self):
        _, html, _ = render_digest([make_tender(estimation="")], [])
        self.assertIn("Estimation non communiquee", html)


class RenderConfirmationTest(unittest.TestCase):
    def test_summarizes_criteria_and_next_digest_time(self):
        alert = make_alert(name="BTP Casa", sectors="1.10", regions="Casablanca-Settat", keywords="route")
        subject, html, text = render_confirmation(alert)
        self.assertIn("BTP Casa", subject)
        self.assertIn("07:00", html)
        self.assertIn("Terrassements", html)  # sector code 1.10 resolved to its name
        self.assertIn("Casablanca-Settat", html)
        self.assertIn("route", text)

    def test_empty_criteria_render_defaults(self):
        _, html, _ = render_confirmation(make_alert(name="Tout"))
        self.assertIn("Tous les domaines", html)
        self.assertIn("Sans limite", html)


class RunDigestTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        import database

        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.tmp.close()
        self._old_path = database.DB_PATH
        database.DB_PATH = self.tmp.name
        await database.init_db()

        db = await database.get_db()
        # Verified user: the digest only sends to verified addresses.
        await db.execute(
            "INSERT INTO users (email, password_hash, name, email_verified_at) "
            "VALUES ('u1@test.com', 'x', 'U1', datetime('now'))"
        )
        await db.execute(
            """INSERT INTO alert_preferences (user_id, name, sectors, regions, keywords, enabled)
               VALUES (1, 'BTP Casa', 'A', '', '', 1)"""
        )
        await db.execute(
            """INSERT INTO tenders (id, reference, title, entity, entity_code, sector_code,
               sector_name, category, deadline, publication_date, status, procedure_type,
               location, detail_url)
               VALUES ('T1', 'R1', 'Construction ecole', 'Commune X', 'C1', 'A',
               'BTP', 'Travaux', '01/09/2026 10:00', '01/07/2026', 'en_cours', 'AOO',
               'CASABLANCA', '')"""
        )
        await db.commit()
        await db.close()

    async def asyncTearDown(self):
        import database

        database.DB_PATH = self._old_path
        os.unlink(self.tmp.name)

    async def test_sends_one_email_and_logs_then_dedups(self):
        import digest

        sent = []
        with patch.object(digest, "resolve_email_config", AsyncMock(return_value=ENABLED_CFG)), patch.object(
            digest, "send_email", side_effect=lambda cfg, to, s, h, t: sent.append((to, s))
        ):
            result = await digest.run_digest(["T1"])
        self.assertEqual(result["emails_sent"], 1)
        self.assertEqual(result["tenders_matched"], 1)
        self.assertEqual(sent[0][0], "u1@test.com")

        # second run: digest_log dedups, nothing sent
        with patch.object(digest, "resolve_email_config", AsyncMock(return_value=ENABLED_CFG)), patch.object(
            digest, "send_email", side_effect=lambda cfg, to, s, h, t: sent.append((to, s))
        ):
            result = await digest.run_digest(["T1"])
        self.assertEqual(result["emails_sent"], 0)
        self.assertEqual(len(sent), 1)

    async def test_email_disabled_skips_send_and_does_not_log(self):
        import database
        import digest

        with patch.object(digest, "resolve_email_config", AsyncMock(return_value={})):
            result = await digest.run_digest(["T1"])
        self.assertEqual(result["emails_sent"], 0)
        self.assertEqual(result["tenders_matched"], 1)

        db = await database.get_db()
        cursor = await db.execute("SELECT COUNT(*) AS n FROM digest_log")
        row = await cursor.fetchone()
        await db.close()
        self.assertEqual(row["n"], 0)

    async def test_disabled_alert_and_non_matching_tender_ignored(self):
        import database
        import digest

        db = await database.get_db()
        await db.execute("UPDATE alert_preferences SET enabled = 0")
        await db.commit()
        await db.close()

        with patch.object(digest, "resolve_email_config", AsyncMock(return_value=ENABLED_CFG)), patch.object(
            digest, "send_email"
        ) as mock_send:
            result = await digest.run_digest(["T1"])
        self.assertEqual(result["emails_sent"], 0)
        mock_send.assert_not_called()

    async def test_unverified_user_excluded_from_digest(self):
        import database
        import digest

        db = await database.get_db()
        await db.execute("UPDATE users SET email_verified_at = NULL WHERE id = 1")
        await db.commit()
        await db.close()

        with patch.object(digest, "resolve_email_config", AsyncMock(return_value=ENABLED_CFG)), patch.object(
            digest, "send_email"
        ) as mock_send:
            result = await digest.run_digest(["T1"])
        self.assertEqual(result["emails_sent"], 0)
        mock_send.assert_not_called()

    async def _insert_open_tender(self, tender_id: str, deadline: str):
        import database

        db = await database.get_db()
        await db.execute(
            """INSERT INTO tenders (id, reference, title, entity, entity_code, sector_code,
               sector_name, category, deadline, publication_date, status, procedure_type,
               location, detail_url)
               VALUES (?, ?, ?, 'Commune X', 'C1', 'A',
               'BTP', 'Travaux', ?, '01/07/2026', 'en_cours', 'AOO',
               'CASABLANCA', '')""",
            (tender_id, f"R-{tender_id}", f"Tender {tender_id}", deadline),
        )
        await db.commit()
        await db.close()

    async def test_urgent_open_section_included_but_not_logged(self):
        import database
        import digest

        # T2 is a still-open match that is NOT part of this import cycle.
        await self._insert_open_tender("T2", "20/08/2026 10:00")

        captured = {}

        def capture(cfg, to, subject, html, text):
            captured.update(to=to, subject=subject, html=html, text=text)

        with patch.object(digest, "resolve_email_config", AsyncMock(return_value=ENABLED_CFG)), patch.object(
            digest, "send_email", side_effect=capture
        ):
            result = await digest.run_digest(["T1"])

        self.assertEqual(result["emails_sent"], 1)
        self.assertEqual(result["tenders_matched"], 1)  # only T1 is "new"
        self.assertIn("Nouveaux appels d'offres", captured["html"])
        self.assertIn("A traiter bientot", captured["html"])
        self.assertIn("Tender T2", captured["html"])  # reminder shows the open one

        # Only the new tender is logged for dedup; the urgent reminder is not.
        db = await database.get_db()
        cursor = await db.execute("SELECT tender_id FROM digest_log ORDER BY tender_id")
        logged = [r["tender_id"] for r in await cursor.fetchall()]
        await db.close()
        self.assertEqual(logged, ["T1"])

    async def test_no_email_when_no_new_matches_even_if_open_exists(self):
        import database
        import digest

        # Pretend T1 was already sent on a previous run.
        db = await database.get_db()
        await db.execute(
            "INSERT INTO digest_log (user_id, alert_id, tender_id) VALUES (1, 1, 'T1')"
        )
        await db.commit()
        await db.close()

        with patch.object(digest, "resolve_email_config", AsyncMock(return_value=ENABLED_CFG)), patch.object(
            digest, "send_email"
        ) as mock_send:
            result = await digest.run_digest(["T1"])
        self.assertEqual(result["emails_sent"], 0)
        mock_send.assert_not_called()


if __name__ == "__main__":
    unittest.main()
