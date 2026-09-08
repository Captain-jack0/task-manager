from collections.abc import Sequence
from datetime import date
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sprint import Sprint
from app.models.task import Task, TaskStatus


async def list_by_workspace(session: AsyncSession, *, workspace_id: UUID) -> Sequence[Sprint]:
    result = await session.execute(
        select(Sprint)
        .where(Sprint.workspace_id == workspace_id)
        .order_by(Sprint.start_date.desc(), Sprint.created_at.desc())
    )
    return result.scalars().all()


async def get(session: AsyncSession, *, sprint_id: UUID) -> Sprint | None:
    result = await session.execute(select(Sprint).where(Sprint.id == sprint_id))
    return result.scalar_one_or_none()


async def create(
    session: AsyncSession,
    *,
    workspace_id: UUID,
    name: str,
    goal: str | None,
    start_date: date,
    end_date: date,
) -> Sprint:
    sprint = Sprint(
        workspace_id=workspace_id,
        name=name,
        goal=goal,
        start_date=start_date,
        end_date=end_date,
    )
    session.add(sprint)
    await session.commit()
    await session.refresh(sprint)
    return sprint


async def update(session: AsyncSession, *, sprint: Sprint) -> Sprint:
    await session.commit()
    await session.refresh(sprint)
    return sprint


async def delete(session: AsyncSession, *, sprint: Sprint) -> None:
    await session.delete(sprint)
    await session.commit()


async def task_counts(session: AsyncSession, *, workspace_id: UUID) -> dict[UUID, tuple[int, int]]:
    """{sprint_id: (total, finished)} for every sprint in the workspace that has tasks."""
    finished = case((Task.status.in_([TaskStatus.DONE, TaskStatus.CLOSED]), 1), else_=0)
    result = await session.execute(
        select(Task.sprint_id, func.count(Task.id), func.sum(finished))
        .where(Task.workspace_id == workspace_id, Task.sprint_id.is_not(None))
        .group_by(Task.sprint_id)
    )
    return {sid: (int(total), int(done or 0)) for sid, total, done in result.all()}
