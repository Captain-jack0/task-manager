"""iCalendar (RFC 5545) serialization for the read-only task feed.

Pure functions, no I/O — the feed endpoint hands in already-loaded tasks plus a
timestamp, and gets back a VCALENDAR string. Kept dependency-free (hand-rolled
serializer) so escaping and line-folding stay explicit and unit-tested.
"""
from collections.abc import Iterable
from datetime import UTC, datetime, timedelta

from app.models.task import Task, TaskPriority, TaskStatus

# Tasks with no estimate get a nominal block so the calendar event has width.
_DEFAULT_MINUTES = 30
_PRODID = "-//Momentum//Task Calendar//EN"

# RFC 5545 §3.4: content lines are limited to 75 octets; longer lines are folded
# with CRLF + a single leading space.
_MAX_OCTETS = 75

_PRIORITY_MAP: dict[TaskPriority, int] = {
    TaskPriority.HIGH: 1,
    TaskPriority.MEDIUM: 5,
    TaskPriority.LOW: 9,
}


def _escape(value: str) -> str:
    """Escape a TEXT value per RFC 5545 §3.3.11 (order matters: backslash first)."""
    return (
        value.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\r\n", "\\n")
        .replace("\n", "\\n")
        .replace("\r", "\\n")
    )


def _fold(line: str) -> str:
    """Fold a content line at 75 octets without splitting a UTF-8 codepoint."""
    if len(line.encode("utf-8")) <= _MAX_OCTETS:
        return line
    segments: list[str] = []
    current = ""
    current_octets = 0
    for ch in line:
        ch_octets = len(ch.encode("utf-8"))
        # Continuation lines carry a leading space, so their content cap is one less.
        cap = _MAX_OCTETS if not segments else _MAX_OCTETS - 1
        if current_octets + ch_octets > cap:
            segments.append(current)
            current = ch
            current_octets = ch_octets
        else:
            current += ch
            current_octets += ch_octets
    segments.append(current)
    return "\r\n ".join(segments)


def _utc(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")


def _status(task: Task) -> str:
    if task.status == TaskStatus.DONE:
        return "COMPLETED"
    if task.status == TaskStatus.CLOSED:
        return "CANCELLED"
    return "CONFIRMED"


def _event_lines(task: Task, *, now: datetime, app_url: str) -> list[str]:
    # Caller filters these out; explicit guard (not assert, which -O strips).
    if task.due_date is None:
        return []
    start = task.due_date
    duration = timedelta(minutes=task.estimated_minutes or _DEFAULT_MINUTES)
    end = start + duration

    detail = f"Priority: {task.priority.value} · Status: {task.status.value}"
    if app_url:
        detail += f"\nOpen: {app_url.rstrip('/')}/tasks/{task.id}"

    lines = [
        "BEGIN:VEVENT",
        f"UID:task-{task.id}@momentum",
        f"DTSTAMP:{_utc(now)}",
        f"DTSTART:{_utc(start)}",
        f"DTEND:{_utc(end)}",
        f"SUMMARY:{_escape(task.title)}",
        f"DESCRIPTION:{_escape(detail)}",
        f"STATUS:{_status(task)}",
        f"PRIORITY:{_PRIORITY_MAP.get(task.priority, 5)}",
    ]
    if app_url:
        lines.append(f"URL:{app_url.rstrip('/')}/tasks/{task.id}")
    lines.append("END:VEVENT")
    return lines


def build_calendar(
    tasks: Iterable[Task],
    *,
    now: datetime,
    app_url: str = "",
    calendar_name: str = "Momentum tasks",
) -> str:
    """Render tasks with a due date as a VCALENDAR string (CRLF-terminated)."""
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        f"PRODID:{_PRODID}",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{_escape(calendar_name)}",
        f"NAME:{_escape(calendar_name)}",
        "X-WR-TIMEZONE:UTC",
    ]
    for task in tasks:
        if task.due_date is None:
            continue
        lines.extend(_event_lines(task, now=now, app_url=app_url))
    lines.append("END:VCALENDAR")
    return "".join(f"{_fold(line)}\r\n" for line in lines)
