"""Stateless HMAC-signed, short-lived tokens authorizing the OCR box to fetch
one tender's cached DCE ZIP. No DB state: the token carries its own expiry and
is bound to the tender_id by the signature."""

import hashlib
import hmac
import time

import config


def _sign(tender_id: str, expiry: int) -> str:
    msg = f"{tender_id}.{expiry}".encode("utf-8")
    key = config.DCE_EXTRACTION_SECRET.encode("utf-8")
    return hmac.new(key, msg, hashlib.sha256).hexdigest()


def sign_zip_token(tender_id: str, now: int | None = None) -> str:
    now = int(time.time()) if now is None else now
    expiry = now + config.DCE_EXTRACT_SIGNING_TTL
    return f"{expiry}.{_sign(tender_id, expiry)}"


def verify_zip_token(tender_id: str, token: str, now: int | None = None) -> bool:
    now = int(time.time()) if now is None else now
    if not config.DCE_EXTRACTION_SECRET or not token or "." not in token:
        return False
    expiry_str, sig = token.split(".", 1)
    try:
        expiry = int(expiry_str)
    except ValueError:
        return False
    if now > expiry:
        return False
    return hmac.compare_digest(sig, _sign(tender_id, expiry))
