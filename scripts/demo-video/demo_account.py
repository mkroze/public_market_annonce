"""Local demo account used to record the landing-page product video.

Development-only: it targets the local backend (127.0.0.1:8000) and the local
SQLite file. The account is fictional (no real person or company) so nothing
personal ends up in the recording.
"""

import json
import sqlite3
import urllib.error
import urllib.request
from pathlib import Path

API = "http://127.0.0.1:8000"
DB_PATH = Path(__file__).resolve().parents[2] / "backend" / "data" / "tenders.db"

EMAIL = "demo@mp-maroc.test"
PASSWORD = "demo-local-only-2026"  # local test value, never a real credential
NAME = "Atlas Travaux"
COMPANY = "Atlas Travaux SARL"


def _post(path: str, body: dict) -> tuple[int, dict]:
    request = urllib.request.Request(
        API + path, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(request) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, {}


def ensure_demo_account() -> dict:
    """Create the demo account if needed, mark its e-mail verified (so the
    verification banner stays out of the recording), and return {token, user}."""
    status, session = _post("/api/auth/login", {"email": EMAIL, "password": PASSWORD})
    if status != 200:
        status, session = _post(
            "/api/auth/register",
            {"email": EMAIL, "password": PASSWORD, "name": NAME, "company": COMPANY},
        )
        if status != 200:
            raise RuntimeError(f"Could not create the demo account (HTTP {status}). Is the backend running?")

    db = sqlite3.connect(DB_PATH)
    try:
        db.execute(
            "UPDATE users SET email_verified_at = COALESCE(email_verified_at, datetime('now')) WHERE email = ?",
            (EMAIL,),
        )
        # A clean slate for the "follow" beat of the scenario.
        db.execute("DELETE FROM favorites WHERE user_id = (SELECT id FROM users WHERE email = ?)", (EMAIL,))
        db.commit()
    finally:
        db.close()

    status, session = _post("/api/auth/login", {"email": EMAIL, "password": PASSWORD})
    if status != 200:
        raise RuntimeError("Demo account login failed.")
    return session
