import unittest

from main import normalize_location


class LocationNormalizationTest(unittest.TestCase):
    def test_normalizes_raw_procurement_locations_to_known_regions(self):
        cases = [
            ("CASABLANCA", "Casablanca", "Casablanca-Settat"),
            ("MAROC CASABLANCA", "Casablanca", "Casablanca-Settat"),
            ("CASABLANCA MOHAMMADIA", "Casablanca", "Casablanca-Settat"),
            ("TANGER-ASSILAH MDIQ-FNIDEQ", "Tanger-Assilah", "Tanger-Tetouan-Al Hoceima"),
            ("AL HOCEIMA CHEFCHAOUEN", "Al Hoceima", "Tanger-Tetouan-Al Hoceima"),
            ("Préfecture de Chtouka Ait Baha", "Chtouka-Ait Baha", "Souss-Massa"),
            ("OUJDA-ANGAD NADOR", "Oujda-Angad", "Oriental"),
            ("LAAYOUNE BOUJDOUR", "Laayoune", "Laayoune-Sakia El Hamra"),
            ("MAROC TAROUDANNT", "Taroudannt", "Souss-Massa"),
            ("MOHAMMADIA", "Mohammedia", "Casablanca-Settat"),
            ("Province de Khemissat", "Khemisset", "Rabat-Sale-Kenitra"),
        ]

        for raw, city, region in cases:
            with self.subTest(raw=raw):
                normalized = normalize_location(raw)
                self.assertEqual(normalized["city"], city)
                self.assertEqual(normalized["region"], region)

    def test_unknown_locations_keep_readable_label_and_autre_region(self):
        normalized = normalize_location("Wialaya de Casablanca Anfa")

        self.assertEqual(normalized["city"], "Casablanca")
        self.assertEqual(normalized["region"], "Casablanca-Settat")


if __name__ == "__main__":
    unittest.main()
