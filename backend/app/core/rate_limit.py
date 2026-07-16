"""Shared rate limiter (slowapi). Disabled under the test environment so the
suite isn't throttled."""
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import get_settings

limiter = Limiter(
    key_func=get_remote_address,
    enabled=get_settings().environment != "test",
)
