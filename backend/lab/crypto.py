"""Field-level encryption for respondents' e-mail addresses and typed survey answers.

LAB_ENCRYPTION_KEYS: comma-separated Fernet keys, newest first (MultiFernet: encrypt with the first, decrypt with any,
so keys can be rotated). Production refuses to start without one (config/settings.py); for local development only, a
key is derived from SECRET_KEY. The dedupe hash is an HMAC with a separate derived key, so the stored hash can't be
reversed by hashing guessed addresses without the server secret.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


def _derive(label: str) -> bytes:
    return hashlib.sha256(f"{label}|{settings.SECRET_KEY}".encode()).digest()


@lru_cache(maxsize=4)
def _fernet(keys: tuple[str, ...], secret: str) -> MultiFernet:
    if keys:
        return MultiFernet([Fernet(k.encode()) for k in keys])
    if not settings.DEBUG:
        # Never encrypt real people's emails with a key derived from SECRET_KEY (settings refuse this too).
        raise ImproperlyConfigured("LAB_ENCRYPTION_KEYS is empty.")
    return MultiFernet([Fernet(base64.urlsafe_b64encode(_derive("lab-dev-encryption")))])


def _box() -> MultiFernet:
    return _fernet(tuple(k.strip() for k in settings.LAB_ENCRYPTION_KEYS if k.strip()), settings.SECRET_KEY)


def normalize(email: str) -> str:
    return email.strip().lower()


def encrypt(email: str) -> str:
    return _box().encrypt(normalize(email).encode()).decode()


def encrypt_text(text: str) -> str:
    """Anything a respondent typed (survey answers), kept exactly as written."""
    return _box().encrypt(text.encode()).decode()


def decrypt(token: str) -> str | None:
    try:
        return _box().decrypt(token.encode()).decode()
    except (InvalidToken, ValueError):
        return None  # key removed or data damaged: shown as unavailable, never guessed


def email_hash(email: str) -> str:
    key = (settings.LAB_HASH_KEY or "").encode() or _derive("lab-email-hash")
    return hmac.new(key, normalize(email).encode(), hashlib.sha256).hexdigest()
