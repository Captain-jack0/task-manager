import hashlib
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import bcrypt
from jose import JWTError, jwt

from app.config import get_settings

# bcrypt enforces a 72-byte input limit; truncate longer passwords deterministically.
_MAX_BCRYPT_BYTES = 72
_RESET_TOKEN_MINUTES = 30


def _truncate(password: str) -> bytes:
    return password.encode("utf-8")[:_MAX_BCRYPT_BYTES]


def hash_password(plain: str) -> str:
    hashed = bcrypt.hashpw(_truncate(plain), bcrypt.gensalt(rounds=12))
    return hashed.decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_truncate(plain), hashed.encode("utf-8"))
    except ValueError:
        return False


def _encode(claims: dict[str, Any], expires_minutes: int) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {**claims, "iat": now, "exp": now + timedelta(minutes=expires_minutes)}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _decode(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise ValueError("Invalid or expired token") from exc


def create_access_token(subject: UUID | str, expires_minutes: int | None = None) -> str:
    return _encode({"sub": str(subject)}, expires_minutes or get_settings().jwt_expire_minutes)


def decode_access_token(token: str) -> dict[str, Any]:
    payload = _decode(token)
    # Reset tokens carry a `type` claim; they must never pass as a login.
    if payload.get("type", "access") != "access":
        raise ValueError("Invalid token type")
    return payload


def password_fingerprint(password_hash: str) -> str:
    return hashlib.sha256(password_hash.encode("utf-8")).hexdigest()[:16]


def create_password_reset_token(user_id: UUID, password_hash: str) -> str:
    """Short-lived and single-use with no DB state: the token is bound to the
    current password hash, so it stops matching the moment the password changes."""
    claims = {
        "sub": str(user_id),
        "type": "password_reset",
        "pwf": password_fingerprint(password_hash),
    }
    return _encode(claims, _RESET_TOKEN_MINUTES)


def decode_password_reset_token(token: str) -> dict[str, Any]:
    payload = _decode(token)
    if payload.get("type") != "password_reset":
        raise ValueError("Invalid token type")
    return payload
