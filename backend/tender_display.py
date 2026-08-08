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
    raw: Any = None,
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


def _first_value(*items: tuple[Any, str]) -> tuple[str, str, Any]:
    for value, source in items:
        cleaned = clean_text(value)
        if cleaned:
            return cleaned, source, value
    return "", "none", None


def _is_strict_expansion(value: str, other: str) -> bool:
    folded_value = _fold(value)
    folded_other = _fold(other)
    return bool(
        folded_value
        and folded_other
        and folded_value != folded_other
        and folded_value.startswith(f"{folded_other} ")
    )


def _select_buyer(details: dict, tender: dict) -> tuple[str, str, Any]:
    detail_value, detail_source, detail_raw = _first_value((details.get("acheteur", ""), "detail"))
    base_value, base_source, base_raw = _first_value((tender.get("entity", ""), "base"))
    if detail_value and base_value and _is_strict_expansion(base_value, detail_value):
        return base_value, base_source, base_raw
    if detail_value:
        return detail_value, detail_source, detail_raw
    return base_value, base_source, base_raw


def _location_from_title(*values: Any) -> tuple[str, Any]:
    pattern = re.compile(
        r"\b((?:commune|province|préfecture)\s+(?:de|d'|du|des)\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' -]{1,80}?)(?=$|[,;|])",
        flags=re.IGNORECASE,
    )
    for value in values:
        raw = clean_text(value)
        match = pattern.search(raw)
        if match:
            return clean_text(match.group(1)), value
    return "", None


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
    return cleaned


def parse_money(text: str) -> float | None:
    cleaned = clean_text(text)
    match = re.search(r"(\d(?:[\d\s.,]*\d)?)", cleaned)
    if not match:
        return None
    number = match.group(1).replace(" ", "")
    if "," in number:
        number = number.replace(".", "").replace(",", ".")
    else:
        pieces = number.split(".")
        if len(pieces) > 2 or (len(pieces) == 2 and len(pieces[1]) == 3):
            number = "".join(pieces)
    try:
        return float(number)
    except ValueError:
        return None


def _detail_text(details: dict | None) -> str:
    if not details:
        return ""
    return " | ".join(clean_text(v) for v in details.values() if clean_text(v))


def _money_signal(
    primary: Any,
    source: str,
    raw_text: str,
    labels: tuple[str, ...],
    allow_zero: bool = False,
    raw: Any = None,
    require_currency_for_regex: bool = False,
    regex_status: str = "detected",
) -> dict:
    value = clean_text(primary)
    raw_value = raw
    detected_source = source
    parsed = parse_money(value)
    if parsed is None and raw_text:
        label_pattern = "|".join(re.escape(label) for label in labels)
        match = re.search(
            rf"(?:{label_pattern})\s*[:\-]?\s*([0-9][0-9\s.,]*(?:MAD|DH|DHS)?)",
            raw_text,
            flags=re.IGNORECASE,
        )
        if match:
            value = clean_text(match.group(1))
            raw_value = match.group(0)
            detected_source = "regex"
            parsed = parse_money(value)
            if require_currency_for_regex and not re.search(r"\b(?:MAD|DH|DHS)\b", value, flags=re.IGNORECASE):
                parsed = None
    if parsed is None or (parsed == 0 and not allow_zero):
        return dict(MISSING)
    return display_value(
        value,
        status=regex_status if detected_source == "regex" else "detected",
        source=detected_source,
        confidence="high" if detected_source != "regex" else "medium",
        raw=raw_value,
    )


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
    title, title_source, title_raw = _first_value(
        (details.get("objet", ""), "detail"),
        (tender.get("title", ""), "base"),
        (f"Consultation {tender.get('reference', '')}", "computed"),
    )
    buyer, buyer_source, buyer_raw = _select_buyer(details, tender)
    location, location_source, location_raw = _first_value(
        (details.get("lieu_execution", ""), "detail"),
        (tender.get("location", ""), "base"),
    )
    location_from_title = False
    if not location:
        location, location_raw = _location_from_title(details.get("objet", ""), tender.get("title", ""))
        if location:
            location_source = "computed"
            location_from_title = True
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

    dce_url_raw = details.get("dce_url", "")
    dce_url = clean_text(dce_url_raw)
    procedure, procedure_source, procedure_raw = _first_value(
        (details.get("procedure", ""), "detail"),
        (tender.get("procedure_type", ""), "base"),
    )
    category, category_source, category_raw = _first_value(
        (details.get("categorie", ""), "detail"),
        (tender.get("category", ""), "base"),
    )
    deadline, deadline_source, deadline_raw = _first_value((tender.get("deadline", ""), "base"))
    reference, reference_source, reference_raw = _first_value((tender.get("reference", ""), "base"))
    estimation, estimation_source, estimation_raw = _first_value(
        (details.get("estimation", ""), "detail"),
        (tender.get("estimation", ""), "base"),
    )
    caution, caution_source, caution_raw = _first_value((details.get("caution_provisoire", ""), "detail"))
    plan_price, plan_price_source, plan_price_raw = _first_value((details.get("prix_plans", ""), "detail"))

    return {
        "display": {
            "title": display_value(title, source=title_source, confidence="high", raw=title_raw),
            "buyer": display_value(buyer, source=buyer_source, confidence="high", raw=buyer_raw) if buyer else dict(MISSING),
            "location": display_value(
                location,
                status="needs_verification" if location_from_title else "detected",
                source=location_source,
                confidence="low" if location_from_title else "high",
                raw=location_raw,
            ) if location else dict(MISSING),
            "procedure": display_value(procedure, source=procedure_source, confidence="high", raw=procedure_raw) if procedure else dict(MISSING),
            "category": display_value(category, source=category_source, confidence="high", raw=category_raw) if category else dict(MISSING),
            "deadline": display_value(deadline, source=deadline_source, confidence="high", raw=deadline_raw) if deadline else dict(MISSING),
            "reference": display_value(reference, source=reference_source, confidence="high", raw=reference_raw) if reference else dict(MISSING),
        },
        "signals": {
            "estimation": _money_signal(estimation, estimation_source, raw_text, ("Estimation", "Estimation TTC", "montant estimatif", "budget prévisionnel"), raw=estimation_raw),
            "caution": _money_signal(caution, caution_source, raw_text, ("Caution provisoire", "cautionnement provisoire", "garantie provisoire"), raw=caution_raw),
            "plan_price": _money_signal(plan_price, plan_price_source, raw_text, ("Prix d'acquisition des plans",), allow_zero=True, raw=plan_price_raw),
            "dce_available": display_value(True, source="detail", confidence="high", raw=dce_url_raw) if dce_url else display_value(False, status="missing", source="none", confidence="none"),
            "applications_count": _applications_signal(raw_text),
            "market_price": _money_signal(
                "",
                "none",
                raw_text,
                ("montant du marché", "prix du marché", "montant attribué", "offre retenue"),
                allow_zero=False,
                require_currency_for_regex=True,
                regex_status="needs_verification",
            ),
        },
    }
