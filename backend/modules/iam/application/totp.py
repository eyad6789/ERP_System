"""Pure RFC 6238 TOTP implementation (no third-party dependency).

Uses the standard authenticator defaults: 30-second step, SHA1, 6 digits.
Secrets are base32-encoded strings (the form shown in otpauth URIs / QR codes).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import struct
import time

STEP_SECONDS = 30
DIGITS = 6


def _hotp(secret: str, counter: int) -> str:
    """Compute the HOTP value for a base32 `secret` and integer `counter`."""
    key = base64.b32decode(_normalize(secret), casefold=True)
    msg = struct.pack(">Q", counter)
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    truncated = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(truncated % (10**DIGITS)).zfill(DIGITS)


def _normalize(secret: str) -> str:
    """Strip whitespace and pad to a valid base32 length (multiple of 8)."""
    cleaned = secret.strip().replace(" ", "").upper()
    padding = (-len(cleaned)) % 8
    return cleaned + ("=" * padding)


def totp_now(secret: str, *, at: int | None = None) -> str:
    """Return the current 6-digit TOTP for `secret` (RFC 6238)."""
    now = int(time.time()) if at is None else at
    return _hotp(secret, now // STEP_SECONDS)


def verify(secret: str, code: str, *, window: int = 1, at: int | None = None) -> bool:
    """True iff `code` matches the TOTP within +/- `window` time steps."""
    if not secret or not code:
        return False
    candidate = code.strip()
    now = int(time.time()) if at is None else at
    counter = now // STEP_SECONDS
    try:
        for drift in range(-window, window + 1):
            if hmac.compare_digest(_hotp(secret, counter + drift), candidate):
                return True
    except (ValueError, TypeError):
        return False
    return False
