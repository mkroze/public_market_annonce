"""Parser for Moroccan public-procurement AWARD documents (PMMP).

Given the *text* of an award document — an ``Extrait de PV`` (tender-committee
minutes) or a ``Résultat définitif`` — this module extracts the award fields we
care about (winner, awarded amount, participants, losers) into the normalized
object described in ``docs/award-data-extraction-map.md``.

Design constraints (see the extraction spec / repo compliance notes):
  * **Never fabricate** a winner, amount, participant or loser count. Every
    extracted value carries a short source ``evidence`` quote, and anything the
    document does not support stays ``None``.
  * The parser works on *already-extracted text*. The caller decides how the
    text was obtained (HTML scrape, deterministic PDF text, or OCR) and passes
    that in as ``method`` so the confidence label is honest — OCR text is
    downgraded to ``low``.
  * No network, no PDF/OCR dependency here. PDF text extraction lives in the
    probe (``scraping/award_probe.py``); this stays pure + unit-testable on
    saved fixtures.

The document family is remarkably standardized (the model ``Extrait de PV`` /
``Résultat définitif`` templates published under Décret n°2-22-431), so a
label-anchored parser is reliable. Amounts and names are normalized
conservatively — the original string is always preserved in ``evidence``.
"""

from __future__ import annotations

import re
import unicodedata
from datetime import datetime, timezone

# ── Source-type constants ────────────────────────────────────────────────────
SOURCE_PV = "pv_extract"
SOURCE_FINAL = "final_result"

# ── Participant statuses ─────────────────────────────────────────────────────
ST_WINNER = "winner"
ST_REJECTED = "rejected"          # évincé / écarté (excluded after examination)
ST_NOT_RETAINED = "not_retained"  # submitted, admissible, but not chosen
ST_UNKNOWN = "unknown"

# Outcome when there is no award.
OUTCOME_INFRUCTUEUX = "infructueux"   # no admissible offer / declared unsuccessful
OUTCOME_CANCELLED = "cancelled"       # annulé
OUTCOME_AWARDED = "awarded"

# "Néant" (= none/nil) is the portal's placeholder for an empty list.
_NEANT_RE = re.compile(r"^\s*n[ée]ant\b", re.IGNORECASE)

# Fix common mojibake seen in text extracted from portal PDFs (WinAnsi/CP1252
# subset fonts render é→Ø, è→Ł, etc.). Conservative: only unambiguous swaps.
_MOJIBAKE = {
    "Ø": "é", "Ł": "è", "Œ": "e", "�": "",
}


def _fix_mojibake(s: str) -> str:
    for bad, good in _MOJIBAKE.items():
        s = s.replace(bad, good)
    return s


def _clean(s: str) -> str:
    """Collapse whitespace (incl. non-breaking) into single spaces; trim."""
    s = s.replace("\xa0", " ").replace(" ", " ")
    s = re.sub(r"[ \t\r\f]+", " ", s)
    return s.strip()


def _strip_accents(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )


# ── Amount normalization ─────────────────────────────────────────────────────
# Moroccan amounts: "1 853 595,00", "150 664,00 DH TTC", "26 976.00", with
# spaces/non-breaking spaces as thousands separators and a comma OR dot decimal.
_CURRENCY_RE = re.compile(r"\b(DH|DHS|MAD|DIRHAMS?)\b", re.IGNORECASE)


def normalize_amount(raw: str) -> float | None:
    """Parse a Moroccan money string into a float, or None if not a number.

    Handles space / non-breaking-space thousands separators and comma-or-dot
    decimals, and strips currency words (DH/MAD/Dhs/TTC/dirhams). Decimals are
    preserved. Returns None rather than guessing when the input is not numeric.
    """
    if raw is None:
        return None
    s = raw.replace("\xa0", " ").replace(" ", " ")
    # Drop currency / tax words so only the number remains.
    s = _CURRENCY_RE.sub(" ", s)
    s = re.sub(r"\bTTC\b|\bHT\b", " ", s, flags=re.IGNORECASE)
    # Keep only the first numeric run (digits, spaces, dots, commas).
    m = re.search(r"\d[\d ., ]*\d|\d", s)
    if not m:
        return None
    num = m.group(0).strip()
    num = num.replace(" ", "")
    # Decide the decimal separator: whichever of , or . appears LAST is decimal.
    last_comma = num.rfind(",")
    last_dot = num.rfind(".")
    if last_comma == -1 and last_dot == -1:
        digits = num
        dec = ""
    else:
        if last_comma > last_dot:
            dec_sep, thou_sep = ",", "."
        else:
            dec_sep, thou_sep = ".", ","
        digits, _, dec = num.rpartition(dec_sep)
        digits = digits.replace(thou_sep, "")
        # A 3-digit "decimal" is really a thousands group (e.g. "650.153" == 650153).
        if len(dec) == 3 and dec.isdigit():
            digits = digits + dec
            dec = ""
    digits = re.sub(r"\D", "", digits)
    dec = re.sub(r"\D", "", dec)
    if not digits and not dec:
        return None
    try:
        return float(f"{digits or '0'}.{dec or '0'}")
    except ValueError:
        return None


def normalize_company(raw: str) -> str:
    """Conservative company-name normalization: collapse whitespace, strip a
    trailing lot-count annotation like "(3 lots)". The ORIGINAL string is always
    what is quoted in evidence; this is only for the participant ``name`` field.
    """
    s = _clean(_fix_mojibake(raw))
    s = re.sub(r"\s*\(\s*\d+\s*lots?\s*\)\s*$", "", s, flags=re.IGNORECASE)
    return s.strip(" .;:-•\t")


# ── Label anchors ────────────────────────────────────────────────────────────
# All matched on the accent-stripped, lowercased line so encoding noise + accent
# loss don't break anchoring.
def _norm_line(line: str) -> str:
    return _strip_accents(_fix_mojibake(line)).lower()


_LIST_ANCHORS = {
    "participants": [
        r"liste des concurrents ayant depose",   # ... un pli / leurs plis
        r"concurrents ayant depose",
    ],
    "rejected": [
        r"concurrents evinces",
        r"concurrents ecartes",
        r"concurrents exclus",
    ],
    "admissible": [
        r"concurrents admis",       # admissibles / admis (sans/avec réserve)
    ],
    "winner_list": [
        r"concurrent retenu",
        r"soumissionnaire retenu",
        r"attributaire",
    ],
}

# A line that starts a *new* labelled section (so a bullet list ends here).
_ANY_ANCHOR_RE = re.compile(
    r"(liste des concurrents|concurrents (ayant|evinces|ecartes|admis|exclus)|"
    r"concurrent retenu|soumissionnaire retenu|montant des actes|montant de l'offre|"
    r"justification|date d'achevement|attributaire)"
)

_INFRUCTUEUX_RE = re.compile(r"infructueu")   # infructueux / infructueuse
_CANCELLED_RE = re.compile(r"\bannul[ée]")

# Bullet / list-item detection. Portal PDFs use a variety of glyphs, including
# Wingdings/Symbol bullets in the Unicode Private Use Area (e.g. U+F0A7) and the
# standard U+2022 bullet. A REQUIRED leading bullet keeps the collector strict
# so unbulleted footer/signature/header lines naturally end the list.
_BULLET_CHARS = "\u2022\u25AA\u25CF\u2023\u2043\uF0A7\uF0B7\uF06E\u2013\u2014-"
_BULLET_RE = re.compile("^[ \\t]*[" + re.escape(_BULLET_CHARS) + "][ \\t]*(.+?)[ \\t]*$")


def _lines(text: str) -> list[str]:
    return [ln for ln in (text or "").splitlines()]


def _collect_list_after(lines: list[str], start_idx: int) -> list[str]:
    """Collect the bulleted items following an anchor line, stopping at the next
    labelled section or a run of non-bullet lines. Returns raw item strings
    (which may be a single "N\u00e9ant"). Only genuine bullet lines are
    collected, so stray footer/signature text never leaks in."""
    items: list[str] = []
    blanks_since_item = 0
    for ln in lines[start_idx + 1:]:
        norm = _norm_line(ln)
        stripped = ln.strip()
        if not stripped:
            if items:
                blanks_since_item += 1
                if blanks_since_item >= 2:
                    break
            continue
        if _ANY_ANCHOR_RE.search(norm):
            break
        m = _BULLET_RE.match(ln)
        if m:
            blanks_since_item = 0
            items.append(m.group(1).strip())
        elif items:
            break
    return items
def _find_anchor(lines: list[str], patterns: list[str]) -> int:
    for i, ln in enumerate(lines):
        norm = _norm_line(ln)
        for pat in patterns:
            if re.search(pat, norm):
                return i
    return -1


def _is_neant(items: list[str]) -> bool:
    return len(items) == 0 or all(_NEANT_RE.match(it) for it in items)


def _dedup_names(items: list[str]) -> list[str]:
    seen, out = set(), []
    for it in items:
        name = normalize_company(it)
        if not name or _NEANT_RE.match(name):
            continue
        key = _strip_accents(name).lower()
        if key not in seen:
            seen.add(key)
            out.append(name)
    return out


# ── Header-field extraction ──────────────────────────────────────────────────
_REF_RE = re.compile(r"n[°ºo]\s*[:\-]?\s*([0-9][0-9A-Za-z/\-\.]*)", re.IGNORECASE)
_OBJET_RE = re.compile(r"objet\s*(?:de l['’]appel d['’]offres)?\s*[:\-]\s*(.+)", re.IGNORECASE)
_BUYER_RE = re.compile(r"(?:ma[iî]tre d['’]ouvrage|acheteur public)\s*[:\-]\s*(.+)", re.IGNORECASE)
_DATE_RE = re.compile(r"(\d{1,2})[/\-\s](\d{1,2})[/\-\s](\d{4})")


def _extract_reference(text: str, lines: list[str]) -> tuple[str | None, str | None]:
    """Prefer a reference on/near an APPEL D'OFFRES / PROCES VERBAL line."""
    for i, ln in enumerate(lines):
        norm = _norm_line(ln)
        if "appel d'offres" in norm or "proces" in norm or "proces-verbal" in norm:
            # Look on this line and the next two for the N° token.
            for cand in lines[i:i + 3]:
                m = _REF_RE.search(cand)
                if m:
                    q = _clean(cand)
                    return m.group(1).rstrip(".").strip(), q
    m = _REF_RE.search(text)
    if m:
        # quote the containing line
        for ln in lines:
            if m.group(1) in ln:
                return m.group(1).rstrip(".").strip(), _clean(ln)
        return m.group(1).rstrip(".").strip(), _clean(m.group(0))
    return None, None


def _extract_first(regex: re.Pattern, lines: list[str]) -> tuple[str | None, str | None]:
    for ln in lines:
        m = regex.search(_fix_mojibake(ln))
        if m:
            return _clean(m.group(1)), _clean(ln)
    return None, None


def _extract_published_at(lines: list[str]) -> tuple[str | None, str | None]:
    """Prefer the commission-completion date ("Date d'achèvement...") or the
    "Fait à ... le" date as the publication proxy."""
    for key in ("date d'achevement", "fait a", "le :"):
        for ln in lines:
            if key in _norm_line(ln):
                m = _DATE_RE.search(ln)
                if m:
                    d, mo, y = m.groups()
                    return f"{y}-{int(mo):02d}-{int(d):02d}", _clean(ln)
    return None, None


# ── Amount extraction ─────────────
# A well-formed Moroccan money token: an integer part with space/nbsp thousands
# groups and an optional ,/. decimal. Anchored shape (not a greedy "\d[\d .,]*\d")
# so it cannot merge an amount with a trailing percentage on the same line.
_SP = "[    ]"
_AMOUNT_TOKEN_RE = re.compile(
    r"\d{1,3}(?:" + _SP + r"\d{3})+(?:[.,]\d{1,2})?"   # 1 765 520,53
    r"|\d+[.,]\d{2}(?![.,\d])"                          # 26 976.00 / 150664.00
    r"|\d{4,}(?![.,\d%])"                                # 150664
)


def _amounts_in(line: str) -> list[tuple[float, str]]:
    """All well-formed money amounts on a line (value, raw token), skipping
    percentages and sub-100 stray integers."""
    out = []
    for m in _AMOUNT_TOKEN_RE.finditer(line):
        tok = m.group(0)
        tail = line[m.end(): m.end() + 2]
        if tail.strip().startswith("%"):
            continue
        val = normalize_amount(tok)
        if val is not None and val >= 100:
            out.append((val, tok))
    return out


def _amount_for_name(text: str, name: str) -> tuple[float | None, str | None]:
    """Find the bid amount associated with a company name.

    Looks on the name's own line first, then the next two lines (the "Montant
    des actes d'engagement" tables put the amount on the line after the name).
    Returns the first well-formed amount, or (None, None). Never fabricates.
    """
    if not name:
        return None, None
    key = _strip_accents(name).lower()
    lines = _fix_mojibake(text).splitlines()
    for i, ln in enumerate(lines):
        if key not in _strip_accents(ln).lower():
            continue
        for j in range(i, min(i + 3, len(lines))):
            amts = _amounts_in(lines[j])
            if amts:
                val, tok = amts[0]
                quote = _clean(f"{name}: {tok}") if j != i else _clean(lines[j])
                return val, quote[:160]
    return None, None
# ── Public API ───────────────────────────────────────────────────────────────
def parse_award_document(
    text: str,
    *,
    source_type: str = SOURCE_PV,
    source_url: str | None = None,
    document_url: str | None = None,
    method: str = "pdf_text",
    tender_reference: str | None = None,
    buyer: str | None = None,
    title: str | None = None,
) -> dict:
    """Extract award fields from award-document text.

    Parameters mirror the normalized output object. ``method`` is one of
    ``html`` | ``pdf_text`` | ``ocr`` | ``manual_sample`` and drives confidence:
    OCR text is capped at ``low``.

    Returns the normalized dict (see module docstring / extraction map).
    """
    raw = text or ""
    fixed = _fix_mojibake(raw)
    lines = _lines(fixed)
    evidence: list[dict] = []

    def add_ev(field, quote, source="pdf", page=None):
        if quote:
            evidence.append({
                "field": field,
                "quote": _clean(quote)[:200],
                "source": source,
                "page": page,
            })

    ev_src = "html" if method == "html" else "pdf"

    # ── Header fields (respect caller-provided overrides) ────────────────────
    ref, ref_q = _extract_reference(fixed, lines)
    if tender_reference is None:
        tender_reference = ref
        if ref:
            add_ev("tender_reference", ref_q, ev_src)

    if title is None:
        obj, obj_q = _extract_first(_OBJET_RE, lines)
        title = obj
        if obj:
            add_ev("title", obj_q, ev_src)

    if buyer is None:
        b, b_q = _extract_first(_BUYER_RE, lines)
        buyer = b
        if b:
            add_ev("buyer", b_q, ev_src)

    published_at, pub_q = _extract_published_at(lines)
    if published_at:
        add_ev("published_at", pub_q, ev_src)

    # ── Outcome detection (infructueux / cancelled) ──────────────────────────
    outcome = OUTCOME_AWARDED
    outcome_q = None
    for ln in lines:
        n = _norm_line(ln)
        if _INFRUCTUEUX_RE.search(n):
            outcome = OUTCOME_INFRUCTUEUX
            outcome_q = _clean(ln)
            break
        if _CANCELLED_RE.search(n) and ("commission" in n or "consultation" in n or "offres" in n):
            outcome = OUTCOME_CANCELLED
            outcome_q = _clean(ln)
            break

    # ── Lists ────────────────────────────────────────────────────────────────
    p_idx = _find_anchor(lines, _LIST_ANCHORS["participants"])
    participant_names: list[str] = []
    participants_evidence_q = None
    participants_count: int | None = None
    if p_idx >= 0:
        items = _collect_list_after(lines, p_idx)
        participants_evidence_q = _clean(lines[p_idx])
        if _is_neant(items):
            participants_count = 0
        else:
            participant_names = _dedup_names(items)
            participants_count = len(participant_names)
        add_ev("participants_count", participants_evidence_q, ev_src)

    r_idx = _find_anchor(lines, _LIST_ANCHORS["rejected"])
    rejected_names: list[str] = []
    if r_idx >= 0:
        items = _collect_list_after(lines, r_idx)
        if not _is_neant(items):
            rejected_names = _dedup_names(items)

    # ── Winner ────────────────────────────────────────────────────────────────
    winner_name: str | None = None
    awarded_amount: float | None = None
    winner_q = None
    lots: list[dict] = []

    if outcome == OUTCOME_AWARDED:
        w_idx = _find_anchor(lines, _LIST_ANCHORS["winner_list"])
        if w_idx >= 0:
            # The winner block may be a per-lot table (BKAM), a header+value pair
            # (MEM), or a single "retenu" line (AUEJ). Collect a generous window
            # and flatten it to one space-joined string so names wrapped across
            # PDF lines ("TROPICANA\nPLANTES") still match a known participant.
            # Bound the block: the "Concurrent retenu" section ends at the
            # justification / commission-completion line, so amounts collected
            # inside it are the retained (winning) amounts only.
            block_lines = lines[w_idx: w_idx + 45]
            for bi, bln in enumerate(block_lines[1:], start=1):
                bn = _norm_line(bln)
                if "justification" in bn or "date d'achevement" in bn or "fait a" in bn:
                    block_lines = block_lines[:bi]
                    break
            block = "\n".join(block_lines)
            block_flat = _clean(_fix_mojibake(block.replace("\n", " ")))
            block_flat_norm = _strip_accents(block_flat).lower()
            winner_q = _clean(lines[w_idx])

            # Authoritative winner identity: a *known participant* whose name
            # appears in the winner block. This never mistakes a table-header
            # word ("Montant", "retenue") for a company.
            named_in_block = [
                n for n in participant_names
                if _strip_accents(n).lower() in block_flat_norm
            ]

            # Multi-lot: one attributaire whose name repeats across lot rows.
            is_multi_lot = (
                len(named_in_block) == 1
                and block_flat_norm.count(_strip_accents(named_in_block[0]).lower()) >= 2
            )

            if is_multi_lot:
                winner_name = named_in_block[0]
                # Collect distinct retained amounts inside the bounded block, in
                # document order (one per lot). De-dup consecutive repeats.
                amounts: list[float] = []
                for bln in block_lines:
                    for val, _tok in _amounts_in(bln):
                        if not amounts or amounts[-1] != val:
                            amounts.append(val)
                for i, amt in enumerate(amounts, start=1):
                    lots.append({
                        "lot": str(i),
                        "winner_name": winner_name,
                        "awarded_amount": amt,
                        "awarded_amount_currency": "MAD",
                    })
                add_ev("winner_name", winner_q, ev_src)
                if lots:
                    add_ev(
                        "lots",
                        f"{winner_name} — {len(lots)} lot(s): "
                        + ", ".join(str(l["awarded_amount"]) for l in lots),
                        ev_src,
                    )
            elif named_in_block:
                winner_name = named_in_block[0]
                add_ev("winner_name", winner_q, ev_src)
                amt, amt_q = _amount_for_name(block, winner_name)
                if amt is not None:
                    awarded_amount = amt
                    add_ev("awarded_amount", amt_q, ev_src)
            else:
                # No participant list to anchor against (e.g. a bare Résultat
                # définitif where the winner name lives only in the retenu block,
                # possibly OCR-garbled). Take the first plausible company-looking
                # line after the label; skip header / label / numeric lines.
                # Header/label words that must never be emitted as a winner name.
                _STOP = re.compile(
                    r"^(retenue?|definitif|resultat|montant|offre|attributaire|"
                    r"soumissionnaire|concurrent|lot)\b"
                )
                for ln in block_lines[1:8]:
                    cand = _clean(_fix_mojibake(ln))
                    if not cand or _ANY_ANCHOR_RE.search(_norm_line(ln)):
                        continue
                    low = _norm_line(ln)
                    if re.search(r"montant|soumissionnaire|concurrent|acte d|date|"
                                 r"d'engagement|majoration|lot n", low):
                        continue
                    if _STOP.match(low):
                        continue
                    # Skip date lines ("Le 15/04/2021", "à 11h00"), amount lines
                    # ("150 664,00 DH TTC") and lines that are mostly digits.
                    if _DATE_RE.search(cand) or re.match(r"^(le|a|à)\b", low):
                        continue
                    if _amounts_in(cand):
                        continue
                    letters = sum(c.isalpha() for c in _strip_accents(cand))
                    if letters < 4:
                        continue
                    winner_name = normalize_company(cand)
                    add_ev("winner_name", cand, ev_src)
                    break
                # If the winner name is only present garbled/unreadable (OCR case
                # for a bare Résultat définitif), leave it None and note why, but
                # a clean amount can still be captured below.
                if winner_name is None:
                    add_ev(
                        "winner_name",
                        "winner named in document but not reliably extractable from text "
                        "(likely OCR-only glyphs); left null on purpose",
                        ev_src,
                    )

        # Dedicated "Montant de l'offre retenue" line (MEM / Résultat définitif).
        if awarded_amount is None:
            for ln in lines:
                if "montant de l'offre retenue" in _norm_line(ln):
                    # amount may be on this or a following line
                    for cand in [ln] + lines[lines.index(ln) + 1: lines.index(ln) + 6]:
                        v = normalize_amount(cand)
                        if v is not None and v >= 100:
                            awarded_amount = v
                            add_ev("awarded_amount", _clean(cand), ev_src)
                            break
                    break
            # Generic: a standalone "... DH TTC" amount line near a retenu context.
            if awarded_amount is None:
                for ln in lines:
                    if re.search(r"\bDH\b|\bMAD\b|\bTTC\b", ln, re.IGNORECASE):
                        v = normalize_amount(ln)
                        if v is not None and v >= 100:
                            awarded_amount = v
                            add_ev("awarded_amount", _clean(ln), ev_src)
                            break

    # ── Build participants[] with statuses ───────────────────────────────────
    participants: list[dict] = []
    winner_key = _strip_accents(winner_name).lower() if winner_name else None
    rejected_keys = {_strip_accents(n).lower() for n in rejected_names}
    lot_winner_keys = {
        _strip_accents(l["winner_name"]).lower()
        for l in lots if l.get("winner_name")
    }
    for name in participant_names:
        key = _strip_accents(name).lower()
        amt, _ = _amount_for_name(fixed, name)
        if key == winner_key or key in lot_winner_keys:
            status = ST_WINNER
        elif key in rejected_keys:
            status = ST_REJECTED
        else:
            status = ST_NOT_RETAINED
        participants.append({"name": name, "bid_amount": amt, "status": status})
    # Rejected companies not present in the participants list (listed only as évincés).
    for name in rejected_names:
        key = _strip_accents(name).lower()
        if all(_strip_accents(p["name"]).lower() != key for p in participants):
            participants.append({"name": name, "bid_amount": None, "status": ST_REJECTED})

    # ── Counts ────────────────────────────────────────────────────────────────
    winner_count = 0
    if winner_name:
        winner_count = 1
    elif lot_winner_keys:
        winner_count = len(lot_winner_keys)

    losers_count: int | None = None
    if participants_count is not None and (winner_name or lots):
        # losers = participants - winners, only when both are known.
        if lots:
            # multi-lot: not a single scalar; leave None and expose per-lot data.
            losers_count = None
        elif winner_count and participants_count >= winner_count:
            losers_count = participants_count - winner_count

    rejected_count = len(rejected_names) if r_idx >= 0 else None

    # ── Confidence ────────────────────────────────────────────────────────────
    if method == "ocr":
        confidence = "low"
    elif outcome != OUTCOME_AWARDED:
        confidence = "high" if outcome_q else "medium"
    else:
        have_winner = bool(winner_name or lots)
        have_amount = awarded_amount is not None or any(
            l.get("awarded_amount") is not None for l in lots
        )
        if have_winner and have_amount:
            confidence = "high"
        elif have_winner or have_amount:
            confidence = "medium"
        else:
            confidence = "low"

    result = {
        "source_type": source_type,
        "source_url": source_url,
        "document_url": document_url,
        "tender_reference": tender_reference,
        "buyer": buyer,
        "title": title,
        "published_at": published_at,
        "outcome": outcome,
        "winner_name": winner_name,
        "winner_ice": None,   # ICE almost never present in these documents; see map
        "awarded_amount": awarded_amount,
        "awarded_amount_currency": "MAD",
        "participants_count": participants_count,
        "winner_count": winner_count,
        "losers_count": losers_count,
        "rejected_count": rejected_count,
        "participants": participants,
        "lots": lots,
        "extraction": {
            "method": method,
            "confidence": confidence,
            "extracted_at": datetime.now(timezone.utc).isoformat(),
            "evidence": evidence,
        },
    }
    if outcome_q:
        add_ev("outcome", outcome_q, ev_src)
    return result
