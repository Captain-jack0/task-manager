from collections.abc import Sequence
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tag import Tag
from app.models.task import Task, TaskEnergy, TaskPriority, TaskStatus

_PRIORITY_RANK = case(
    (Task.priority == TaskPriority.HIGH, 3),
    (Task.priority == TaskPriority.MEDIUM, 2),
    else_=1,
)
_ENERGY_RANK = case(
    (Task.energy_level == TaskEnergy.HIGH, 3),
    (Task.energy_level == TaskEnergy.MEDIUM, 2),
    (Task.energy_level == TaskEnergy.LOW, 1),
    else_=None,
)
_STATUS_RANK = case(*[(Task.status == s, i) for i, s in enumerate(TaskStatus)])

# Sortable fields. Enums are ranked so that `desc` puts the highest priority /
# energy first and `asc` walks the status workflow (todo → closed) in order.
SORT_COLUMNS: dict[str, Any] = {
    "created_at": Task.created_at,
    "updated_at": Task.updated_at,
    "due_date": Task.due_date,
    "priority": _PRIORITY_RANK,
    "energy": _ENERGY_RANK,
    "status": _STATUS_RANK,
    "title": func.lower(Task.title),
    "estimated_minutes": Task.estimated_minutes,
}


async def list_tasks(
    session: AsyncSession,
    *,
    workspace_id: UUID,
    status: TaskStatus | None = None,
    tag_id: UUID | None = None,
    project_id: UUID | None = None,
    assignee_id: UUID | None = None,
    unassigned: bool = False,
    priority: TaskPriority | None = None,
    energy: TaskEnergy | None = None,
    due_before: datetime | None = None,
    due_after: datetime | None = None,
    has_due_date: bool | None = None,
    max_minutes: int | None = None,
    search: str | None = None,
    sort: str = "created_at",
    order: str = "desc",
    page: int = 1,
    limit: int = 20,
) -> tuple[Sequence[Task], int]:
    conditions: list[Any] = [Task.workspace_id == workspace_id]
    if status is not None:
        conditions.append(Task.status == status)
    if project_id is not None:
        conditions.append(Task.project_id == project_id)
    if unassigned:
        conditions.append(Task.assignee_id.is_(None))
    elif assignee_id is not None:
        conditions.append(Task.assignee_id == assignee_id)
    if priority is not None:
        conditions.append(Task.priority == priority)
    if energy is not None:
        conditions.append(Task.energy_level == energy)
    if due_before is not None:
        conditions.append(Task.due_date < due_before)
    if due_after is not None:
        conditions.append(Task.due_date >= due_after)
    if has_due_date is True:
        conditions.append(Task.due_date.is_not(None))
    elif has_due_date is False:
        conditions.append(Task.due_date.is_(None))
    if max_minutes is not None:
        conditions.append(Task.estimated_minutes <= max_minutes)
    if search:
        like = f"%{search}%"
        conditions.append(or_(Task.title.ilike(like), Task.description.ilike(like)))

    base = select(Task).where(*conditions)
    count_base = select(func.count(Task.id)).where(*conditions)
    if tag_id is not None:
        base = base.join(Task.tags).where(Tag.id == tag_id)
        count_base = count_base.join(Task.tags).where(Tag.id == tag_id)

    key = SORT_COLUMNS.get(sort, Task.created_at)
    primary = key.asc() if order == "asc" else key.desc()
    # Secondary key keeps pagination stable when the primary key ties.
    base = (
        base.order_by(primary.nulls_last(), Task.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )

    rows = (await session.execute(base)).scalars().unique().all()
    total = (await session.execute(count_base)).scalar_one()
    return rows, total


async def list_active_tasks(
    session: AsyncSession, *, workspace_id: UUID
) -> Sequence[Task]:
    """Actionable tasks in a workspace — candidate pool for the suggestion
    engine. Excludes done/closed (finished) and blocked (can't start now)."""
    result = await session.execute(
        select(Task).where(
            Task.workspace_id == workspace_id,
            Task.status.not_in([TaskStatus.DONE, TaskStatus.CLOSED, TaskStatus.BLOCKED]),
        )
    )
    return result.scalars().unique().all()


async def get_task(session: AsyncSession, *, task_id: UUID) -> Task | None:
    """Fetch a task by id. Authorization is handled at the workspace layer."""
    result = await session.execute(select(Task).where(Task.id == task_id))
    return result.scalar_one_or_none()


async def capacity_by_assignee(
    session: AsyncSession, *, workspace_id: UUID
) -> dict[UUID, tuple[int, int]]:
    """Per-assignee load in a workspace: {user_id: (open_task_count, est_minutes)},
    counting only actionable (not done/closed) assigned tasks."""
    result = await session.execute(
        select(
            Task.assignee_id,
            func.count(Task.id),
            func.coalesce(func.sum(Task.estimated_minutes), 0),
        )
        .where(
            Task.workspace_id == workspace_id,
            Task.assignee_id.is_not(None),
            Task.status.not_in([TaskStatus.DONE, TaskStatus.CLOSED]),
        )
        .group_by(Task.assignee_id)
    )
    return {row[0]: (row[1], int(row[2])) for row in result.all()}


async def create_task(session: AsyncSession, *, task: Task, tags: list[Tag]) -> Task:
    task.tags = tags
    session.add(task)
    await session.commit()
    await session.refresh(task)
    return task


async def update_task(session: AsyncSession, *, task: Task, tags: list[Tag] | None) -> Task:
    if tags is not None:
        task.tags = tags
    await session.commit()
    await session.refresh(task)
    return task


async def delete_task(session: AsyncSession, *, task: Task) -> None:
    await session.delete(task)
    await session.commit()
