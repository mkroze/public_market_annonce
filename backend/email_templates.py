"""Transactional email templates for auth events (verify email, password reset).

Renders both HTML and plain text. The transport stays
`send_email(config, to, subject, html, text)` in emailer.py. All visual styling
comes from `brand.py`, the single source of truth that mirrors the frontend
design system (navy primary, amber accent, Inter/system-sans). No tracking
pixels, no remote images — the plain-text fallback carries the full URL.
"""

import os

import brand

BRAND = brand.BRAND_NAME


def _frontend() -> str:
    return os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")


def _base_html(intro: str, button_label: str, url: str, note: str, footer: str) -> str:
    body = (
        brand.paragraph(intro)
        + brand.button(button_label, url)
        + brand.paragraph(note, color=brand.MUTED, size=13)
        + brand.fallback_link(url)
    )
    return brand.shell(body, footer, preheader=intro)


def render_verify_email(token: str) -> tuple[str, str, str]:
    url = f"{_frontend()}/verify-email?token={token}"
    subject = "Confirmez votre email - Marches Publics Maroc"
    intro = "Bienvenue. Confirmez votre adresse email pour securiser votre compte."
    note = "Ce lien expire dans 24 heures."
    footer = "Vous recevez cet email car un compte a ete cree avec cette adresse."
    html = _base_html(intro, "Confirmer mon email", url, note, footer)
    text = (
        f"Bienvenue sur {BRAND}.\n\n"
        f"Confirmez votre adresse email : {url}\n\n"
        "Ce lien expire dans 24 heures.\n"
        "Vous recevez cet email car un compte a ete cree avec cette adresse."
    )
    return subject, html, text


def render_password_reset(token: str) -> tuple[str, str, str]:
    url = f"{_frontend()}/reset-password?token={token}"
    subject = "Reinitialisation de votre mot de passe"
    intro = "Vous avez demande la reinitialisation de votre mot de passe."
    note = (
        "Ce lien expire dans 60 minutes. Ignorez cet email si vous n'etes pas "
        "a l'origine de la demande."
    )
    footer = "Vous recevez cet email suite a une demande de reinitialisation de mot de passe."
    html = _base_html(intro, "Reinitialiser mon mot de passe", url, note, footer)
    text = (
        "Vous avez demande la reinitialisation de votre mot de passe.\n\n"
        f"Reinitialiser votre mot de passe : {url}\n\n"
        "Ce lien expire dans 60 minutes. Ignorez cet email si vous n'etes pas "
        "a l'origine de la demande."
    )
    return subject, html, text
