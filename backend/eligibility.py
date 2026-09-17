"""Company-profile parsing + the conservative eligibility rule set.

The company profile (stored on `users`, all optional, `source: user`, unverified)
drives an *opt-in* "épuré" catalog: hide only tenders a company is **provably**
unable to bid on. Guiding principle — *innocent until proven ineligible*: on any
missing tender data or missing profile data, KEEP the tender. Relevance ≠
eligibility, and the platform never asserts legal eligibility (décision-support
only). See docs/superpowers/specs/2026-09-14-user-profile-eligibility-design.md.
"""

import json
import unicodedata

# ── Allowlists (validated on write; empty string always allowed) ─────────────
LEGAL_FORMS = {
    "auto_entrepreneur", "personne_physique", "sarl", "sarl_au", "sa", "sas",
    "snc", "cooperative", "gie", "association", "autre",
}
SIZE_BANDS = {"micro", "tpe", "pme", "eti", "grande"}
REVENUE_BANDS = {"lt_1m", "1m_10m", "10m_50m", "50m_200m", "gt_200m"}
PROCUREMENT_CATEGORIES = {"Travaux", "Fournitures", "Services"}

# Size bands considered ABOVE the PME ceiling → cannot bid a PME-reserved lot alone
# (loi 2-14-46 / décret 2-12-349: ≥20% réservé aux PME).
_ABOVE_PME_SIZE_BANDS = {"eti", "grande"}

# JSON-array columns → the profile key they expose.
_JSON_LIST_FIELDS = {
    "profile_sectors_json": "sectors",
    "profile_categories_json": "categories",
    "qualifications_json": "qualifications",
    "certifications_json": "certifications",
    "coverage_regions_json": "coverage_regions",
    "preferred_procedures_json": "preferred_procedures",
}
_TEXT_FIELDS = (
    "legal_form", "ice", "rc_number", "rc_city", "if_number", "cnss_number",
    "patente_number", "hq_city", "profile_keywords", "size_band", "revenue_band",
)
_INT_FIELDS = ("contract_min", "contract_max")
_BOOL_FIELDS = ("bids_in_groupement", "eligibility_filter_default")

# `profile_keywords` is a plain text column but exposed under a friendlier key.
_TEXT_KEY_RENAME = {"profile_keywords": "keywords"}


def _load_list(raw):
    if not raw:
        return []
    if isinstance(raw, list):
        return raw
    try:
        value = json.loads(raw)
        return value if isinstance(value, list) else []
    except (ValueError, TypeError):
        return []


def _load_dict(raw):
    if not raw:
        return {}
    if isinstance(raw, dict):
        return raw
    try:
        value = json.loads(raw)
        return value if isinstance(value, dict) else {}
    except (ValueError, TypeError):
        return {}


def parse_profile(user_row: dict) -> dict:
    """Turn a raw `users` row (or {}) into a normalized profile dict.

    Tolerant: missing keys, NULLs, and malformed JSON all degrade to empties.
    """
    row = user_row or {}
    profile: dict = {}
    for col, key in _JSON_LIST_FIELDS.items():
        profile[key] = _load_list(row.get(col))
    for col in _TEXT_FIELDS:
        key = _TEXT_KEY_RENAME.get(col, col)
        profile[key] = (row.get(col) or "")
    for col in _INT_FIELDS:
        value = row.get(col)
        profile[col] = value if isinstance(value, int) else None
    for col in _BOOL_FIELDS:
        profile[col] = bool(row.get(col))
    # `standing` holds the art. 27 self-declaration questionnaire answers
    # ({question_id: "oui"|"non"|"nsp"}); classification reads it, evaluate() does not.
    profile["standing"] = _load_dict(row.get("standing_json"))
    return profile


def profile_is_empty(profile: dict) -> bool:
    """A profile with no eligibility-relevant signal → the filter is a no-op."""
    if not profile:
        return True
    for key in ("sectors", "categories", "qualifications", "certifications",
                "coverage_regions", "preferred_procedures"):
        if profile.get(key):
            return False
    for key in ("legal_form", "keywords", "size_band", "revenue_band"):
        if profile.get(key):
            return False
    for key in ("contract_min", "contract_max"):
        if profile.get(key) is not None:
            return False
    if profile.get("bids_in_groupement"):
        return False
    return True


_NEGATIVE_MARKERS = {"", "non", "no", "n/a", "na", "-", "aucun", "aucune", "0", "false", "لا"}


def is_reserved_pme(text) -> bool:
    """Whether a `tender_details.reserved_pme` value marks a PME/auto-entrepreneur
    reservation. Conservative: empty / explicit-negative → False; any positive
    marker → True."""
    if not text:
        return False
    value = str(text).strip().lower()
    if value in _NEGATIVE_MARKERS:
        return False
    # Explicit positive phrasings (FR/AR) or a bare "oui"/"pme"/"réservé".
    positive_markers = ("oui", "yes", "pme", "réserv", "reserv", "auto", "نعم", "محجوز")
    return any(marker in value for marker in positive_markers)


def evaluate(tender_row: dict, detail_row: dict | None, profile: dict) -> dict:
    """Decide whether to HIDE a tender for a company under the v1 rule set.

    Returns {"hidden": bool, "reasons": [str]}. Hides only on a hard, data-backed
    exclusion; keeps on any doubt.
    """
    reasons: list[str] = []
    if not profile or profile_is_empty(profile):
        return {"hidden": False, "reasons": reasons}

    detail = detail_row or {}

    # Rule 1 — reserved-PME hard hide.
    if is_reserved_pme(detail.get("reserved_pme")):
        size_band = (profile.get("size_band") or "").strip().lower()
        if size_band in _ABOVE_PME_SIZE_BANDS and not profile.get("bids_in_groupement"):
            return {
                "hidden": True,
                "reasons": ["Lot réservé aux PME — profil au-dessus du plafond PME "
                            "(candidature en groupement non déclarée)."],
            }

    # Rule 2 — category soft hide (only if the profile declares categories).
    profile_categories = [c for c in (profile.get("categories") or []) if c]
    tender_category = (tender_row.get("category") or "").strip()
    if profile_categories and tender_category and tender_category not in profile_categories:
        return {
            "hidden": True,
            "reasons": [f"Catégorie « {tender_category} » hors de vos types de "
                        "prestation déclarés."],
        }

    return {"hidden": False, "reasons": reasons}


# ── Classification / derivation ("create it for them") ────────────────────────
# A small, pure rule set that DERIVES the eligibility-determining classification
# from the few PRIMARY declarations (legal form, sectors, size, standing answers).
# Everything here is decision-support only — every inferred value is labelled
# `derived`, never asserted as legal fact. The phase-2 ICE/RC registry enrichment
# will overlay these derived values when a real data source is wired.

# Human labels (kept in sync with the frontend selects) for building summaries.
LEGAL_FORM_LABELS = {
    "auto_entrepreneur": "Auto-entrepreneur", "personne_physique": "Personne physique",
    "sarl": "SARL", "sarl_au": "SARL AU", "sa": "SA", "sas": "SAS", "snc": "SNC",
    "cooperative": "Coopérative", "gie": "GIE", "association": "Association", "autre": "Autre",
}
SIZE_BAND_LABELS = {
    "micro": "Micro", "tpe": "TPE", "pme": "PME", "eti": "ETI", "grande": "Grande entreprise",
}
REVENUE_BAND_LABELS = {
    "lt_1m": "< 1 M MAD", "1m_10m": "1–10 M MAD", "10m_50m": "10–50 M MAD",
    "50m_200m": "50–200 M MAD", "gt_200m": "> 200 M MAD",
}

# Prestation category is encoded in the sector-code prefix (config.SECTORS):
# 1.x = Travaux, 2.x = Fournitures, 3.x = Services.
_SECTOR_PREFIX_CATEGORY = {"1": "Travaux", "2": "Fournitures", "3": "Services"}

# size_band → (default revenue_band, suggested contract ceiling MAD, is_pme).
# The ceiling is an informational "fourchette visée" default, NOT a hide rule.
_SIZE_DEFAULTS = {
    "micro":  ("lt_1m",    3_000_000,   True),
    "tpe":    ("lt_1m",    1_000_000,   True),
    "pme":    ("1m_10m",   20_000_000,  True),
    "eti":    ("50m_200m", 200_000_000, False),
    "grande": ("gt_200m",  None,        False),
}

# Auto-entrepreneur turnover ceiling (loi 114-13: 500k commercial/industriel/
# artisanal, 200k services) — the higher bound used as the suggested ceiling.
AUTO_ENTREPRENEUR_CEILING = 500_000
# Legal forms that are PME-eligible for reserved lots regardless of size band.
_PME_LEGAL_FORMS = {"auto_entrepreneur", "personne_physique", "cooperative"}

# art. 27 self-declaration questions and their kind (mirrors the frontend
# ELIGIBILITY_QUESTIONS in procedures.ts — keep the ids in sync).
STANDING_QUESTIONS = (
    ("capacite-juridique", "capacite"), ("capacite-technique", "capacite"),
    ("capacite-financiere", "capacite"), ("activite-liee", "capacite"),
    ("regularite-fiscale", "regularite"), ("regularite-sociale", "regularite"),
    ("liquidation", "exclusion"), ("redressement", "exclusion"),
    ("exclusion-152", "exclusion"), ("conflit-interets", "exclusion"),
    ("preparation-dossier", "exclusion"), ("multi-representation", "exclusion"),
)
_STANDING_KIND = dict(STANDING_QUESTIONS)

# Major Moroccan cities → région (2015 12-region découpage). Used to derive a
# coverage hint from the RC / HQ city. Matched accent- and case-insensitively.
_CITY_REGION = {
    "casablanca": "Casablanca-Settat", "mohammedia": "Casablanca-Settat",
    "settat": "Casablanca-Settat", "berrechid": "Casablanca-Settat",
    "el jadida": "Casablanca-Settat", "benslimane": "Casablanca-Settat",
    "rabat": "Rabat-Salé-Kénitra", "sale": "Rabat-Salé-Kénitra",
    "kenitra": "Rabat-Salé-Kénitra", "temara": "Rabat-Salé-Kénitra",
    "skhirat": "Rabat-Salé-Kénitra", "khemisset": "Rabat-Salé-Kénitra",
    "sidi kacem": "Rabat-Salé-Kénitra", "sidi slimane": "Rabat-Salé-Kénitra",
    "tanger": "Tanger-Tétouan-Al Hoceïma", "tetouan": "Tanger-Tétouan-Al Hoceïma",
    "al hoceima": "Tanger-Tétouan-Al Hoceïma", "larache": "Tanger-Tétouan-Al Hoceïma",
    "chefchaouen": "Tanger-Tétouan-Al Hoceïma", "ksar el kebir": "Tanger-Tétouan-Al Hoceïma",
    "fes": "Fès-Meknès", "meknes": "Fès-Meknès", "taza": "Fès-Meknès",
    "ifrane": "Fès-Meknès", "sefrou": "Fès-Meknès", "el hajeb": "Fès-Meknès",
    "taounate": "Fès-Meknès",
    "marrakech": "Marrakech-Safi", "safi": "Marrakech-Safi",
    "essaouira": "Marrakech-Safi", "youssoufia": "Marrakech-Safi",
    "chichaoua": "Marrakech-Safi", "el kelaa des sraghna": "Marrakech-Safi",
    "agadir": "Souss-Massa", "inezgane": "Souss-Massa", "taroudant": "Souss-Massa",
    "tiznit": "Souss-Massa", "chtouka ait baha": "Souss-Massa",
    "oujda": "L'Oriental", "nador": "L'Oriental", "berkane": "L'Oriental",
    "taourirt": "L'Oriental", "jerada": "L'Oriental", "figuig": "L'Oriental",
    "driouch": "L'Oriental",
    "beni mellal": "Béni Mellal-Khénifra", "khenifra": "Béni Mellal-Khénifra",
    "khouribga": "Béni Mellal-Khénifra", "fquih ben salah": "Béni Mellal-Khénifra",
    "azilal": "Béni Mellal-Khénifra",
    "errachidia": "Drâa-Tafilalet", "ouarzazate": "Drâa-Tafilalet",
    "zagora": "Drâa-Tafilalet", "tinghir": "Drâa-Tafilalet", "midelt": "Drâa-Tafilalet",
    "guelmim": "Guelmim-Oued Noun", "tan-tan": "Guelmim-Oued Noun",
    "sidi ifni": "Guelmim-Oued Noun",
    "laayoune": "Laâyoune-Sakia El Hamra", "boujdour": "Laâyoune-Sakia El Hamra",
    "es-semara": "Laâyoune-Sakia El Hamra", "smara": "Laâyoune-Sakia El Hamra",
    "dakhla": "Dakhla-Oued Ed-Dahab", "aousserd": "Dakhla-Oued Ed-Dahab",
}


def _normalize_city(text) -> str:
    """Lowercase, strip accents/punctuation-ish, for tolerant city matching."""
    if not text:
        return ""
    s = unicodedata.normalize("NFKD", str(text).strip().lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return " ".join(s.replace("'", " ").split())


def sector_category(code) -> str:
    """The prestation category for a sector code via its prefix (1/2/3)."""
    if not code:
        return ""
    return _SECTOR_PREFIX_CATEGORY.get(str(code).split(".")[0].strip(), "")


def derive_categories(sectors) -> list:
    """Ordered, de-duplicated prestation categories implied by the sectors."""
    seen, out = set(), []
    for code in sectors or []:
        cat = sector_category(code)
        if cat and cat not in seen:
            seen.add(cat)
            out.append(cat)
    return out


def derive_region(city) -> str:
    """Best-effort région for an RC/HQ city; empty if unknown."""
    return _CITY_REGION.get(_normalize_city(city), "")


def qualification_hints(sectors, categories) -> list:
    """Candidate qualification/agrément families the company likely must declare,
    inferred from activity. Suggestions to prompt the user, never assertions."""
    sectors = sectors or []
    categories = categories or []
    hints = []
    if any(str(s).startswith("1.") for s in sectors) or "Travaux" in categories:
        hints.append("Agrément / qualification-classification (secteur travaux, BTP)")
    if "3.1" in sectors:
        hints.append("Agrément bureaux d'études (études, maîtrise d'œuvre)")
    return hints


def evaluate_standing(answers: dict) -> str:
    """Reduce the art. 27 questionnaire answers to a verdict.

    Returns one of: `clear`, `risk`, `blocked`, `unknown`. Mirrors the frontend
    verdict logic: a `non` on a capacité/régularité question or an `oui` on an
    exclusion question is a hard fail; an unsure exclusion is a risk.
    """
    answers = answers or {}
    given = {qid: answers.get(qid) for qid, _ in STANDING_QUESTIONS if answers.get(qid)}
    if not given:
        return "unknown"
    for qid, kind in STANDING_QUESTIONS:
        ans = answers.get(qid)
        if kind == "exclusion" and ans == "oui":
            return "blocked"
        if kind != "exclusion" and ans == "non":
            return "blocked"
    if any(_STANDING_KIND[qid] == "exclusion" and answers.get(qid) == "nsp"
           for qid, _ in STANDING_QUESTIONS):
        return "risk"
    if len(given) == len(STANDING_QUESTIONS) and all(v != "nsp" for v in given.values()):
        return "clear"
    return "unknown"


def enrich_profile_from_registry(profile: dict) -> dict:
    """Phase-2 overlay hook (ICE/RC registry enrichment).

    Currently an identity function — no official data source is wired yet, so the
    classification is built from declared values only. When an OMPIC / registre-
    de-commerce / portail-des-marchés feed lands, populate the *missing* identity
    and activity fields here from the declared ICE/RC (declared values win;
    the registry only fills gaps) so the classification improves without the user
    typing more. Kept as a single, documented seam applied inside `classify` so
    every read benefits at once. See the eligibility-classification design doc.
    """
    return profile


def classify(profile: dict) -> dict:
    """Derive the full eligibility classification from a parsed profile.

    Pure and non-mutating: returns the 5-group classification plus a
    `derived` dict of values we'd propose to persist (only for fields the user
    hasn't set), a completeness score, and a one-line summary. Decision-support
    only — inferred values carry a `*_source: "derived"` marker.
    """
    profile = enrich_profile_from_registry(profile or {})
    legal_form = (profile.get("legal_form") or "").strip().lower()
    sectors = [s for s in (profile.get("sectors") or []) if s]
    user_categories = [c for c in (profile.get("categories") or []) if c]
    size_band = (profile.get("size_band") or "").strip().lower()
    user_revenue = (profile.get("revenue_band") or "").strip().lower()
    user_contract_max = profile.get("contract_max")
    standing_answers = profile.get("standing") or {}

    # Activity fit — categories from sectors when the user didn't pick them.
    derived_categories = derive_categories(sectors)
    categories = user_categories or derived_categories
    categories_source = "user" if user_categories else ("derived" if derived_categories else "none")

    # Capacity scale — revenue band, contract ceiling, PME status.
    size_default = _SIZE_DEFAULTS.get(size_band)
    derived_revenue = size_default[0] if size_default else ""
    revenue = user_revenue or derived_revenue
    revenue_source = "user" if user_revenue else ("derived" if derived_revenue else "none")

    is_pme = None
    ceiling = user_contract_max if isinstance(user_contract_max, int) else None
    ceiling_source = "user" if isinstance(user_contract_max, int) else "none"
    if size_default:
        is_pme = size_default[2]
        if ceiling is None and size_default[1] is not None:
            ceiling, ceiling_source = size_default[1], "derived"
    if legal_form in _PME_LEGAL_FORMS:
        is_pme = True
    if legal_form == "auto_entrepreneur" and (ceiling is None or ceiling > AUTO_ENTREPRENEUR_CEILING):
        ceiling, ceiling_source = AUTO_ENTREPRENEUR_CEILING, "derived"

    hq_region = derive_region(profile.get("hq_city") or profile.get("rc_city") or "")

    held = list(profile.get("qualifications") or [])
    certs = list(profile.get("certifications") or [])
    candidate_families = qualification_hints(sectors, categories)

    verdict = evaluate_standing(standing_answers)

    identifiers_present = {
        key: bool((profile.get(col) or "").strip())
        for key, col in (("ice", "ice"), ("rc", "rc_number"), ("if", "if_number"),
                         ("cnss", "cnss_number"), ("patente", "patente_number"))
    }

    groups_filled = [
        bool(legal_form),
        bool(sectors or categories),
        bool(size_band or revenue),
        bool(held or certs),
        verdict != "unknown",
    ]
    completeness = round(sum(groups_filled) / len(groups_filled), 2)

    parts = []
    if legal_form:
        parts.append(LEGAL_FORM_LABELS.get(legal_form, legal_form))
    if categories:
        parts.append(" / ".join(categories))
    if size_band:
        parts.append(SIZE_BAND_LABELS.get(size_band, size_band))
    if hq_region:
        parts.append(hq_region)
    summary = " · ".join(parts)

    # Proposals to persist — only fields the user hasn't set themselves.
    derived: dict = {}
    if not user_categories and derived_categories:
        derived["categories"] = derived_categories
    if not user_revenue and derived_revenue:
        derived["revenue_band"] = derived_revenue
    if not isinstance(user_contract_max, int) and ceiling is not None:
        derived["contract_max"] = ceiling

    return {
        "legal_identity": {
            "legal_form": legal_form,
            "legal_form_label": LEGAL_FORM_LABELS.get(legal_form, ""),
            "hq_region": hq_region,
            "identifiers_present": identifiers_present,
        },
        "activity_fit": {
            "sectors": sectors,
            "categories": categories,
            "categories_source": categories_source,
        },
        "capacity_scale": {
            "size_band": size_band,
            "size_band_label": SIZE_BAND_LABELS.get(size_band, ""),
            "revenue_band": revenue,
            "revenue_band_label": REVENUE_BAND_LABELS.get(revenue, ""),
            "revenue_band_source": revenue_source,
            "contract_ceiling": ceiling,
            "contract_ceiling_source": ceiling_source,
            "is_pme": is_pme,
        },
        "qualifications": {
            "held": held,
            "certifications": certs,
            "candidate_families": candidate_families,
        },
        "standing": {
            "answers": standing_answers,
            "verdict": verdict,
            "bids_in_groupement": bool(profile.get("bids_in_groupement")),
        },
        "completeness": completeness,
        "summary": summary,
        "derived": derived,
    }


# ── Partial-profile write (shared by member PATCH + admin override) ────────────
# Maps a ProfileUpdate/override key → (users column, serializer kind). List and
# dict fields are JSON-dumped; bools normalized to 0/1; everything else as-is.
PROFILE_COLUMN_MAP = {
    "legal_form": ("legal_form", None),
    "ice": ("ice", None),
    "rc_number": ("rc_number", None),
    "rc_city": ("rc_city", None),
    "if_number": ("if_number", None),
    "cnss_number": ("cnss_number", None),
    "patente_number": ("patente_number", None),
    "hq_city": ("hq_city", None),
    "sectors": ("profile_sectors_json", "json"),
    "categories": ("profile_categories_json", "json"),
    "qualifications": ("qualifications_json", "json"),
    "certifications": ("certifications_json", "json"),
    "coverage_regions": ("coverage_regions_json", "json"),
    "keywords": ("profile_keywords", None),
    "size_band": ("size_band", None),
    "revenue_band": ("revenue_band", None),
    "contract_min": ("contract_min", None),
    "contract_max": ("contract_max", None),
    "bids_in_groupement": ("bids_in_groupement", "bool"),
    "preferred_procedures": ("preferred_procedures_json", "json"),
    "eligibility_filter_default": ("eligibility_filter_default", "bool"),
    "standing": ("standing_json", "json"),
}


def serialize_profile_update(provided: dict) -> tuple[list, list]:
    """Validate + serialize a partial profile update into SQL SET clauses/params.

    Only known keys with non-None values are written (progressive profiling).
    Raises ValueError (with a user-facing FR message) on an invalid enum value.
    """
    if provided.get("legal_form") and provided["legal_form"] not in LEGAL_FORMS:
        raise ValueError("Forme juridique invalide.")
    if provided.get("size_band") and provided["size_band"] not in SIZE_BANDS:
        raise ValueError("Tranche d'effectif invalide.")
    if provided.get("revenue_band") and provided["revenue_band"] not in REVENUE_BANDS:
        raise ValueError("Tranche de chiffre d'affaires invalide.")

    set_clauses, params = [], []
    for key, value in provided.items():
        if value is None:
            continue
        mapping = PROFILE_COLUMN_MAP.get(key)
        if not mapping:
            continue
        column, kind = mapping
        if kind == "json":
            params.append(json.dumps(value, ensure_ascii=False))
        elif kind == "bool":
            params.append(1 if value else 0)
        else:
            params.append(value)
        set_clauses.append(f"{column} = ?")
    return set_clauses, params
