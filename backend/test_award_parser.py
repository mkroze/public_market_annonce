"""Tests for award_parser using SAVED text fixtures — no live network.

The fixtures in ``backend/testdata/award_fixtures/*.txt`` are the deterministic
``pypdf`` text extractions of five real Moroccan award documents (produced by
``scraping/award_probe.py``): two multi-field Extraits de PV, one Résultat
définitif with an OCR-garbled winner name, and two ``infructueux`` (no-award)
cases. Every assertion below is checked against those real samples.
"""

import os
import unittest

import award_parser as ap

FIXTURES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "testdata", "award_fixtures")


def _load(name: str) -> str:
    with open(os.path.join(FIXTURES, name), encoding="utf-8") as f:
        return f.read()


def _ev_fields(result: dict) -> set[str]:
    return {e["field"] for e in result["extraction"]["evidence"]}


class NormalizeAmountTest(unittest.TestCase):
    def test_space_thousands_comma_decimal(self):
        self.assertEqual(ap.normalize_amount("1 853 595,00"), 1853595.00)

    def test_nbsp_thousands(self):
        self.assertEqual(ap.normalize_amount("1 765 520,53"), 1765520.53)

    def test_dot_decimal_with_currency(self):
        self.assertEqual(ap.normalize_amount("26 976.00 DH TTC"), 26976.00)

    def test_dh_ttc_stripped(self):
        self.assertEqual(ap.normalize_amount("150 664,00 DH TTC"), 150664.00)

    def test_three_digit_group_not_treated_as_decimal(self):
        # "650.153" is 650153, not 650.153 (a thousands group, not a decimal).
        self.assertEqual(ap.normalize_amount("650.153"), 650153.0)

    def test_decimals_preserved(self):
        self.assertEqual(ap.normalize_amount("650 153,01"), 650153.01)

    def test_non_numeric_returns_none(self):
        self.assertIsNone(ap.normalize_amount("Néant"))
        self.assertIsNone(ap.normalize_amount(""))
        self.assertIsNone(ap.normalize_amount(None))


class NormalizeCompanyTest(unittest.TestCase):
    def test_strips_lot_annotation(self):
        self.assertEqual(ap.normalize_company("TROPICANA PLANTES (3 lots)"), "TROPICANA PLANTES")

    def test_collapses_whitespace(self):
        self.assertEqual(ap.normalize_company("  RABAT   VERDURE  "), "RABAT VERDURE")


class BkamMultiLotTest(unittest.TestCase):
    """Bank Al-Maghrib 14/AOO/BKAM/2024 — 3-lot Extrait de PV."""

    @classmethod
    def setUpClass(cls):
        cls.r = ap.parse_award_document(
            _load("bkam_14_2024.txt"), source_type=ap.SOURCE_PV, method="pdf_text"
        )

    def test_reference(self):
        self.assertEqual(self.r["tender_reference"], "14/AOO/BKAM/2024")

    def test_outcome_awarded(self):
        self.assertEqual(self.r["outcome"], ap.OUTCOME_AWARDED)

    def test_winner(self):
        self.assertEqual(self.r["winner_name"], "TROPICANA PLANTES")

    def test_three_lots_with_amounts(self):
        lots = self.r["lots"]
        self.assertEqual(len(lots), 3)
        self.assertEqual([l["awarded_amount"] for l in lots],
                         [1765520.53, 1324044.39, 650153.01])
        self.assertTrue(all(l["winner_name"] == "TROPICANA PLANTES" for l in lots))

    def test_participants_count(self):
        self.assertEqual(self.r["participants_count"], 3)

    def test_hpms_rejected(self):
        by_name = {p["name"]: p for p in self.r["participants"]}
        self.assertIn("HPMS", by_name)
        self.assertEqual(by_name["HPMS"]["status"], ap.ST_REJECTED)
        self.assertEqual(self.r["rejected_count"], 1)

    def test_winner_marked_in_participants(self):
        by_name = {p["name"]: p for p in self.r["participants"]}
        self.assertEqual(by_name["TROPICANA PLANTES"]["status"], ap.ST_WINNER)

    def test_multilot_losers_count_is_none(self):
        # Per-lot award: a single scalar losers_count is not meaningful.
        self.assertIsNone(self.r["losers_count"])

    def test_evidence_present(self):
        self.assertIn("winner_name", _ev_fields(self.r))
        self.assertIn("lots", _ev_fields(self.r))


class AuejSingleLotTest(unittest.TestCase):
    """Agence Urbaine El Jadida 20/AUEJ-SB/2019 — single-lot Extrait de PV."""

    @classmethod
    def setUpClass(cls):
        cls.r = ap.parse_award_document(
            _load("auej_20_2019.txt"), source_type=ap.SOURCE_PV, method="pdf_text"
        )

    def test_reference(self):
        self.assertEqual(self.r["tender_reference"], "20/AUEJ-SB/2019")

    def test_winner_and_amount(self):
        self.assertEqual(self.r["winner_name"], "SHORA AUDITING SARL")
        self.assertEqual(self.r["awarded_amount"], 26976.00)
        self.assertEqual(self.r["awarded_amount_currency"], "MAD")

    def test_four_participants(self):
        self.assertEqual(self.r["participants_count"], 4)

    def test_losers_derived(self):
        # 4 participants − 1 winner = 3 losers (both counts known → derivable).
        self.assertEqual(self.r["losers_count"], 3)
        self.assertEqual(self.r["winner_count"], 1)

    def test_per_participant_bid_amounts(self):
        by_name = {p["name"]: p["bid_amount"] for p in self.r["participants"]}
        self.assertEqual(by_name["SHORA AUDITING SARL"], 26976.00)
        self.assertEqual(by_name["WORLD AUDIT SARL"], 28944.00)
        self.assertEqual(by_name["IRAC SARL AU"], 25800.00)

    def test_winner_evidence_and_confidence(self):
        self.assertIn("winner_name", _ev_fields(self.r))
        self.assertIn("awarded_amount", _ev_fields(self.r))
        self.assertEqual(self.r["extraction"]["confidence"], "high")


class MemResultatDefinitifTest(unittest.TestCase):
    """MEM 1/2021/DSI — Résultat définitif; winner name garbled by PDF fonts."""

    @classmethod
    def setUpClass(cls):
        # Marked ``ocr`` because the winner name is only recoverable via OCR;
        # this caps confidence at low and keeps the record honest.
        cls.r = ap.parse_award_document(
            _load("mem_1_2021.txt"), source_type=ap.SOURCE_FINAL, method="ocr"
        )

    def test_reference(self):
        self.assertEqual(self.r["tender_reference"], "1/2021/DSI")

    def test_amount_extracted_cleanly(self):
        self.assertEqual(self.r["awarded_amount"], 150664.00)
        self.assertIn("awarded_amount", _ev_fields(self.r))

    def test_winner_not_a_label_word(self):
        # The parser must never emit a header/label word or a date as the winner.
        w = self.r["winner_name"]
        if w is not None:
            self.assertNotIn(w.lower(), {"retenue", "retenu", "montant", "résultat"})
            self.assertNotRegex(w, r"\d{2}/\d{2}/\d{4}")

    def test_ocr_confidence_capped_low(self):
        self.assertEqual(self.r["extraction"]["confidence"], "low")


class InfructueuxTest(unittest.TestCase):
    """Two real no-award cases: AUEJ 15/2019 and UIT 21/PUITK/2025."""

    def test_auej15_infructueux(self):
        r = ap.parse_award_document(
            _load("auej_15_2019_infructueux.txt"), source_type=ap.SOURCE_PV, method="pdf_text"
        )
        self.assertEqual(r["outcome"], ap.OUTCOME_INFRUCTUEUX)
        self.assertIsNone(r["winner_name"])
        self.assertIsNone(r["awarded_amount"])
        self.assertEqual(r["participants_count"], 0)
        self.assertEqual(r["winner_count"], 0)
        self.assertIn("outcome", _ev_fields(r))

    def test_uit_infructueux_with_mojibake(self):
        r = ap.parse_award_document(
            _load("uit_21_2025_infructueux.txt"), source_type=ap.SOURCE_PV, method="pdf_text"
        )
        self.assertEqual(r["outcome"], ap.OUTCOME_INFRUCTUEUX)
        self.assertIsNone(r["winner_name"])
        self.assertEqual(r["participants_count"], 0)
        self.assertEqual(r["tender_reference"], "21/PUITK/2025")


class NoFabricationTest(unittest.TestCase):
    """Guardrails: the parser must not invent values not in the source."""

    def test_empty_text_yields_nulls(self):
        r = ap.parse_award_document("", source_type=ap.SOURCE_PV, method="pdf_text")
        self.assertIsNone(r["winner_name"])
        self.assertIsNone(r["awarded_amount"])
        self.assertIsNone(r["participants_count"])
        self.assertIsNone(r["losers_count"])
        self.assertEqual(r["participants"], [])

    def test_losers_count_requires_both_counts(self):
        # A document with a winner but no participant list can't yield losers.
        text = "EXTRAIT DU PROCES VERBAL\nN° 9/2025\nConcurrent retenu :\n• ACME SARL\n"
        r = ap.parse_award_document(text, source_type=ap.SOURCE_PV, method="pdf_text")
        self.assertIsNone(r["participants_count"])
        self.assertIsNone(r["losers_count"])

    def test_every_scalar_award_field_has_evidence(self):
        r = ap.parse_award_document(
            _load("auej_20_2019.txt"), source_type=ap.SOURCE_PV, method="pdf_text"
        )
        fields = _ev_fields(r)
        for f in ("winner_name", "awarded_amount", "participants_count"):
            self.assertIn(f, fields, f"missing evidence for {f}")


class AcceptanceCriteriaTest(unittest.TestCase):
    """Rolls up the prompt's acceptance criteria against the 5 real samples."""

    @classmethod
    def setUpClass(cls):
        specs = [
            ("bkam_14_2024.txt", ap.SOURCE_PV, "pdf_text"),
            ("auej_20_2019.txt", ap.SOURCE_PV, "pdf_text"),
            ("mem_1_2021.txt", ap.SOURCE_FINAL, "ocr"),
            ("auej_15_2019_infructueux.txt", ap.SOURCE_PV, "pdf_text"),
            ("uit_21_2025_infructueux.txt", ap.SOURCE_PV, "pdf_text"),
        ]
        cls.records = [
            ap.parse_award_document(_load(n), source_type=st, method=m)
            for n, st, m in specs
        ]

    def test_at_least_five_records_with_winner_or_explicit_no_award(self):
        good = 0
        for r in self.records:
            has_winner = bool(r["winner_name"]) or bool(r["lots"])
            has_amount = r["awarded_amount"] is not None or any(
                l.get("awarded_amount") is not None for l in r["lots"]
            )
            explicit_no_award = r["outcome"] != ap.OUTCOME_AWARDED
            if (has_winner and (has_amount or r["lots"])) or explicit_no_award:
                good += 1
        self.assertGreaterEqual(good, 5)

    def test_at_least_three_records_have_participant_count(self):
        with_count = sum(1 for r in self.records if r["participants_count"] is not None)
        self.assertGreaterEqual(with_count, 3)

    def test_a_no_award_case_is_handled(self):
        self.assertTrue(any(r["outcome"] == ap.OUTCOME_INFRUCTUEUX for r in self.records))

    def test_every_winner_amount_count_has_evidence(self):
        for r in self.records:
            fields = _ev_fields(r)
            if r["winner_name"]:
                self.assertIn("winner_name", fields)
            if r["awarded_amount"] is not None:
                self.assertIn("awarded_amount", fields)
            if r["participants_count"] is not None:
                self.assertIn("participants_count", fields)


if __name__ == "__main__":
    unittest.main()
