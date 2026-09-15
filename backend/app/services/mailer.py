"""Outgoing mail via stdlib smtplib.

No SMTP_HOST configured → nothing is sent. In local dev the password-reset
link is logged so it can be copied out; other mail is only logged by subject.
"""
import logging
import smtplib
from email.message import EmailMessage

from app.config import get_settings

logger = logging.getLogger(__name__)


def _deliver(to: str, subject: str, body: str) -> None:
    settings = get_settings()
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from or settings.smtp_user
    msg["To"] = to
    msg.set_content(body)
    # ponytail: STARTTLS on 587 only; add SMTP_SSL if a 465-only provider shows up.
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
            smtp.starttls()
            if settings.smtp_user:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)
    except (smtplib.SMTPException, OSError):
        logger.exception("Failed to send email %r to %s", subject, to)


def send_password_reset(to: str, link: str) -> None:
    settings = get_settings()
    if not settings.smtp_host:
        # The link is a bearer credential, so it only ever goes to a dev log.
        if settings.environment == "production":
            logger.error("SMTP not configured — password reset email to %s NOT sent", to)
        else:
            logger.warning("SMTP not configured — password reset link for %s: %s", to, link)
        return
    _deliver(
        to,
        "Reset your password",
        "Someone (hopefully you) asked to reset the password for this account.\n\n"
        f"Choose a new password here (the link expires in 30 minutes):\n{link}\n\n"
        "If you didn't ask for this, you can ignore this email.",
    )


def send_notification(to: str, subject: str, body: str) -> None:
    """Plain-text notification (assignment, mention). Silently skipped without SMTP."""
    if not get_settings().smtp_host:
        logger.info("SMTP not configured — notification %r to %s not sent", subject, to)
        return
    _deliver(to, subject, body)
