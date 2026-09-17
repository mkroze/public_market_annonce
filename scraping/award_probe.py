#!/usr/bin/env python3
"""Probe + sample builder for Moroccan public-procurement AWARD data (PMMP).

What this does
--------------
1. **Maps** the two PMMP award surfaces (``Tous les extraits de PV`` and
   ``Tous les résultats définitifs``): confirms the URLs resolve, drives the
   PRADO advanced-search postback, reads the announce-type counts, and lists the
   consultation refs behind each award announcement. See
   ``docs/award-data-extraction-map.md`` for the mapping this validated.
2. **Pulls a verification sample** of real award documents (Extrait de PV /
   Résultat définitif PDFs published by Moroccan buyers), extracts their text
   deterministically with ``pypdf`` (OCR is only a documented fallback), runs
   ``backend/award_parser.parse_award_document`` on each, and writes the
   normalized objects to ``scraping/award_samples.jsonl``.

Design / compliance
-------------------
* Reuses ``backend/config`` HEADERS (browser-like UA) and httpx + BeautifulSoup,
  matching ``backend/scraper.py``.
* LOW request rate (a fixed inter-request delay), follows redirects, detects
  WAF/interstitial/CAPTCHA pages and bails gracefully. Does NOT touch
  authenticated agent/enterprise spaces, and does NOT bypass any protection.
* Never fabricates award values — extraction is delegated to the parser, which
  attaches source evidence to every field.

Usage
-----
    python scraping/award_probe.py map          # map the portal surfaces only
    python scraping/award_probe.py samples       # (re)build award_samples.jsonl
    python scraping/award_probe.py all           # both (default)

The portal-mapping step needs network. The sample step will fetch the sample
PDFs if they're not already cached in ``scraping/award_pdf_cache/``; the parser
tests (``backend/test_award_parser.py``) run offline on saved fixtures and do
not need this script.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
from datetime import datetime, timezone

# Make backend importable whether run from repo root or elsewhere.
_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(_HERE)
sys.path.insert(0, os.path.join(_ROOT, "backend"))

import httpx  # noqa: E402
from bs4 import BeautifulSoup  # noqa: E402

from config import HEADERS, BASE_URL  # noqa: E402
import award_parser as ap  # noqa: E402

# ── Config ────────────────────────────────────────────────────────────────────
REQUEST_DELAY_SECONDS = 6.0          # keep the portal happy (compliance: ≥5 s)
CACHE_DIR = os.path.join(_HERE, "award_pdf_cache")
SAMPLES_PATH = os.path.join(_HERE, "award_samples.jsonl")

# The advanced-search "annonceType" select values (verified live 2026-09-15).
ANNONCE_TYPE = {"final_result": "4", "pv_extract": "5"}
SEARCH_LANDING = {
    "final_result": f"{BASE_URL}/index.php?page=entreprise.EntrepriseAdvancedSearch&AvisAttribution",
    "pv_extract": f"{BASE_URL}/index.php?page=entreprise.EntrepriseAdvancedSearch&AvisExtraitPV",
}
_ADV = "ctl0$CONTENU_PAGE$AdvancedSearch$"

_WAF_MARKERS = (
    "captcha", "recaptcha", "access denied", "request rejected",
    "trop de requêtes", "trop de requetes",
)

# Verified real award documents used for the extraction sample. Each is a public
# PV/résultat published by a Moroccan buyer (portal-published or buyer-mirrored).
# ``method`` records how the winner/amount are reliably obtainable: ``pdf_text``
# for clean text, ``ocr`` when the PDF's fonts garble the winner name so only OCR
# would recover it (that entry is intentionally low-confidence).
SAMPLE_DOCS = [
    {
        "key": "bkam_14_2024",
        "source_type": ap.SOURCE_PV,
        "document_url": "https://www.bkam.ma/content/download/818082/8960351/Extrait%20de%20PV.pdf",
        "source_url": "https://www.marchespublics.gov.ma/index.php?page=entreprise.EntrepriseAdvancedSearch&AvisExtraitPV",
        "buyer": "BANK AL-MAGHRIB",
        "method": "pdf_text",
        "note": "Multi-lot (3 lots) Extrait de PV; 3 participants, 1 évincé, 1 attributaire.",
    },
    {
        "key": "auej_20_2019",
        "source_type": ap.SOURCE_PV,
        "document_url": "https://www.auejsb.ma/sites/default/files/2020-04/AO%2020%20Extrait%20PV%20S%C3%A9ance%203.pdf",
        "source_url": "https://www.marchespublics.gov.ma/index.php?page=entreprise.EntrepriseAdvancedSearch&AvisExtraitPV",
        "buyer": "Agence Urbaine d'El Jadida-Sidi Bennour",
        "method": "pdf_text",
        "note": "Single-lot Extrait de PV; 4 participants with per-bidder amounts, 1 retenu.",
    },
    {
        "key": "mem_1_2021",
        "source_type": ap.SOURCE_FINAL,
        "document_url": "https://www.mem.gov.ma/Lists/Lst_Appel_Doffres-RH/Attachments/32/Extrait%20de%20pv%20r%C3%A9sultat%20AO%201-2021-DSI.pdf",
        "source_url": "https://www.marchespublics.gov.ma/index.php?page=entreprise.EntrepriseAdvancedSearch&AvisAttribution",
        "buyer": "Ministère de l'Energie, des Mines et de l'Environnement",
        "method": "ocr",  # winner name garbled by PDF fonts → only OCR recovers it
        "note": "Résultat définitif + PV; clean montant retenu, winner name garbled (OCR case).",
    },
    {
        "key": "auej_15_2019_infructueux",
        "source_type": ap.SOURCE_PV,
        "document_url": "https://www.auejsb.ma/sites/default/files/2020-04/AO%2015%20extrait%20PV%20S%C3%A9ance%201.pdf",
        "source_url": "https://www.marchespublics.gov.ma/index.php?page=entreprise.EntrepriseAdvancedSearch&AvisExtraitPV",
        "buyer": "Agence Urbaine d'El Jadida-Sidi Bennour",
        "method": "pdf_text",
        "note": "INFRUCTUEUX: 'Néant' participants, commission declares the AO unsuccessful.",
    },
    {
        "key": "uit_21_2025_infructueux",
        "source_type": ap.SOURCE_PV,
        "document_url": "https://www.uit.ac.ma/wp-content/uploads/2025/11/extrait-PV-21.PUITK_.2025.pdf",
        "source_url": "https://www.uit.ac.ma/extrait-pv-21-puitk-2025/",
        "buyer": "Université Ibn Tofail de Kénitra",
        "method": "pdf_text",
        "note": "INFRUCTUEUX under art. 45-a; encoding artefacts (Ø/Ł) exercise mojibake fixes.",
    },
]


# ── HTTP helpers ──────────────────────────────────────────────────────────────
def _looks_blocked(text: str) -> bool:
    low = text[:4000].lower()
    return any(m in low for m in _WAF_MARKERS)


def _collect_form(soup: BeautifulSoup) -> tuple[dict, str | None]:
    """Replay every named form control with its current value — PRADO rejects a
    partial postback, so the whole form (incl. the long PRADO_PAGESTATE) must be
    round-tripped."""
    form = soup.find("form")
    if not form:
        return {}, None
    data: dict[str, str] = {}
    for inp in form.find_all("input"):
        name = inp.get("name")
        if not name:
            continue
        t = (inp.get("type") or "text").lower()
        if t in ("submit", "button", "image", "reset"):
            continue
        if t in ("checkbox", "radio"):
            if inp.has_attr("checked"):
                data[name] = inp.get("value", "on")
            continue
        data[name] = inp.get("value", "")
    for sel in form.find_all("select"):
        name = sel.get("name")
        if not name:
            continue
        opt = sel.find("option", selected=True) or sel.find("option")
        data[name] = opt.get("value", "") if opt else ""
    # NB: intentionally NOT replaying <textarea> fields. The advanced form has
    # two hidden-ish textareas (qualification / domaineActivite id lists); posting
    # them back makes the search return "Aucun résultat". Omitting them is what
    # makes the announce-type filter actually apply.
    action = form.get("action")
    return data, action


def _result_count(soup: BeautifulSoup) -> int | None:
    txt = soup.get_text(" ", strip=True)
    m = re.search(r"Nombre de r.sultats\s*:?\s*(\d[\d\s]*)", txt)
    if m:
        return int(m.group(1).replace(" ", "").replace("\xa0", ""))
    return None


def _rows_refs(soup: BeautifulSoup) -> list[tuple[str, str]]:
    tbl = soup.find("table", class_="table-results")
    if not tbl:
        return []
    out = []
    for row in tbl.find_all("tr"):
        rc = row.find("input", id=re.compile(r"refCons$"))
        oc = row.find("input", id=re.compile(r"orgCons$"))
        if rc and oc:
            out.append((rc.get("value", ""), oc.get("value", "")))
    return out


# ── Phase 1: map the portal surfaces ─────────────────────────────────────────
def map_surfaces(date_start: str = "01/01/2024", date_end: str | None = None) -> dict:
    """Confirm both award surfaces resolve and enumerate a page of refs each.

    Returns a small report dict. Prints a human summary. Network required.
    """
    if date_end is None:
        date_end = datetime.now().strftime("%d/%m/%Y")
    report: dict = {"checked_at": datetime.now(timezone.utc).isoformat(), "surfaces": {}}
    # A FRESH client per surface: the PMMP PRADO state is per-session, and
    # reusing one session across the two advanced searches corrupts it (the
    # second search silently returns 0 rows). One client per surface is the
    # reliable pattern discovered while mapping.
    for kind, landing in SEARCH_LANDING.items():
        entry = {"landing_url": landing}
        with httpx.Client(headers=HEADERS, follow_redirects=True, timeout=60) as client:
            try:
                r = client.get(landing)
                entry["landing_status"] = r.status_code
                if _looks_blocked(r.text):
                    entry["error"] = "blocked/interstitial on landing"
                    report["surfaces"][kind] = entry
                    continue
                soup = BeautifulSoup(r.text, "lxml")
                data, action = _collect_form(soup)
                if not data or not action:
                    entry["error"] = "advanced-search form not found"
                    report["surfaces"][kind] = entry
                    continue
                data[f"{_ADV}annonceType"] = ANNONCE_TYPE[kind]
                data[f"{_ADV}dateMiseEnLigneCalculeStart"] = date_start
                data[f"{_ADV}dateMiseEnLigneCalculeEnd"] = date_end
                data[f"{_ADV}lancerRecherche"] = "Lancer la recherche"
                time.sleep(REQUEST_DELAY_SECONDS)
                action_url = BASE_URL + action if action.startswith("/") else action
                r2 = client.post(action_url, data=data)
                if _looks_blocked(r2.text):
                    entry["error"] = "blocked/interstitial on search POST"
                    report["surfaces"][kind] = entry
                    continue
                soup2 = BeautifulSoup(r2.text, "lxml")
                entry["search_status"] = r2.status_code
                entry["result_count"] = _result_count(soup2)
                refs = _rows_refs(soup2)
                entry["sample_refs"] = [
                    f"{BASE_URL}/index.php?page=entreprise.EntrepriseDetailConsultation"
                    f"&refConsultation={ref}&orgAcronyme={org}"
                    for ref, org in refs[:5]
                ]
                entry["rows_on_page"] = len(refs)
            except httpx.HTTPError as e:
                entry["error"] = f"{type(e).__name__}: {e}"
            report["surfaces"][kind] = entry
            time.sleep(REQUEST_DELAY_SECONDS)

    # Human summary.
    print("=== PMMP award-surface map ===")
    for kind, e in report["surfaces"].items():
        print(f"\n[{kind}]  {e.get('landing_url')}")
        if e.get("error"):
            print(f"  ERROR: {e['error']}")
            continue
        print(f"  landing HTTP {e.get('landing_status')} | search HTTP {e.get('search_status')}"
              f" | announce-type={ANNONCE_TYPE[kind]} | Nombre de résultats={e.get('result_count')}")
        print(f"  rows on first page: {e.get('rows_on_page')}")
        for u in e.get("sample_refs", []):
            print(f"    - {u}")
    return report


# ── Phase 2/3: build the extraction sample ───────────────────────────────────
def _pdf_text(path: str) -> str:
    """Deterministic PDF text extraction (pypdf). Returns "" on failure."""
    try:
        import warnings
        from pypdf import PdfReader
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            reader = PdfReader(path)
            return "\n".join((pg.extract_text() or "") for pg in reader.pages)
    except Exception as e:  # noqa: BLE001
        print(f"[probe] pypdf failed for {path}: {e}")
        return ""


def _fetch_pdf(client: httpx.Client, url: str, dest: str) -> bool:
    if os.path.exists(dest) and os.path.getsize(dest) > 1000:
        return True
    try:
        r = client.get(url)
        if r.status_code != 200 or r.content[:4] != b"%PDF":
            print(f"[probe] not a PDF ({r.status_code}) {url}")
            return False
        with open(dest, "wb") as f:
            f.write(r.content)
        return True
    except httpx.HTTPError as e:
        print(f"[probe] fetch error {url}: {e}")
        return False


def build_samples() -> list[dict]:
    """Fetch each verified award PDF, extract its text, parse it, and write the
    normalized objects to ``scraping/award_samples.jsonl``. Returns the records."""
    os.makedirs(CACHE_DIR, exist_ok=True)
    records: list[dict] = []
    with httpx.Client(headers=HEADERS, follow_redirects=True, timeout=90) as client:
        for i, doc in enumerate(SAMPLE_DOCS):
            dest = os.path.join(CACHE_DIR, f"{doc['key']}.pdf")
            ok = _fetch_pdf(client, doc["document_url"], dest)
            if not ok:
                print(f"[probe] skipping {doc['key']} (could not fetch)")
                continue
            text = _pdf_text(dest)
            # Also cache the extracted text next to the PDF for the fixtures/tests.
            with open(os.path.join(CACHE_DIR, f"{doc['key']}.txt"), "w", encoding="utf-8") as f:
                f.write(text)
            rec = ap.parse_award_document(
                text,
                source_type=doc["source_type"],
                source_url=doc["source_url"],
                document_url=doc["document_url"],
                method=doc["method"],
                buyer=doc.get("buyer"),
            )
            rec["_probe_key"] = doc["key"]
            rec["_probe_note"] = doc["note"]
            records.append(rec)
            if i < len(SAMPLE_DOCS) - 1:
                time.sleep(REQUEST_DELAY_SECONDS)

    with open(SAMPLES_PATH, "w", encoding="utf-8") as f:
        for rec in records:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    print(f"[probe] wrote {len(records)} records -> {SAMPLES_PATH}")
    for rec in records:
        print(f"  {rec['_probe_key']:26s} outcome={rec['outcome']:11s} "
              f"winner={str(rec['winner_name'])[:26]:26s} amount={rec['awarded_amount']} "
              f"p={rec['participants_count']} losers={rec['losers_count']} "
              f"conf={rec['extraction']['confidence']}")
    return records


def main(argv: list[str]) -> int:
    cmd = argv[1] if len(argv) > 1 else "all"
    if cmd in ("map", "all"):
        try:
            map_surfaces()
        except Exception as e:  # noqa: BLE001
            print(f"[probe] map_surfaces failed (network?): {e}")
    if cmd in ("samples", "all"):
        build_samples()
    if cmd not in ("map", "samples", "all"):
        print(__doc__)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
