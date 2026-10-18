"""Cooperative pause / resume / cancel + live progress for long-running sweeps.

A single ``PipelineControl`` instance is shared (module-level, like ``scrape_lock``
in ``main`` and ``dce_cache_lock`` in ``dce_cache``) between the background sweep
coroutine and the admin endpoints that steer it. The sweep cooperatively calls
``checkpoint()`` at safe points (between items / sectors); the endpoints just flip
flags. Nothing here force-kills a task — cancellation is cooperative so in-flight
downloads/inserts drain cleanly before the run stops.
"""

import asyncio


class PipelineControl:
    def __init__(self, name: str):
        self.name = name
        self.running = False
        self.cancel_requested = False
        self.progress: dict = {}
        # The event is *set* when the run is NOT paused, so ``wait()`` returns
        # immediately during normal running and blocks only while paused.
        self._resume = asyncio.Event()
        self._resume.set()

    @property
    def paused(self) -> bool:
        return not self._resume.is_set()

    def begin(self, progress: dict | None = None) -> None:
        self.running = True
        self.cancel_requested = False
        self.progress = dict(progress or {})
        self._resume.set()

    def end(self) -> None:
        self.running = False
        self.cancel_requested = False
        self.progress = {}
        self._resume.set()

    def pause(self) -> None:
        self._resume.clear()

    def resume(self) -> None:
        self._resume.set()

    def cancel(self) -> None:
        self.cancel_requested = True
        # Wake a paused sweep so it can observe the cancel and exit its loop.
        self._resume.set()

    async def checkpoint(self) -> bool:
        """Call at a safe point in a loop. Blocks while paused; returns ``False``
        when the run should stop (cancel requested), ``True`` to keep going."""
        await self._resume.wait()
        return not self.cancel_requested

    def update(self, **fields) -> None:
        self.progress.update(fields)

    def snapshot(self) -> dict:
        return {
            "running": self.running,
            "paused": self.paused,
            "cancel_requested": self.cancel_requested,
            "progress": dict(self.progress),
        }


# One shared control per pipeline stage.
SCRAPE = PipelineControl("scrape")
DCE_CACHE = PipelineControl("dce_cache")
DCE_EXTRACTION = PipelineControl("dce_extraction")
