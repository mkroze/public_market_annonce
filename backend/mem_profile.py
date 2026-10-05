"""Opt-in memory profiling for long-running sweeps (scrape / DCE cache).

Why this exists
---------------
Scrape and DCE-cache runs execute *in-process* inside the single uvicorn web
worker (`asyncio.create_task` in `admin.py`). A run that balloons resident
memory can push the container past Render's memory limit, which OOM-kills and
restarts the service (and fires the startup/health email). Before we could fix
that we needed *evidence* of where the memory goes.

`profile_run(label)` is an async context manager that, when
``SCRAPE_MEMORY_PROFILE`` is truthy, snapshots ``tracemalloc`` around a run and
logs the peak traced memory, peak RSS, and the top allocation sites to stdout
(the scrape/pipeline log). It is a **no-op** when the flag is off, so it is safe
and free in production and only turned on to diagnose.

Usage::

    async with profile_run("scrape_all_sectors"):
        ... expensive sweep ...

Env flags (all optional, default off / conservative):
- ``SCRAPE_MEMORY_PROFILE``    "1"/"true"/"yes" to enable (default off).
- ``SCRAPE_MEMORY_TOP_N``      how many top allocation lines to log (default 10).
"""

import os
import sys
import tracemalloc
from contextlib import asynccontextmanager


def profiling_enabled() -> bool:
    return os.getenv("SCRAPE_MEMORY_PROFILE", "").strip().lower() in ("1", "true", "yes", "on")


def _top_n() -> int:
    try:
        return max(1, int(os.getenv("SCRAPE_MEMORY_TOP_N", "10")))
    except ValueError:
        return 10


def _rss_bytes() -> int | None:
    """Best-effort resident set size in bytes, or None if unavailable.

    Reads ``/proc/self/statm`` on Linux (Render runs Linux) and falls back to
    ``resource.getrusage`` elsewhere. Never raises — profiling must not break a
    run.
    """
    try:
        with open("/proc/self/statm", "r") as f:
            rss_pages = int(f.read().split()[1])
        return rss_pages * os.sysconf("SC_PAGE_SIZE")
    except (OSError, ValueError, IndexError):
        pass
    try:
        import resource

        maxrss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        # ru_maxrss is KiB on Linux, bytes on macOS/BSD.
        return maxrss if sys.platform == "darwin" else maxrss * 1024
    except Exception:  # noqa: BLE001
        return None


def _mb(n: int | None) -> str:
    if n is None:
        return "n/a"
    return f"{n / (1024 * 1024):.1f} MB"


@asynccontextmanager
async def profile_run(label: str):
    """Snapshot tracemalloc + RSS around a run; log a report on exit.

    No-op (yields immediately) unless ``SCRAPE_MEMORY_PROFILE`` is enabled, so
    there is zero overhead in production.
    """
    if not profiling_enabled():
        yield
        return

    started_here = not tracemalloc.is_tracing()
    if started_here:
        tracemalloc.start()
    tracemalloc.clear_traces()
    rss_start = _rss_bytes()
    print(f"[mem:{label}] start rss={_mb(rss_start)}", flush=True)
    try:
        yield
    finally:
        try:
            current, peak = tracemalloc.get_traced_memory()
            snapshot = tracemalloc.take_snapshot()
            stats = snapshot.statistics("lineno")
            rss_end = _rss_bytes()
            print(
                f"[mem:{label}] done "
                f"traced_current={_mb(current)} traced_peak={_mb(peak)} "
                f"rss_start={_mb(rss_start)} rss_end={_mb(rss_end)}",
                flush=True,
            )
            for stat in stats[: _top_n()]:
                frame = stat.traceback[0]
                print(
                    f"[mem:{label}]   {_mb(stat.size)} in {stat.count} blocks "
                    f"@ {frame.filename}:{frame.lineno}",
                    flush=True,
                )
        except Exception as e:  # noqa: BLE001 - never let profiling break a run
            print(f"[mem:{label}] profiling error: {e}", flush=True)
        finally:
            if started_here:
                tracemalloc.stop()
