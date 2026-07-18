"""Unit tests for the iCal serializer (pure functions, no DB)."""
from datetime import UTC, datetime
from uuid import UUID

from app.models.task import Task, TaskPriority, TaskStatus
from app.services import ics

NOW = datetime(2026, 7, 16, 9, 0, tzinfo=UTC)
DUE = datetime(2026, 7, 20, 14, 30, tzinfo=UTC)
TASK_ID = UUID("11111111-1111-1111-1111-111111111111")


def _task(**kw) -> Task:
    defaults = {
        "id": TASK_ID,
        "title": "Ship it",
        "status": TaskStatus.TODO,
        "priority": TaskPriority.MEDIUM,
        "estimated_minutes": None,
        "due_date": DUE,
    }
    defaults.update(kw)
    return Task(**defaults)


def test_wraps_events_in_a_valid_vcalendar() -> None:
    out = ics.build_calendar([_task()], now=NOW)
    assert out.startswith("BEGIN:VCALENDAR\r\n")
    assert out.rstrip().endswith("END:VCALENDAR")
    assert "VERSION:2.0\r\n" in out
    assert out.count("BEGIN:VEVENT") == 1
    assert "\r\n" in out and "\n\n" not in out  # CRLF line endings


def test_tasks_without_due_date_are_skipped() -> None:
    out = ics.build_calendar([_task(due_date=None)], now=NOW)
    assert "BEGIN:VEVENT" not in out


def test_uid_is_stable_per_task() -> None:
    out = ics.build_calendar([_task()], now=NOW)
    assert f"UID:task-{TASK_ID}@momentum" in out


def test_dtend_uses_estimate_else_default() -> None:
    out = ics.build_calendar([_task(estimated_minutes=None)], now=NOW)
    assert "DTSTART:20260720T143000Z" in out
    assert "DTEND:20260720T150000Z" in out  # +30m default

    out2 = ics.build_calendar([_task(estimated_minutes=90)], now=NOW)
    assert "DTEND:20260720T160000Z" in out2  # +90m


def test_status_and_priority_mapping() -> None:
    done = ics.build_calendar([_task(status=TaskStatus.DONE, priority=TaskPriority.HIGH)], now=NOW)
    assert "STATUS:COMPLETED" in done
    assert "PRIORITY:1" in done

    closed = ics.build_calendar([_task(status=TaskStatus.CLOSED, priority=TaskPriority.LOW)], now=NOW)
    assert "STATUS:CANCELLED" in closed
    assert "PRIORITY:9" in closed


def test_special_characters_are_escaped() -> None:
    out = ics.build_calendar([_task(title="Fix A, B; C\\D")], now=NOW)
    assert "SUMMARY:Fix A\\, B\\; C\\\\D" in out


def test_url_is_included_when_app_url_given() -> None:
    out = ics.build_calendar([_task()], now=NOW, app_url="https://app.example.com/")
    assert f"URL:https://app.example.com/tasks/{TASK_ID}" in out


def test_long_summary_is_folded_to_75_octets() -> None:
    out = ics.build_calendar([_task(title="x" * 200)], now=NOW)
    for line in out.split("\r\n"):
        # Continuation lines start with a space; every physical line stays <= 75 octets.
        assert len(line.encode("utf-8")) <= 75


def test_folding_preserves_multibyte_characters() -> None:
    # Turkish characters are multi-byte in UTF-8; folding must not split them.
    out = ics.build_calendar([_task(title="ş" * 100)], now=NOW)
    unfolded = out.replace("\r\n ", "")
    assert "SUMMARY:" + "ş" * 100 in unfolded
