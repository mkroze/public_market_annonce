import io
import tracemalloc
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch

import mem_profile


class ProfilingEnabledTest(unittest.TestCase):
    def test_disabled_by_default(self):
        with patch.dict("os.environ", {}, clear=True):
            self.assertFalse(mem_profile.profiling_enabled())

    def test_truthy_values_enable(self):
        for val in ("1", "true", "TRUE", "yes", "on"):
            with patch.dict("os.environ", {"SCRAPE_MEMORY_PROFILE": val}):
                self.assertTrue(mem_profile.profiling_enabled(), val)

    def test_falsy_values_stay_off(self):
        for val in ("0", "false", "no", "", "off"):
            with patch.dict("os.environ", {"SCRAPE_MEMORY_PROFILE": val}):
                self.assertFalse(mem_profile.profiling_enabled(), val)


class ProfileRunTest(unittest.IsolatedAsyncioTestCase):
    async def test_noop_when_disabled_emits_nothing_and_no_tracing(self):
        buf = io.StringIO()
        with patch.dict("os.environ", {"SCRAPE_MEMORY_PROFILE": "0"}), redirect_stdout(buf):
            async with mem_profile.profile_run("scrape"):
                data = [b"x" * 1024 for _ in range(10)]  # noqa: F841
        self.assertEqual(buf.getvalue(), "")
        self.assertFalse(tracemalloc.is_tracing())

    async def test_enabled_logs_report_and_stops_tracing(self):
        self.assertFalse(tracemalloc.is_tracing())  # precondition
        buf = io.StringIO()
        with patch.dict("os.environ", {"SCRAPE_MEMORY_PROFILE": "1"}), redirect_stdout(buf):
            async with mem_profile.profile_run("scrape"):
                data = [bytes(2048) for _ in range(50)]  # noqa: F841
        out = buf.getvalue()
        self.assertIn("[mem:scrape] start", out)
        self.assertIn("[mem:scrape] done", out)
        self.assertIn("traced_peak", out)
        # We started tracing inside the CM, so it must be stopped again after.
        self.assertFalse(tracemalloc.is_tracing())

    async def test_profiling_error_does_not_propagate(self):
        buf = io.StringIO()
        with patch.dict("os.environ", {"SCRAPE_MEMORY_PROFILE": "1"}), \
             patch.object(mem_profile.tracemalloc, "take_snapshot", side_effect=RuntimeError("boom")), \
             redirect_stdout(buf):
            async with mem_profile.profile_run("scrape"):
                pass
        self.assertIn("profiling error", buf.getvalue())
        self.assertFalse(tracemalloc.is_tracing())


if __name__ == "__main__":
    unittest.main()
