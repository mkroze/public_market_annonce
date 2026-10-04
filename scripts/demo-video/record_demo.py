"""Record the landing-page product demo from the real, running application.

    python scripts/demo-video/record_demo.py            # desktop + mobile + stills
    python scripts/demo-video/record_demo.py desktop    # one variant only

Requirements: the app running locally (frontend :5173, backend :8000), Python
Playwright with its Chromium, and ffmpeg on PATH.

Nothing here fakes the product: it drives the real pages with real catalog data
through a fictional local demo account, captures the browser's own frames (CDP
screencast, so no cursor and no OS chrome), and encodes them with ffmpeg. The
only editing is cutting out page-load waits between two screens.

Outputs (frontend/src/assets/demo/): hero-<variant>.mp4, hero-<variant>.jpg
(poster = first frame), story-*.jpg (stills for the scroll story) and demo.json
(caption cues, in seconds, per variant).
"""

import asyncio
import base64
import json
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from playwright.async_api import Page, async_playwright

from demo_account import ensure_demo_account

APP = "http://localhost:5173"
OUT = Path(__file__).resolve().parents[2] / "frontend" / "src" / "assets" / "demo"

# The consultation the scenario opens. Chosen because its detail and DCE are
# already cached locally, so the page loads without calling the public portal.
TENDER_TITLE = re.compile("Entretien courant des voies", re.I)
CITY = "FES"

VARIANTS = {
    "desktop": {"viewport": {"width": 1440, "height": 900}, "scale": 1, "encode": "1440:900", "crf": 27},
    "mobile": {"viewport": {"width": 430, "height": 760}, "scale": 2, "encode": "720:1272", "crf": 28},
}

CAPTIONS = {
    "find": "Trouvez les consultations qui vous concernent.",
    "filter": "Filtrez selon votre activité.",
    "analyse": "Analysez l'opportunité.",
    "follow": "Suivez-la en un clic.",
    "prepare": "Préparez votre réponse.",
    "end": "MP Maroc — de la veille à la préparation.",
}


class Recorder:
    """Collects browser frames on a virtual timeline that skips paused spans."""

    def __init__(self, page: Page):
        self.page = page
        self.frames: list[tuple[float, bytes]] = []
        self.marks: list[tuple[str, float]] = []
        self.capturing = False
        self._skipped = 0.0
        self._paused_at = 0.0
        self._t0 = 0.0
        self._cdp = None

    def now(self) -> float:
        return time.monotonic() - self._t0 - self._skipped

    async def _snapshot(self) -> None:
        shot = await self._cdp.send("Page.captureScreenshot", {"format": "jpeg", "quality": 93})
        self.frames.append((self.now(), base64.b64decode(shot["data"])))

    async def start(self) -> None:
        self._cdp = await self.page.context.new_cdp_session(self.page)

        async def on_frame(event):
            if self.capturing:
                self.frames.append((self.now(), base64.b64decode(event["data"])))
            try:
                await self._cdp.send("Page.screencastFrameAck", {"sessionId": event["sessionId"]})
            except Exception:  # noqa: BLE001 - a late frame after the page closed
                pass

        self._cdp.on("Page.screencastFrame", lambda event: asyncio.ensure_future(on_frame(event)))
        self._t0 = time.monotonic()
        self.capturing = True
        await self._snapshot()
        await self._cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 93, "everyNthFrame": 1})

    def mark(self, key: str) -> None:
        self.marks.append((key, self.now()))

    async def hold(self, ms: int) -> None:
        await self.page.wait_for_timeout(ms)

    async def cut(self, action, ready) -> None:
        """Run a navigation with capture paused, so the film cuts straight from
        the click to the loaded screen (no spinner, no blank frame)."""
        self.capturing = False
        self._paused_at = time.monotonic()
        await action()
        await ready()
        await self.page.wait_for_load_state("networkidle")
        await self.page.wait_for_timeout(700)  # let the entry animation settle
        self._skipped += time.monotonic() - self._paused_at - 0.05
        self.capturing = True
        await self._snapshot()

    async def stop(self) -> None:
        await self._snapshot()
        self.capturing = False
        await self._cdp.send("Page.stopScreencast")


async def glide(page: Page, top: float, ms: int = 900) -> None:
    """Eased scroll, so movement reads as deliberate rather than a jump."""
    await page.evaluate(
        """([top, ms]) => new Promise((done) => {
            const from = window.scrollY, start = performance.now();
            const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
            const step = (now) => {
                const t = Math.min(1, (now - start) / ms);
                window.scrollTo(0, from + (top - from) * ease(t));
                t < 1 ? requestAnimationFrame(step) : done();
            };
            requestAnimationFrame(step);
        })""",
        [top, ms],
    )


async def glide_to(page: Page, locator, offset: int, ms: int = 900) -> None:
    box = await locator.bounding_box()
    scroll_y = await page.evaluate("window.scrollY")
    await glide(page, max(0, scroll_y + box["y"] - offset), ms)


async def open_page(browser, variant: str, session: dict) -> Page:
    spec = VARIANTS[variant]
    context = await browser.new_context(
        viewport=spec["viewport"], device_scale_factor=spec["scale"], locale="fr-FR", color_scheme="light",
    )
    await context.add_init_script(
        f"localStorage.setItem('token', {json.dumps(session['token'])});"
        "localStorage.setItem('mp-theme', 'light');"
    )
    return await context.new_page()


async def settle(page: Page) -> None:
    await page.wait_for_load_state("networkidle")
    await page.wait_for_timeout(900)


async def scenario(page: Page, variant: str) -> Recorder:
    rec = Recorder(page)
    mobile = variant == "mobile"
    results = page.get_by_role("region", name="Consultations")
    card = page.get_by_role("link", name=TENDER_TITLE).first

    if mobile:
        # On a phone the filter panel fills the first screens: the film starts
        # on the already-filtered results, exactly as the app shows them.
        await page.goto(f"{APP}/tenders?category=Travaux&location={CITY}&status=en_cours")
        await settle(page)
        await page.evaluate("el => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 40)",
                            await results.element_handle())
        await page.wait_for_timeout(500)
        await rec.start()
        rec.mark("find")
        await rec.hold(1800)
        rec.mark("filter")
        await glide_to(page, card, 250, 1100)
        await rec.hold(1600)
    else:
        await page.goto(f"{APP}/tenders")
        await settle(page)
        await rec.start()
        rec.mark("find")
        await rec.hold(1700)
        await page.get_by_role("button", name="Filtrer par Travaux").click()
        await rec.hold(500)
        rec.mark("filter")
        await rec.hold(1300)
        await page.get_by_label("Localisation").select_option(label=CITY)
        await rec.hold(800)
        await page.get_by_role("button", name="Appliquer").click()
        await rec.hold(2300)

    # Identify: open the real consultation page.
    await rec.cut(card.click, lambda: page.get_by_role("heading", level=1).wait_for())
    rec.mark("analyse")
    await rec.hold(2100)
    decision = page.get_by_role("heading", name=re.compile("Dois-je poursuivre"))
    await glide_to(page, decision, 96 if mobile else 130, 1000)
    await rec.hold(2000)

    # Follow: the real favourite action.
    follow = page.get_by_role("button", name="Suivre cette consultation").first
    await glide_to(page, follow, 420 if mobile else 560, 900)
    await rec.hold(500)
    rec.mark("follow")
    await follow.click()
    await rec.hold(1700)

    # Prepare: the real candidacy workshop for that consultation.
    prepare = page.get_by_role("link", name="Préparer ma candidature").first
    await rec.cut(prepare.click, lambda: page.get_by_role("heading", name="Préparer ma candidature").wait_for())
    rec.mark("prepare")
    await rec.hold(1900)
    checklist = page.get_by_role("heading", name=re.compile("Pièces exigées"))
    await glide_to(page, checklist, 110 if mobile else 150, 1100)
    await rec.hold(900)
    for label in ("Pouvoirs du signataire", "Déclaration sur l'honneur (art. 29)", "CPS paraphé et signé"):
        await page.get_by_role("button", name=label, exact=True).click()
        await rec.hold(550)
    rec.mark("end")
    await rec.hold(2300)
    await rec.stop()
    return rec


def encode(rec: Recorder, variant: str) -> list[dict]:
    spec = VARIANTS[variant]
    OUT.mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp(prefix="mp-demo-"))
    try:
        frames = sorted(rec.frames, key=lambda f: f[0])
        end = frames[-1][0]
        lines = []
        for index, (ts, data) in enumerate(frames):
            name = f"f{index:05d}.jpg"
            (work / name).write_bytes(data)
            following = frames[index + 1][0] if index + 1 < len(frames) else ts + 0.04
            lines += [f"file '{name}'", f"duration {max(0.001, following - ts):.4f}"]
        lines.append(f"file 'f{len(frames) - 1:05d}.jpg'")  # concat needs the last file twice
        (work / "frames.txt").write_text("\n".join(lines), encoding="utf-8")

        video = OUT / f"hero-{variant}.mp4"
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", "frames.txt",
             "-vf", f"fps=30,scale={spec['encode']}:flags=lanczos,format=yuv420p",
             "-c:v", "libx264", "-preset", "slow", "-crf", str(spec["crf"]), "-movflags", "+faststart", "-an",
             str(video)],
            cwd=work, check=True,
        )
        # Poster = the film's first frame, so play starts without a visual jump.
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", "f00000.jpg",
             "-vf", f"scale={spec['encode']}:flags=lanczos", "-q:v", "4", str(OUT / f"hero-{variant}.jpg")],
            cwd=work, check=True,
        )
    finally:
        shutil.rmtree(work, ignore_errors=True)

    cues = []
    for index, (key, start) in enumerate(rec.marks):
        stop = rec.marks[index + 1][1] if index + 1 < len(rec.marks) else end
        cues.append({"start": round(start, 2), "end": round(stop, 2), "text": CAPTIONS[key]})
    print(f"{variant}: {len(frames)} frames, {end:.1f}s, {video.stat().st_size / 1024:.0f} kB")
    return cues


async def stills(browser, session: dict) -> None:
    """Real screens for the scroll story, one per step."""
    page = await open_page(browser, "desktop", session)

    async def shoot(name: str) -> None:
        await page.wait_for_timeout(500)
        raw = OUT / f"_{name}.png"
        await page.screenshot(path=str(raw))
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-vf", "scale=1200:750:flags=lanczos",
             "-q:v", "4", str(OUT / f"story-{name}.jpg")],
            check=True,
        )
        raw.unlink()

    await page.goto(f"{APP}/tenders?category=Travaux&location={CITY}&status=en_cours")
    await settle(page)
    await shoot("criteria")

    await page.goto(f"{APP}/member/alerts")
    await settle(page)
    await page.get_by_role("button", name=re.compile("Nouvelle alerte")).click()
    await page.wait_for_timeout(700)
    await shoot("watch")

    await page.goto(f"{APP}/tenders?category=Travaux&location={CITY}&status=en_cours")
    await settle(page)
    await page.get_by_role("link", name=TENDER_TITLE).first.click()
    await page.get_by_role("heading", level=1).wait_for()
    await settle(page)
    await shoot("opportunity")

    await page.goto(f"{APP}/eligibility")
    await settle(page)
    for index in range(3):
        await page.get_by_role("button", name="Oui", exact=True).nth(index).click()
    await shoot("eligibility")

    await page.goto(f"{APP}/tenders?category=Travaux&location={CITY}&status=en_cours")
    await settle(page)
    await page.get_by_role("link", name=TENDER_TITLE).first.click()
    await page.get_by_role("link", name="Préparer ma candidature").first.click()
    await page.get_by_role("heading", name="Préparer ma candidature").wait_for()
    await settle(page)
    for label in ("Pouvoirs du signataire", "Déclaration sur l'honneur (art. 29)"):
        await page.get_by_role("button", name=label, exact=True).click()
    await page.evaluate("window.scrollTo(0, 0)")
    await shoot("prepare")
    await page.context.close()


async def main(targets: list[str]) -> None:
    cues_file = OUT / "demo.json"
    cues = json.loads(cues_file.read_text(encoding="utf-8")) if cues_file.exists() else {}
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch()
        for variant in [t for t in targets if t in VARIANTS]:
            session = ensure_demo_account()  # also resets the demo favourites
            page = await open_page(browser, variant, session)
            rec = await scenario(page, variant)
            await page.context.close()
            cues[variant] = encode(rec, variant)
        if "stills" in targets:
            await stills(browser, ensure_demo_account())
        await browser.close()
    OUT.mkdir(parents=True, exist_ok=True)
    cues_file.write_text(json.dumps(cues, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:] or ["desktop", "mobile", "stills"]))
