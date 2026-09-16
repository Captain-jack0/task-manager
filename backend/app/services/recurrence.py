"""Recurring tasks: when a task with a rule is closed, the next occurrence is
created as a fresh task. The closed one stays as history."""
import calendar
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Recurrence, Task, TaskStatus


def next_due(base: datetime, rule: Recurrence) -> datetime:
    """The occurrence after `base`. Monthly keeps the day, clamped to the month's length."""
    if rule == Recurrence.DAILY:
        return base + timedelta(days=1)
    if rule == Recurrence.WEEKLY:
        return base + timedelta(weeks=1)
    if rule == Recurrence.BIWEEKLY:
        return base + timedelta(weeks=2)
    year, month = (base.year + 1, 1) if base.month == 12 else (base.year, base.month + 1)
    day = min(base.day, calendar.monthrange(year, month)[1])
    return base.replace(year=year, month=month, day=day)


async def spawn_next(session: AsyncSession, closed: Task) -> Task:
    """Queue the next occurrence of `closed` (does not commit).

    Copies the descriptive fields and tags; goes to the backlog and drops the
    parent, since sprints and parents are about a specific iteration.
    """
    assert closed.recurrence is not None
    base = closed.due_date or datetime.now(UTC)
    nxt = Task(
        user_id=closed.user_id,
        workspace_id=closed.workspace_id,
        title=closed.title,
        description=closed.description,
        status=TaskStatus.TODO,
        priority=closed.priority,
        due_date=next_due(base, closed.recurrence),
        estimated_minutes=closed.estimated_minutes,
        energy_level=closed.energy_level,
        project_id=closed.project_id,
        assignee_id=closed.assignee_id,
        recurrence=closed.recurrence,
    )
    nxt.tags = list(closed.tags)
    session.add(nxt)
    return nxt
