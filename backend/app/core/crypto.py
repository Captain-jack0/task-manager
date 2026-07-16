"""Symmetric encryption for third-party secrets stored at rest.

A valid Fernet key is derived (SHA-256) from `app_encryption_key`, so that
setting can be any string. Used so tokens like the GitHub PAT are never stored
in plaintext — a database leak alone does not expose them.
"""
import base64
import hashlib

from cryptography.fernet import Fernet

from app.config import get_settings


def _fernet() -> Fernet:
    secret = get_settings().app_encryption_key
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest())
    return Fernet(key)


def encrypt_secret(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt_secret(ciphertext: str) -> str:
    return _fernet().decrypt(ciphertext.encode()).decode()
