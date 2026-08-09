import unittest

from tender_display import build_tender_display, clean_text, parse_money


class TenderDisplayTest(unittest.TestCase):
    def test_clean_text_collapses_whitespace_and_trims_punctuation(self):
        self.assertEqual(
            clean_text("  Travaux\n\t de voirie  -  "),
            "Travaux de voirie",
        )

    def test_title_removes_trailing_duplicate_commune_when_location_matches(self):
        tender = {
            "reference": "AOO/12",
            "title": "Travaux d'amenagement des voies - Commune de Zegzel",
            "entity": "COMMUNE DE ZEGZEL",
            "location": "BERKANE",
            "procedure_type": "AOO",
            "category": "Travaux",
            "deadline": "15/09/2026 10:00",
        }
        details = {
            "objet": "Travaux d'amenagement des voies - Commune de Zegzel",
            "acheteur": "Commune de Zegzel",
            "lieu_execution": "Commune de Zegzel",
            "estimation": "",
            "caution_provisoire": "",
            "prix_plans": "",
            "dce_url": "",
        }

        result = build_tender_display(tender, details)

        self.assertEqual(result["display"]["title"]["value"], "Travaux d'amenagement des voies")
        self.assertEqual(result["display"]["title"]["source"], "detail")
        self.assertEqual(result["display"]["buyer"]["value"], "Commune de Zegzel")
        self.assertEqual(result["display"]["location"]["value"], "Commune de Zegzel")

    def test_title_preserves_non_matching_commune_suffix(self):
        tender = {
            "reference": "REF-LOCATION",
            "title": "Travaux de voirie - Commune de Taza",
            "entity": "Commune de Berkane",
            "location": "Berkane",
        }

        result = build_tender_display(tender)

        self.assertEqual(
            result["display"]["title"]["value"],
            "Travaux de voirie - Commune de Taza",
        )

    def test_title_preserves_commune_suffix_when_canonical_location_is_token_prefix(self):
        tender = {
            "title": "Travaux de voirie - Commune de Tazaghine",
            "location": "Taza",
        }

        result = build_tender_display(tender)

        self.assertEqual(
            result["display"]["title"]["value"],
            "Travaux de voirie - Commune de Tazaghine",
        )

    def test_title_preserves_location_suffix_when_removal_leaves_generic_title(self):
        tender = {
            "title": "Travaux à la commune de Taza",
            "entity": "Commune de Taza",
        }

        result = build_tender_display(tender)

        self.assertEqual(result["display"]["title"]["value"], "Travaux à la commune de Taza")

    def test_generic_detail_object_falls_back_to_descriptive_base_title(self):
        tender = {"title": "Travaux de voirie de la commune de Taza"}
        details = {"objet": "Travaux"}

        result = build_tender_display(tender, details)

        self.assertEqual(result["display"]["title"]["value"], tender["title"])
        self.assertEqual(result["display"]["title"]["source"], "base")
        self.assertEqual(result["display"]["title"]["raw"], tender["title"])

    def test_display_fields_preserve_original_selected_source_values(self):
        tender = {
            "reference": " REF-RAW ",
            "title": " Base title - ",
            "entity": " Base buyer ",
            "location": " Base location ",
            "procedure_type": " BASE PROCEDURE ",
            "category": " BASE CATEGORY ",
            "deadline": " 20/09/2026 09:00 ",
        }
        details = {
            "objet": "  Detail title - ",
            "acheteur": " Detail buyer ",
            "lieu_execution": " Detail location ",
            "procedure": " Detail procedure ",
            "categorie": " Detail category ",
        }

        result = build_tender_display(tender, details)
        display = result["display"]

        self.assertEqual(display["title"]["raw"], "  Detail title - ")
        self.assertEqual(display["buyer"]["raw"], " Detail buyer ")
        self.assertEqual(display["location"]["raw"], " Detail location ")
        self.assertEqual(display["procedure"]["raw"], " Detail procedure ")
        self.assertEqual(display["category"]["raw"], " Detail category ")
        self.assertEqual(display["deadline"]["raw"], " 20/09/2026 09:00 ")
        self.assertEqual(display["reference"]["raw"], " REF-RAW ")

    def test_whitespace_detail_estimation_uses_base_source(self):
        tender = {"estimation": " 1 000 MAD "}

        result = build_tender_display(tender, {"estimation": "   "})

        self.assertEqual(result["signals"]["estimation"]["value"], "1 000 MAD")
        self.assertEqual(result["signals"]["estimation"]["source"], "base")
        self.assertEqual(result["signals"]["estimation"]["raw"], " 1 000 MAD ")

    def test_base_tender_only_returns_missing_signal_states(self):
        tender = {
            "reference": "REF-1",
            "title": "Fourniture de mobilier",
            "entity": "Province de Safi",
            "location": "SAFI",
            "procedure_type": "AOO",
            "category": "Fournitures",
            "deadline": "20/09/2026 09:00",
            "detail_url": "https://example.test/detail",
        }

        result = build_tender_display(tender, None)

        self.assertEqual(result["display"]["title"]["value"], "Fourniture de mobilier")
        self.assertEqual(result["display"]["buyer"]["value"], "Province de Safi")
        self.assertEqual(result["signals"]["estimation"]["status"], "missing")
        self.assertEqual(result["signals"]["caution"]["status"], "missing")
        self.assertEqual(result["signals"]["dce_available"]["value"], False)
        self.assertEqual(result["signals"]["dce_available"]["status"], "missing")

    def test_parse_money_supports_moroccan_formats(self):
        self.assertEqual(parse_money("1 234 567,89 MAD"), 1234567.89)
        self.assertEqual(parse_money("1.234.567,89 DH"), 1234567.89)
        self.assertEqual(parse_money("20.000 DH"), 20000.0)
        self.assertEqual(parse_money("1234567.89"), 1234567.89)
        self.assertIsNone(parse_money("Non communique"))

    def test_nonnumeric_primary_estimation_retries_labeled_stored_text(self):
        result = build_tender_display(
            {},
            {
                "estimation": "Non communique",
                "contact": "Estimation TTC: 1 200 000,00 MAD",
            },
        )

        self.assertEqual(result["signals"]["estimation"]["value"], "1 200 000,00 MAD")
        self.assertEqual(result["signals"]["estimation"]["source"], "regex")

    def test_market_price_requires_explicit_currency_for_labeled_text(self):
        ambiguous = build_tender_display({}, {"contact": "Offre retenue: 3 candidats"})
        monetary = build_tender_display({}, {"contact": "Offre retenue: 20.000 DH"})

        self.assertEqual(ambiguous["signals"]["market_price"]["status"], "missing")
        self.assertEqual(monetary["signals"]["market_price"]["status"], "needs_verification")
        self.assertEqual(monetary["signals"]["market_price"]["value"], "20.000 DH")

    def test_buyer_prefers_fuller_equivalent_base_value(self):
        result = build_tender_display(
            {"entity": "Commune de Zegzel, Province de Berkane"},
            {"acheteur": "Commune de Zegzel"},
        )

        self.assertEqual(result["display"]["buyer"]["value"], "Commune de Zegzel, Province de Berkane")
        self.assertEqual(result["display"]["buyer"]["source"], "base")

    def test_location_uses_cautious_title_fallback_when_no_raw_location_exists(self):
        result = build_tender_display(
            {"title": "Travaux de voirie - Commune de Taza"},
            {"objet": "Travaux de voirie - Commune de Taza"},
        )

        self.assertEqual(result["display"]["location"]["value"], "Commune de Taza")
        self.assertEqual(result["display"]["location"]["status"], "needs_verification")
        self.assertEqual(result["display"]["location"]["source"], "computed")

    def test_zero_estimation_is_missing_but_zero_plan_price_is_detected(self):
        tender = {
            "reference": "REF-3",
            "title": "Travaux de peinture",
            "entity": "Commune de Test",
            "location": "TEST",
            "procedure_type": "AOO",
            "category": "Travaux",
            "deadline": "20/09/2026 09:00",
        }
        details = {
            "estimation": "0,00 MAD",
            "prix_plans": "0,00 MAD",
        }

        result = build_tender_display(tender, details)

        self.assertEqual(result["signals"]["estimation"]["status"], "missing")
        self.assertEqual(result["signals"]["plan_price"]["status"], "detected")
        self.assertEqual(result["signals"]["plan_price"]["value"], "0,00 MAD")

    def test_candidate_count_requires_explicit_competition_label(self):
        tender = {
            "reference": "REF-4",
            "title": "Article 12 - Fourniture de mobilier",
            "entity": "Province de Safi",
            "location": "SAFI",
            "procedure_type": "AOO",
            "category": "Fournitures",
            "deadline": "20/09/2026 09:00",
        }
        result_without_label = build_tender_display(tender, {"contact": "Article 12 du reglement"})
        result_with_label = build_tender_display(tender, {"contact": "Nombre de plis: 7"})

        self.assertEqual(result_without_label["signals"]["applications_count"]["status"], "missing")
        self.assertEqual(result_with_label["signals"]["applications_count"]["value"], 7)
        self.assertEqual(result_with_label["signals"]["applications_count"]["source"], "regex")

    def test_candidate_count_does_not_partially_parse_year_or_four_digit_number(self):
        for value in ("Candidats 2026", "Nombre de plis: 2026"):
            with self.subTest(value=value):
                result = build_tender_display({}, {"contact": value})

                self.assertEqual(result["signals"]["applications_count"]["status"], "missing")

    def test_candidate_count_rejects_slash_separated_date_value(self):
        result = build_tender_display({}, {"contact": "Offres reçues: 09/08/2026"})

        self.assertEqual(result["signals"]["applications_count"]["status"], "missing")

    def test_candidate_count_rejects_dash_separated_date_value(self):
        result = build_tender_display({}, {"contact": "Offres reçues: 09-08-2026"})

        self.assertEqual(result["signals"]["applications_count"]["status"], "missing")


if __name__ == "__main__":
    unittest.main()
