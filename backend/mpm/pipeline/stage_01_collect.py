import hashlib
import re
from datetime import datetime

import httpx
from bs4 import BeautifulSoup, Tag

from mpm.core.config import BASE_URL, HEADERS, SEARCH_URL, SECTORS, CATEGORIES
from mpm.db.database import get_db
from mpm.core.mem_profile import profile_run
from mpm.pipeline.control import SCRAPE
from mpm.tenders.tender_lifecycle import parse_deadline_date

# Substrings that mark a rate-limit / CAPTCHA interstitial served in place of a
# ZIP. Presence => the portal is pushing back on us (a "flag"), not a bad tender.
_RATE_LIMIT_MARKERS = ("captcha", "trop de requêtes", "trop de requetes", "access denied")


async def fetch_page(url: str, params: dict | None = None) -> str:
    async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True, timeout=30) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        return resp.text


# The 2026 redesign replaced the results <table> with a stream of
# `div.contentColumn > div.item.tender_item` cards, each carrying its own
# refConsultation/orgAcronyme pair in the card's onclick/detail link rather
# than in hidden check-col inputs.
_DETAIL_LINK_RE = re.compile(
    r"EntrepriseDetailsConsultation.*?refConsultation=(?P<ref>[^&\"']+).*?orgAcronyme=(?P<org>[^&\"']+)"
)

# Deadline cards render "Jeu 07 Jan 2027" / "11:00" rather than the old raw
# DD/MM/YYYY. Covers both the French and English 3-letter abbreviations the
# portal has been observed using, since the site mixes locales.
_MONTHS = {
    "jan": 1, "fev": 2, "fév": 2, "feb": 2,
    "mar": 3, "avr": 4, "apr": 4,
    "mai": 5, "may": 5, "jun": 6, "juin": 6,
    "jul": 7, "juil": 7,
    "aou": 8, "aoû": 8, "aug": 8,
    "sep": 9, "oct": 10, "nov": 11,
    "dec": 12, "déc": 12,
}
_DEADLINE_TEXT_RE = re.compile(
    r"(\d{2})\s+([A-Za-zÀ-ÿ]{3,4})\.?\s+(\d{4})(?:.*?(\d{2}:\d{2}))?", re.DOTALL
)


def _normalize_deadline_text(text: str) -> str:
    """Convert "Jeu 07 Jan 2027 ... 11:00" into "07/01/2027 11:00"."""
    m = _DEADLINE_TEXT_RE.search(text)
    if not m:
        return ""
    day, month_name, year, time_part = m.groups()
    month = _MONTHS.get(month_name.lower().rstrip("."))
    if not month:
        return ""
    result = f"{day}/{month:02d}/{year}"
    if time_part:
        result += f" {time_part}"
    return result


def parse_tender_list(html: str, sector_code: str) -> list[dict]:
    soup = BeautifulSoup(html, "lxml")
    tenders = []

    cards = soup.find_all("div", class_="tender_item")

    for card in cards:
        tender = extract_tender_from_card(card, sector_code)
        if tender:
            tenders.append(tender)

    return tenders


def extract_tender_from_card(card: Tag, sector_code: str) -> dict | None:
    # The card's own container carries the onclick with refConsultation/orgAcronyme;
    # it's the parent of the `tender_item` div passed in here.
    container = card.find_parent("div", class_="contentColumn") or card
    ref_cons = ""
    org_code = ""
    onclick = container.get("onclick", "")
    m = _DETAIL_LINK_RE.search(onclick)
    if not m:
        link = card.find("a", href=_DETAIL_LINK_RE)
        if link:
            m = _DETAIL_LINK_RE.search(link["href"])
    if m:
        ref_cons = m.group("ref")
        org_code = m.group("org")

    detail_url = ""
    if ref_cons and org_code:
        detail_url = (
            f"{BASE_URL}/?page=entreprise.EntrepriseDetailsConsultation"
            f"&refConsultation={ref_cons}&orgAcronyme={org_code}&echanges"
        )

    # Procedure type (AOO, AOR, ...)
    procedure_type = ""
    proc_span = card.find("span", class_="verticalText")
    if proc_span:
        procedure_type = proc_span.get_text(strip=True)

    # Reference, e.g. "01/2027"
    reference = ""
    ref_span = card.find("span", attrs={"id": re.compile(r"_referencem$")})
    if ref_span:
        reference = ref_span.get_text(strip=True)

    # Title / objet
    title = ""
    objet_div = card.find("div", class_="p-objet")
    if objet_div:
        text = objet_div.get_text(" ", strip=True)
        text = re.sub(r"^Objet\s*:\s*", "", text)
        title = text.strip()

    # Entity / acheteur public
    entity = ""
    for title_div in card.find_all("div", class_="title"):
        text = title_div.get_text(" ", strip=True)
        if "Acheteur public" in text:
            entity = re.sub(r"^Acheteur public\s*:\s*", "", text).strip()
            break

    # Deadline: "limita" blocks hold a calendar date span and a clock time span
    deadline = ""
    limita_blocks = card.find_all("div", class_="limita")
    for block in limita_blocks:
        date_icon = block.find("i", class_="fa-calendar-o")
        if date_icon:
            deadline = _normalize_deadline_text(block.get_text(" ", strip=True))
            break

    # Location
    location = ""
    loc_div = card.find("div", attrs={"id": re.compile(r"panelBlocLieuxExec$")})
    if loc_div:
        raw = loc_div.get_text(" ", strip=True)
        raw = re.sub(r"^Lieu d'exécution\s*", "", raw)
        raw = raw.split("...")[0].strip()
        raw = re.sub(r"\s*,\s*", ", ", raw)
        location = raw.rstrip(", ")

    if not reference and not title:
        return None

    category_code = sector_code.split(".")[0] if "." in sector_code else ""
    category = CATEGORIES.get(category_code, "")
    sector_name = SECTORS.get(sector_code, "")

    tender_id = hashlib.md5(f"{ref_cons}:{org_code}:{reference}".encode()).hexdigest()

    return {
        "id": tender_id,
        "reference": reference,
        "title": title,
        "entity": entity,
        "entity_code": org_code,
        "sector_code": sector_code,
        "sector_name": sector_name,
        "category": category,
        "deadline": deadline,
        "publication_date": "",
        "status": "en_cours",
        "procedure_type": procedure_type,
        "location": location,
        "detail_url": detail_url,
    }


async def scrape_sector(sector_code: str) -> list[dict]:
    params = {
        "page": "entreprise.EntrepriseAdvancedSearch",
        "AllCons": "",
        "EnCours": "",
        "domaineActivite": sector_code,
    }
    try:
        html = await fetch_page(SEARCH_URL, params)
        return parse_tender_list(html, sector_code)
    except Exception as e:
        print(f"[scraper] Error scraping sector {sector_code}: {e}")
        return []


async def scrape_tender_detail(detail_url: str) -> dict | None:
    """Scrape a single tender detail page and return structured data."""
    try:
        html = await fetch_page(detail_url)
    except Exception as e:
        print(f"[scraper] Error fetching detail {detail_url}: {e}")
        return None

    soup = BeautifulSoup(html, "lxml")
    main = soup.find("div", class_="main-part")
    if not main:
        return None

    # Build a dict from all intitule-300 label/value pairs (renamed from
    # intitule-240 by the 2026 portal redesign; label -> sibling content-bloc
    # structure is otherwise unchanged).
    fields: dict[str, str] = {}
    for label_div in main.find_all("div", class_="intitule-300"):
        label = label_div.get_text(strip=True).rstrip(" :")
        value_div = label_div.find_next_sibling("div", class_="content-bloc")
        if value_div:
            value = value_div.get_text(" ", strip=True)
            if value and value != "-":
                fields[label] = value

    def f(key: str) -> str:
        """Fuzzy match a field by checking if key is a substring of any label."""
        for k, v in fields.items():
            if key.lower() in k.lower():
                return v
        return ""

    # Extract document links
    dce_url = ""
    avis_url = ""
    for a in main.find_all("a", href=True):
        href = a["href"]
        if "TelechargementDce" in href:
            if not href.startswith("http"):
                href = f"{BASE_URL}/{href.lstrip('/')}"
            dce_url = href
        elif "DownloadAvisJAL" in href:
            if not href.startswith("http"):
                href = f"{BASE_URL}/{href.lstrip('/')}"
            avis_url = href

    return {
        "objet": f("Objet"),
        "acheteur": f("Acheteur public"),
        "annonce_type": f("Type d'annonce"),
        "procedure": f("Procédure"),
        "categorie": f("Catégorie principal"),
        "allotissement": f("Allotissement"),
        "lieu_execution": f("Lieu d'exécution"),
        "estimation": f("Estimation"),
        "domaines": f("Domaines d'activité"),
        "adresse_retrait": f("Adresse de retrait"),
        "adresse_depot": f("Adresse de dépôt"),
        "lieu_ouverture": f("Lieu d'ouverture"),
        "caution_provisoire": f("Caution provisoire"),
        "qualifications": f("Qualifications"),
        "agrements": f("Agréments"),
        "variante": f("Variante"),
        "reunion": f("Réunion"),
        "visite_lieux": f("Visite"),
        "contact": f("Contact"),
        "reserved_pme": f("Réservé"),
        "prix_plans": f("Prix d'acquisition"),
        "dce_url": dce_url,
        "avis_url": avis_url,
        "documents_url": dce_url or avis_url,
    }


DETAIL_COLS = [
    "objet", "acheteur", "annonce_type", "procedure",
    "categorie", "allotissement", "lieu_execution", "estimation",
    "domaines", "adresse_retrait", "adresse_depot", "lieu_ouverture",
    "caution_provisoire", "qualifications", "agrements", "variante",
    "reunion", "visite_lieux", "contact", "documents_url", "dce_url",
    "avis_url", "reserved_pme", "prix_plans",
]


async def ensure_tender_details(db, tender_id: str, detail_url: str) -> dict | None:
    """Return stored tender details, lazily scraping and caching them if absent."""
    cursor = await db.execute(
        "SELECT * FROM tender_details WHERE tender_id = ?", (tender_id,)
    )
    row = await cursor.fetchone()
    if row:
        return dict(row)
    if not detail_url:
        return None
    scraped = await scrape_tender_detail(detail_url)
    if not scraped:
        return None
    cols = ["tender_id"] + DETAIL_COLS
    placeholders = ", ".join(["?"] * len(cols))
    values = [tender_id] + [scraped.get(c, "") for c in DETAIL_COLS]
    await db.execute(
        f"INSERT OR REPLACE INTO tender_details ({', '.join(cols)}) VALUES ({placeholders})",
        values,
    )
    await db.commit()
    return scraped


async def download_dce(dce_url: str) -> tuple[str, tuple[bytes, str] | str | None]:
    """Download the DCE ZIP by filling the form headlessly.

    Returns a typed result:
      ("ok", (file_bytes, filename)) on success
      ("failed", None)               local per-tender failure (skip this tender)
      ("flagged", reason)            portal pushing back (429/503/reset/captcha)
    Steps: GET form -> POST form with anonymous info -> POST download button -> follow redirect to ZIP.
    """
    from mpm.core.config import HEADERS, BASE_URL

    try:
        async with httpx.AsyncClient(
            headers=HEADERS, follow_redirects=True, timeout=120, base_url=BASE_URL
        ) as client:
            # Step 1: GET the form page
            resp = await client.get(dce_url)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "lxml")

            pagestate_el = soup.find("input", {"id": "PRADO_PAGESTATE"})
            if not pagestate_el:
                print("[scraper] DCE: no PAGESTATE found")
                return ("failed", None)

            pagestate = pagestate_el["value"]
            france_radio = soup.find(
                "input",
                {"id": re.compile(r"EntrepriseFormulaireDemande_france$")},
            )
            france_value = france_radio["value"] if france_radio else ""

            # Collect all hidden inputs
            all_hidden = {}
            for inp in soup.find_all("input", {"type": "hidden"}):
                name = inp.get("name", "")
                if name:
                    all_hidden[name] = inp.get("value", "")

            # Build form data
            prefix = "ctl0$CONTENU_PAGE$EntrepriseFormulaireDemande$"
            form_data = dict(all_hidden)
            form_data.update({
                "PRADO_PAGESTATE": pagestate,
                "PRADO_POSTBACK_TARGET": "ctl0$CONTENU_PAGE$validateButton",
                "PRADO_POSTBACK_PARAMETER": "",
                f"{prefix}RadioGroup": f"{prefix}choixAnonyme",
                f"{prefix}accepterConditions": "on",
                f"{prefix}nom": "Utilisateur",
                f"{prefix}prenom": "Anonyme",
                f"{prefix}email": "contact@example.com",
                f"{prefix}raisonSocial": "",
                f"{prefix}etablissementEntreprise": france_value,
                f"{prefix}ICE": "",
                f"{prefix}address": "",
                f"{prefix}address2": "",
                f"{prefix}cp": "",
                f"{prefix}ville": "",
                f"{prefix}tel": "",
                f"{prefix}fax": "",
                f"{prefix}idNational": "",
                f"{prefix}pays": "0",
                "ctl0$CONTENU_PAGE$validateButton": "Valider",
            })

            # Step 2: Submit the form
            post_resp = await client.post(dce_url, data=form_data)
            post_resp.raise_for_status()
            soup2 = BeautifulSoup(post_resp.text, "lxml")

            new_pagestate_el = soup2.find("input", {"id": "PRADO_PAGESTATE"})
            if not new_pagestate_el:
                print("[scraper] DCE: no PAGESTATE after form submit")
                return ("failed", None)

            # Step 3: Click the download button (PRADO postback)
            download_data = {
                "PRADO_PAGESTATE": new_pagestate_el["value"],
                "PRADO_POSTBACK_TARGET": "ctl0$CONTENU_PAGE$EntrepriseDownloadDce$completeDownload",
                "PRADO_POSTBACK_PARAMETER": "",
            }
            for inp in soup2.find_all("input", {"type": "hidden"}):
                name = inp.get("name", "")
                if name and name not in download_data:
                    download_data[name] = inp.get("value", "")
            for inp in soup2.find_all("input", {"type": "text"}):
                name = inp.get("name", "")
                if name:
                    download_data[name] = inp.get("value", "")

            dl_resp = await client.post(dce_url, data=download_data)
            dl_resp.raise_for_status()

            ct = dl_resp.headers.get("content-type", "")
            if "zip" not in ct and "octet" not in ct and dl_resp.content[:2] != b"PK":
                body_lower = dl_resp.text[:2000].lower()
                if any(m in body_lower for m in _RATE_LIMIT_MARKERS):
                    return ("flagged", "captcha")
                print(f"[scraper] DCE: unexpected content-type: {ct}")
                return ("failed", None)

            # Extract filename from Content-Disposition
            cd = dl_resp.headers.get("content-disposition", "")
            filename = "dce.zip"
            if "filename=" in cd:
                raw = cd.split("filename=")[-1].strip().strip('"').strip("'").rstrip(";").strip('"')
                if raw:
                    filename = raw

            return ("ok", (dl_resp.content, filename))

    except httpx.HTTPStatusError as e:
        code = e.response.status_code
        if code in (429, 503):
            return ("flagged", f"http_{code}")
        return ("failed", None)
    except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout,
            httpx.PoolTimeout, httpx.RemoteProtocolError):
        return ("flagged", "conn_error")
    except Exception as e:
        print(f"[scraper] DCE download error: {e}")
        return ("failed", None)


# Columns the portal owns: a sweep keeps these in sync with the source. The
# moderation columns (admin_status, review_status, flag_note, archived_*) are
# deliberately absent — those belong to the operator, not to the portal, and a
# refresh must never undo an archive or a review.
_SOURCE_COLUMNS = (
    "reference", "title", "entity", "entity_code", "sector_code",
    "sector_name", "category", "deadline", "publication_date",
    "status", "procedure_type", "location", "detail_url",
)

_SELECT_TENDER_SQL = (
    f"SELECT {', '.join(_SOURCE_COLUMNS)} FROM tenders WHERE id = ?"
)

# `deadline_date` is normalized here rather than only in init_db()'s startup
# backfill, so a freshly imported notice lands in the right deadline filters
# and admin counts immediately instead of after the next restart.
_INSERT_TENDER_SQL = f"""INSERT OR IGNORE INTO tenders
       (id, {', '.join(_SOURCE_COLUMNS)},
        deadline_date, source_last_seen_at, last_seen_import_id)
       VALUES ({', '.join(['?'] * (len(_SOURCE_COLUMNS) + 1))}, ?, datetime('now'), ?)"""

_UPDATE_TENDER_SQL = f"""UPDATE tenders
       SET {', '.join(f'{c} = ?' for c in _SOURCE_COLUMNS)},
           deadline_date = ?, source_last_seen_at = datetime('now'),
           last_seen_import_id = ?
       WHERE id = ?"""


def _source_values(t: dict) -> list:
    return [t.get(c) for c in _SOURCE_COLUMNS]


def _source_changed(existing, t: dict) -> bool:
    """True when the portal's copy differs from ours. NULL and '' are the same
    absence of a value, so a parser returning one where the other was stored
    does not count as a source change."""
    return any((existing[c] or "") != (t.get(c) or "") for c in _SOURCE_COLUMNS)


async def scrape_all_sectors(actor_email: str | None = None, trigger: str = "scheduled") -> dict:
    db = await get_db()
    log_cursor = await db.execute(
        "INSERT INTO scrape_log (status, actor_email, trigger) VALUES ('running', ?, ?)",
        (actor_email, trigger),
    )
    log_id = log_cursor.lastrowid
    await db.commit()

    total_found = 0
    total_new = 0
    total_updated = 0
    total_unchanged = 0
    total_errors = 0
    new_ids: list[str] = []
    cancelled = False
    SCRAPE.begin({"sectors_total": len(SECTORS), "sectors_done": 0,
                  "found": 0, "new": 0, "updated": 0})

    try:
      async with profile_run("scrape_all_sectors"):
        for idx, sector_code in enumerate(SECTORS):
            # Cooperative pause/cancel between sectors.
            if not await SCRAPE.checkpoint():
                cancelled = True
                break

            tenders = await scrape_sector(sector_code)
            total_found += len(tenders)

            for t in tenders:
                tid = t.get("id")
                try:
                    deadline_date = parse_deadline_date(t.get("deadline"))
                    existing = await (await db.execute(_SELECT_TENDER_SQL, (tid,))).fetchone()

                    if existing is None:
                        before = db.total_changes
                        await db.execute(
                            _INSERT_TENDER_SQL,
                            (tid, *_source_values(t), deadline_date, log_id),
                        )
                        # total_changes is cumulative for the connection, so compare
                        # against its value before the insert to know if this row was
                        # actually new. An ignored insert means UNIQUE(reference,
                        # entity_code) is already held under a different id.
                        if db.total_changes > before:
                            total_new += 1
                            new_ids.append(tid)
                        else:
                            total_errors += 1
                            print(f"[scraper] {tid}: reference/entity already stored under another id")
                    else:
                        # Always rewrite source fields and last-seen metadata; the
                        # comparison only decides which counter this notice lands in,
                        # so a legacy row with a missing deadline_date is healed even
                        # when the portal's copy is unchanged.
                        changed = _source_changed(existing, t)
                        await db.execute(
                            _UPDATE_TENDER_SQL,
                            (*_source_values(t), deadline_date, log_id, tid),
                        )
                        if changed:
                            total_updated += 1
                        else:
                            total_unchanged += 1
                except Exception as e:
                    total_errors += 1
                    print(f"[scraper] DB upsert error for {tid}: {e}")

            await db.commit()

            # Release this sector's parsed rows before fetching the next one so
            # per-sector DOM/dict allocations don't accumulate across the sweep.
            del tenders

            # Live progress: flush interim counters so the polling admin UI shows
            # the run advancing sector by sector (previously only on completion).
            SCRAPE.update(sectors_done=idx + 1, found=total_found,
                          new=total_new, updated=total_updated)
            await db.execute(
                """UPDATE scrape_log
                   SET tenders_found = ?, tenders_new = ?, tenders_updated = ?,
                       tenders_skipped = ?
                   WHERE id = ?""",
                (total_found, total_new, total_updated, total_unchanged, log_id),
            )
            await db.commit()

        status = "stopped" if cancelled else "done"
        warnings = f"{total_errors} notice(s) could not be stored" if total_errors else None
        await db.execute(
            """UPDATE scrape_log
               SET finished_at = datetime('now'), tenders_found = ?, tenders_new = ?,
                   tenders_updated = ?, tenders_skipped = ?, status = ?, warnings = ?
               WHERE id = ?""",
            (total_found, total_new, total_updated, total_unchanged, status, warnings, log_id),
        )
        await db.commit()
    finally:
        await db.close()
        SCRAPE.end()

    return {
        "total_found": total_found,
        "total_new": total_new,
        "total_updated": total_updated,
        "total_unchanged": total_unchanged,
        "total_errors": total_errors,
        # Alert digests fan out on new_ids only: a refreshed deadline must not
        # re-notify subscribers who were already told about that tender.
        "new_ids": new_ids,
    }


async def scrape_homepage_counts() -> list[dict]:
    """Scrape the portal homepage for sector counts (fast overview)."""
    html = await fetch_page(f"{BASE_URL}/pmmp/")
    soup = BeautifulSoup(html, "lxml")
    counts = []

    for tab_id, category in [("fragment-1", "Travaux"), ("fragment-2", "Fournitures"), ("fragment-3", "Services")]:
        fragment = soup.find(id=tab_id)
        if not fragment:
            continue
        for row in fragment.find_all("tr"):
            cells = row.find_all("td")
            if len(cells) < 2:
                continue
            link = cells[0].find("a", href=True)
            sector_name = cells[0].get_text(strip=True)
            count_text = cells[1].get_text(strip=True)
            sector_code = ""
            if link:
                m = re.search(r"domaineActivite=([\d.]+)", link["href"])
                if m:
                    sector_code = m.group(1)
            try:
                count = int(count_text)
            except ValueError:
                count = 0
            counts.append({
                "category": category,
                "sector_code": sector_code,
                "sector_name": sector_name,
                "count": count,
            })

    return counts
