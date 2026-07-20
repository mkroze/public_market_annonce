import os
import unittest
from unittest.mock import patch

from emailer import build_message, email_enabled


class EmailerTest(unittest.TestCase):
    def test_email_disabled_when_smtp_host_unset(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertFalse(email_enabled())

    def test_email_enabled_when_smtp_host_set(self):
        with patch.dict(os.environ, {"SMTP_HOST": "smtp.gmail.com"}):
            self.assertTrue(email_enabled())

    def test_build_message_is_multipart_alternative(self):
        with patch.dict(os.environ, {"SMTP_USER": "bot@example.com"}, clear=True):
            msg = build_message("user@example.com", "Sujet", "<p>Salut</p>", "Salut")
        self.assertEqual(msg.get_content_type(), "multipart/alternative")
        parts = msg.get_payload()
        self.assertEqual(len(parts), 2)
        self.assertEqual(parts[0].get_content_type(), "text/plain")
        self.assertEqual(parts[1].get_content_type(), "text/html")
        self.assertEqual(msg["To"], "user@example.com")
        self.assertEqual(msg["From"], "bot@example.com")
        self.assertEqual(msg["Subject"], "Sujet")

    def test_from_prefers_smtp_from_over_user(self):
        env = {"SMTP_USER": "bot@example.com", "SMTP_FROM": "alerts@example.com"}
        with patch.dict(os.environ, env, clear=True):
            msg = build_message("user@example.com", "S", "<p>x</p>", "x")
        self.assertEqual(msg["From"], "alerts@example.com")


if __name__ == "__main__":
    unittest.main()
