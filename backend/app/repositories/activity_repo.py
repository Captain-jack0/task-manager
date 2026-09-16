from collections.abc import Sequence
from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task_event import TaskEvent
from app.models.user import User

# Task columns whose changes are written to the log.
TRACKED_FIELDS = (
    "status",
    "priority",
    "assignee_id",
    "sprint_id",
    "project_id",
    "due_date",
    "parent_id",
    "recurrence",
)


def as_text(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, Enum):
        return str(value.value)
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)[:200]


async def record(
    session: AsyncSession,
    *,
    task_id: UUID,
    actor_id: UUID | None,
    field: str,
    old_value: Any = None,
    new_value: Any = None,
) -> TaskEvent:
    """Queue one event in the current transaction (the caller commits)."""
    event = TaskEvent(
        task_id=task_id,
        actor_id=actor_id,
        field=field,
        old_value=as_text(old_value),
        new_value=as_text(new_value),
    )
    session.add(event)
    return event


async def record_changes(
    session: AsyncSession, *, task: Any, before: dict[str, Any], actor_id: UUID | None
) -> None:
    """Compare `before` (a TRACKED_FIELDS snapshot) with the task and log every difference."""
    for field in TRACKED_FIELDS:
        old, new = before.get(field), getattr(task, field)
        if old != new:
            await record(
                session, task_id=task.id, actor_id=actor_id, field=field, old_value=old, new_value=new
            )


def snapshot(task: Any) -> dict[str, Any]:
    return {field: getattr(task, field) for field in TRACKED_FIELDS}


async def list_for_task(
    session: AsyncSession, *, task_id: UUID, limit: int = 200
) -> Sequence[tuple[TaskEvent, str | None, str | None]]:
    """Events newest first, with the actor's email and name (None for system events)."""
    result = await session.execute(
        select(TaskEvent, User.email, User.full_name)
        .outerjoin(User, User.id == TaskEvent.actor_id)
        .where(TaskEvent.task_id == task_id)
        .order_by(TaskEvent.created_at.desc())
        .limit(limit)
    )
    return [(e, email, name) for e, email, name in result.all()]
