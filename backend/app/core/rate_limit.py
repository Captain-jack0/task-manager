"""Shared rate limiter (slowapi). Disabled under the test environment so the
suite isn't throttled."""
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import get_settings

limiter = Limiter(
    key_func=get_remote_address,
    # Generous per-IP ceiling on every endpoint (stricter per-route limits still
    # apply on top) so authenticated CRUD floods can't hammer the DB unbounded.
    default_limits=["600/minute"],
    enabled=get_settings().environment != "test",
)
