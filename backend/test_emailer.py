import unittest

from emailer import build_message, email_is_configured, send_email


class EmailConfiguredTest(unittest.TestCase):
    def test_not_configured_without_host(self):
        self.assertFalse(email_is_configured({}))
        self.assertFalse(email_is_configured({"smtp_host": "   "}))

    def test_configured_with_host(self):
        self.assertTrue(email_is_configured({"smtp_host": "smtp.example.com"}))


class BuildMessageTest(unittest.TestCase):
    def test_multipart_alternative_and_headers(self):
        config = {"smtp_user": "bot@example.com"}
        msg = build_message(config, "user@example.com", "Sujet", "<p>Salut</p>", "Salut")
        self.assertEqual(msg.get_content_type(), "multipart/alternative")
        parts = msg.get_payload()
        self.assertEqual(len(parts), 2)
        self.assertEqual(parts[0].get_content_type(), "text/plain")
        self.assertEqual(parts[1].get_content_type(), "text/html")
        self.assertEqual(msg["To"], "user@example.com")
        self.assertEqual(msg["From"], "bot@example.com")
        self.assertEqual(msg["Subject"], "Sujet")

    def test_from_prefers_smtp_from_over_user(self):
        config = {"smtp_user": "bot@example.com", "smtp_from": "alerts@example.com"}
        msg = build_message(config, "u@example.com", "S", "<p>x</p>", "x")
        self.assertEqual(msg["From"], "alerts@example.com")

    def test_from_includes_display_name(self):
        config = {"smtp_from": "alerts@example.com", "smtp_from_name": "Marches Publics"}
        msg = build_message(config, "u@example.com", "S", "<p>x</p>", "x")
        self.assertEqual(msg["From"], "Marches Publics <alerts@example.com>")


class SendEmailGuardTest(unittest.TestCase):
    def test_raises_without_host(self):
        # No host → fail fast before any socket work.
        with self.assertRaises(RuntimeError):
            send_email({}, "u@example.com", "S", "<p>x</p>", "x")


if __name__ == "__main__":
    unittest.main()
