import unittest

from digest import (
    budget_ok,
    has_budget_bounds,
    match_alert,
    parse_estimation,
    render_digest,
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


class RenderDigestTest(unittest.TestCase):
    def test_render_contains_titles_links_and_count(self):
        sections = [("Mon alerte BTP", [make_tender()])]
        subject, html, text = render_digest(sections)
        self.assertIn("1", subject)
        self.assertIn("Construction d'une ecole", html)
        self.assertIn("/tenders/T1", html)
        self.assertIn("Mon alerte BTP", html)
        self.assertIn("Construction d'une ecole", text)

    def test_missing_estimation_shows_non_communiquee(self):
        _, html, _ = render_digest([("A", [make_tender(estimation="")])])
        self.assertIn("Estimation non communiquee", html)


if __name__ == "__main__":
    unittest.main()
