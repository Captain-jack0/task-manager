import logging
import smtplib
from email.message import EmailMessage

import pytest

from app.config import get_settings
from app.services import mailer

LINK = "http://x/reset-password?token=abc"


def test_without_smtp_host_logs_link(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setattr(get_settings(), "smtp_host", "")
    with caplog.at_level(logging.WARNING, logger="app.services.mailer"):
        mailer.send_password_reset("a@example.com", LINK)
    assert LINK in caplog.text


def test_production_without_smtp_never_logs_link(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "smtp_host", "")
    monkeypatch.setattr(settings, "environment", "production")
    with caplog.at_level(logging.WARNING, logger="app.services.mailer"):
        mailer.send_password_reset("a@example.com", LINK)
    assert LINK not in caplog.text
    assert "NOT sent" in caplog.text


def test_sends_via_smtp(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "smtp_host", "smtp.example.com")
    monkeypatch.setattr(settings, "smtp_user", "u")
    monkeypatch.setattr(settings, "smtp_password", "p")
    monkeypatch.setattr(settings, "smtp_from", "noreply@example.com")
    calls: list[object] = []

    class FakeSMTP:
        def __init__(self, host: str, port: int, timeout: int) -> None:
            calls.append(("connect", host, port))

        def __enter__(self) -> "FakeSMTP":
            return self

        def __exit__(self, *exc: object) -> bool:
            return False

        def starttls(self) -> None:
            calls.append("starttls")

        def login(self, user: str, password: str) -> None:
            calls.append(("login", user, password))

        def send_message(self, msg: EmailMessage) -> None:
            calls.append(("send", msg["To"], msg["From"], msg.get_content()))

    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)
    mailer.send_password_reset("a@example.com", LINK)

    assert calls[:3] == [("connect", "smtp.example.com", 587), "starttls", ("login", "u", "p")]
    kind, to, sender, body = calls[3]  # type: ignore[misc]
    assert (kind, to, sender) == ("send", "a@example.com", "noreply@example.com")
    assert LINK in body


def test_smtp_failure_is_logged_not_raised(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setattr(get_settings(), "smtp_host", "smtp.example.com")

    def boom(*_: object, **__: object) -> None:
        raise smtplib.SMTPException("down")

    monkeypatch.setattr(smtplib, "SMTP", boom)
    with caplog.at_level(logging.ERROR, logger="app.services.mailer"):
        mailer.send_password_reset("a@example.com", LINK)
    assert "Failed to send" in caplog.text
