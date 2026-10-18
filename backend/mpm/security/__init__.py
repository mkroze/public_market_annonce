"""Credential minting and verification: session tokens, one-time email tokens,
and the HMAC-signed DCE fetch tokens handed to the OCR box.

Stateless by design — `tokens` receives a connection from its caller rather than
opening one, so this package never imports `db`.
"""
