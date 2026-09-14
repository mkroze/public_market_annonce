"""Company-profile parsing + the conservative eligibility rule set.

The company profile (stored on `users`, all optional, `source: user`, unverified)
drives an *opt-in* "épuré" catalog: hide only tenders a company is **provably**
unable to bid on. Guiding principle — *innocent until proven ineligible*: on any
missing tender data or missing profile data, KEEP the tender. Relevance ≠
eligibility, and the platform never asserts legal eligibility (décision-support
only). See docs/superpowers/specs/2026-09-14-user-profile-eligibility-design.md.
"""

import json

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
