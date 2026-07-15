from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tag import Tag
from app.models.task import Task, TaskStatus


async def list_tasks(
    session: AsyncSession,
    *,
    user_id: UUID,
    status: TaskStatus | None = None,
    tag_id: UUID | None = None,
    search: str | None = None,
    page: int = 1,
    limit: int = 20,
) -> tuple[Sequence[Task], int]:
    base = select(Task).where(Task.user_id == user_id)
    count_base = select(func.count(Task.id)).where(Task.user_id == user_id)

    if status is not None:
        base = base.where(Task.status == status)
        count_base = count_base.where(Task.status == status)
    if search:
        like = f"%{search}%"
        cond = or_(Task.title.ilike(like), Task.description.ilike(like))
        base = base.where(cond)
        count_base = count_base.where(cond)
    if tag_id is not None:
        base = base.join(Task.tags).where(Tag.id == tag_id)
        count_base = count_base.join(Task.tags).where(Tag.id == tag_id)

    base = base.order_by(Task.created_at.desc()).offset((page - 1) * limit).limit(limit)

    rows = (await session.execute(base)).scalars().unique().all()
    total = (await session.execute(count_base)).scalar_one()
    return rows, total


async def list_active_tasks(
    session: AsyncSession, *, user_id: UUID
) -> Sequence[Task]:
    """All not-done tasks for a user — candidate pool for the suggestion engine."""
    result = await session.execute(
        select(Task).where(Task.user_id == user_id, Task.status != TaskStatus.DONE)
    )
    return result.scalars().unique().all()


async def get_task(session: AsyncSession, *, task_id: UUID, user_id: UUID) -> Task | None:
    result = await session.execute(
        select(Task).where(Task.id == task_id, Task.user_id == user_id)
    )
    return result.scalar_one_or_none()


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
