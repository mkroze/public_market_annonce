import re
import unicodedata
from typing import Any


MISSING = {
    "value": None,
    "status": "missing",
    "source": "none",
    "confidence": "none",
}


def clean_text(value: object) -> str:
    if value is None:
        return ""
    text = str(value).replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\s+(MAD|DH|DHS)\b", r" \1", text, flags=re.IGNORECASE)
    return text.strip(" -–—,;:.")


def _fold(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    asciiish = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", " ", asciiish.lower()).strip()


def display_value(
    value: Any,
    status: str = "detected",
    source: str = "computed",
    confidence: str = "medium",
    raw: str | None = None,
) -> dict:
    payload = {
        "value": value,
        "status": status,
        "source": source,
        "confidence": confidence,
    }
    if raw is not None:
        payload["raw"] = raw
    return payload


def _first_value(*items: tuple[str, str]) -> tuple[str, str]:
    for value, source in items:
        cleaned = clean_text(value)
        if cleaned:
            return cleaned, source
    return "", "none"


def _remove_duplicate_location_suffix(title: str, location: str, buyer: str) -> str:
    cleaned = clean_text(title)
    folded_location = _fold(location)
    folded_buyer = _fold(buyer)
    if not cleaned:
        return cleaned

    patterns = [
        r"\s*[-–—,]\s*commune\s+(?:de|d'|du|des)?\s*[^-–—,]+$",
        r"\s*[-–—,]\s*province\s+(?:de|d'|du|des)?\s*[^-–—,]+$",
        r"\s*[-–—,]\s*préfecture\s+(?:de|d'|du|des)?\s*[^-–—,]+$",
        r"\s+à\s+la\s+commune\s+(?:de|d'|du|des)?\s*[^-–—,]+$",
    ]
    for pattern in patterns:
        match = re.search(pattern, cleaned, flags=re.IGNORECASE)
        if not match:
            continue
        suffix = match.group(0)
        folded_suffix = _fold(suffix)
        if folded_location and folded_location in folded_suffix:
            return clean_text(cleaned[: match.start()])
        if folded_buyer and folded_buyer in folded_suffix:
            return clean_text(cleaned[: match.start()])
        if folded_suffix.startswith(("commune", "province", "prefecture")):
            return clean_text(cleaned[: match.start()])
    return cleaned


def parse_money(text: str) -> float | None:
    cleaned = clean_text(text)
    match = re.search(r"(\d[\d\s.]*,\d{1,2}|\d[\d\s.]*\.\d{1,2}|\d[\d\s.]*)", cleaned)
    if not match:
        return None
    number = match.group(1).replace(" ", "")
    if "," in number:
        number = number.replace(".", "").replace(",", ".")
    else:
        pieces = number.split(".")
        if len(pieces) > 2:
            number = "".join(pieces)
    try:
        return float(number)
    except ValueError:
        return None


def _detail_text(details: dict | None) -> str:
    if not details:
        return ""
    return " | ".join(clean_text(v) for v in details.values() if clean_text(v))


def _money_signal(primary: str, source: str, raw_text: str, labels: tuple[str, ...], allow_zero: bool = False) -> dict:
    value = clean_text(primary)
    raw = value
    detected_source = source
    if not value and raw_text:
        label_pattern = "|".join(re.escape(label) for label in labels)
        match = re.search(
            rf"(?:{label_pattern})\s*[:\-]?\s*([0-9][0-9\s.,]*(?:MAD|DH|DHS)?)",
            raw_text,
            flags=re.IGNORECASE,
        )
        if match:
            value = clean_text(match.group(1))
            raw = match.group(0)
            detected_source = "regex"
    parsed = parse_money(value)
    if parsed is None or (parsed == 0 and not allow_zero):
        return dict(MISSING)
    return display_value(value, source=detected_source, confidence="high" if detected_source != "regex" else "medium", raw=raw)


def _applications_signal(raw_text: str) -> dict:
    patterns = [
        r"(?:nombre\s+de\s+plis|nombre\s+d'offres|offres\s+reçues|soumissionnaires|concurrents|candidats|dossiers\s+déposés)\s*[:\-]?\s*(\d{1,3})",
        r"(\d{1,3})\s+(?:plis|offres|soumissionnaires|concurrents|candidats|dossiers)\s+(?:reçus|déposés|admis|retenus)",
    ]
    for pattern in patterns:
        match = re.search(pattern, raw_text, flags=re.IGNORECASE)
        if match:
            return display_value(int(match.group(1)), source="regex", confidence="medium", raw=match.group(0))
    return dict(MISSING)


def build_tender_display(tender: dict, details: dict | None = None) -> dict:
    details = details or {}
    title_raw, title_source = _first_value(
        (details.get("objet", ""), "detail"),
        (tender.get("title", ""), "base"),
        (f"Consultation {tender.get('reference', '')}", "computed"),
    )
    buyer, buyer_source = _first_value(
        (details.get("acheteur", ""), "detail"),
        (tender.get("entity", ""), "base"),
    )
    location, location_source = _first_value(
        (details.get("lieu_execution", ""), "detail"),
        (tender.get("location", ""), "base"),
    )
    title = _remove_duplicate_location_suffix(title_raw, location, buyer)
    raw_text = " | ".join(
        clean_text(value)
        for value in [
            tender.get("title", ""),
            tender.get("entity", ""),
            tender.get("location", ""),
            _detail_text(details),
        ]
        if clean_text(value)
    )

    dce_url = clean_text(details.get("dce_url", ""))

    return {
        "display": {
            "title": display_value(title, source=title_source, confidence="high", raw=title_raw),
            "buyer": display_value(buyer, source=buyer_source, confidence="high") if buyer else dict(MISSING),
            "location": display_value(location, source=location_source, confidence="high") if location else dict(MISSING),
            "procedure": display_value(clean_text(details.get("procedure") or tender.get("procedure_type")), source="detail" if details.get("procedure") else "base", confidence="high") if clean_text(details.get("procedure") or tender.get("procedure_type")) else dict(MISSING),
            "category": display_value(clean_text(details.get("categorie") or tender.get("category")), source="detail" if details.get("categorie") else "base", confidence="high") if clean_text(details.get("categorie") or tender.get("category")) else dict(MISSING),
            "deadline": display_value(clean_text(tender.get("deadline")), source="base", confidence="high") if clean_text(tender.get("deadline")) else dict(MISSING),
            "reference": display_value(clean_text(tender.get("reference")), source="base", confidence="high") if clean_text(tender.get("reference")) else dict(MISSING),
        },
        "signals": {
            "estimation": _money_signal(details.get("estimation", "") or tender.get("estimation", ""), "detail" if details.get("estimation") else "base", raw_text, ("Estimation", "Estimation TTC", "montant estimatif", "budget prévisionnel")),
            "caution": _money_signal(details.get("caution_provisoire", ""), "detail", raw_text, ("Caution provisoire", "cautionnement provisoire", "garantie provisoire")),
            "plan_price": _money_signal(details.get("prix_plans", ""), "detail", raw_text, ("Prix d'acquisition des plans",), allow_zero=True),
            "dce_available": display_value(True, source="detail", confidence="high", raw=dce_url) if dce_url else display_value(False, status="missing", source="none", confidence="none"),
            "applications_count": _applications_signal(raw_text),
            "market_price": _money_signal("", "none", raw_text, ("montant du marché", "prix du marché", "montant attribué", "offre retenue"), allow_zero=False),
        },
    }
