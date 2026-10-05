"""Token-signing secret stability.

Regression guard for the deploy bug where SECRET_KEY was generated per process,
so every restart/redeploy invalidated all tokens and logged everyone out. The
secret must come from the SECRET_KEY env var and stay stable across restarts.

Each test reloads the auth module to re-run its module-level SECRET_KEY line,
then restores the original value so other test modules keep a consistent secret.
"""

import importlib
import os
import unittest

import auth


class SecretKeyStabilityTest(unittest.TestCase):
    def setUp(self):
        self._original_key = auth.SECRET_KEY
        self._had_env = "SECRET_KEY" in os.environ
        self._env_value = os.environ.get("SECRET_KEY")

    def tearDown(self):
        if self._had_env:
            os.environ["SECRET_KEY"] = self._env_value
        else:
            os.environ.pop("SECRET_KEY", None)
        # Restore the exact prior secret for modules that imported auth earlier.
        auth.SECRET_KEY = self._original_key

    def test_secret_key_read_from_env(self):
        os.environ["SECRET_KEY"] = "fixed-secret-for-test"
        importlib.reload(auth)
        self.assertEqual(auth.SECRET_KEY, "fixed-secret-for-test")

    def test_token_survives_simulated_restart(self):
        os.environ["SECRET_KEY"] = "stable-across-restarts"
        importlib.reload(auth)
        token = auth.create_token(1, "a@b.com")
        self.assertIsNotNone(auth.decode_token(token))

        # Simulate a redeploy/restart: same env, fresh module load.
        importlib.reload(auth)
        self.assertIsNotNone(auth.decode_token(token))

    def test_random_fallback_when_env_absent(self):
        os.environ.pop("SECRET_KEY", None)
        importlib.reload(auth)
        first = auth.SECRET_KEY
        importlib.reload(auth)
        # No env secret -> a new random secret each boot (the dev-only fallback).
        self.assertNotEqual(first, auth.SECRET_KEY)


if __name__ == "__main__":
    unittest.main()
