"""Transactional email templates for auth events (verify email, password reset).

Renders both HTML and plain text. The transport stays
`send_email(config, to, subject, html, text)` in emailer.py. Style mirrors the
digest/confirmation emails (Georgia serif, navy-red accent) for a consistent
brand. No tracking pixels, no remote images — plain-text fallback carries the
full URL.
"""

import os

BRAND = "Marches Publics Maroc"
ACCENT = "#a51c30"


def _frontend() -> str:
    return os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")


def _base_html(intro: str, button_label: str, url: str, note: str, footer: str) -> str:
    return (
        '<div style="font-family:Georgia,serif;background:#faf7f0;padding:24px;color:#2b2b2b;">'
        f'<h1 style="font-size:20px;border-bottom:2px solid {ACCENT};padding-bottom:8px;">{BRAND}</h1>'
        f'<p style="font-size:14px;">{intro}</p>'
        f'<p style="margin:20px 0;"><a href="{url}" '
        f'style="background:{ACCENT};color:#ffffff;text-decoration:none;padding:10px 18px;'
        f'border-radius:4px;font-size:14px;display:inline-block;">{button_label}</a></p>'
        f'<p style="font-size:13px;color:#5b5b52;">{note}</p>'
        '<p style="font-size:12px;color:#5b5b52;margin-top:24px;word-break:break-all;">'
        f'Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>{url}</p>'
        f'<p style="font-size:12px;color:#5b5b52;margin-top:16px;">{footer}</p></div>'
    )


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
