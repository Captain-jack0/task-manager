from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project


async def list_by_workspace(
    session: AsyncSession, *, workspace_id: UUID
) -> Sequence[Project]:
    result = await session.execute(
        select(Project)
        .where(Project.workspace_id == workspace_id)
        .order_by(Project.name.asc())
    )
    return result.scalars().all()


async def get(session: AsyncSession, *, project_id: UUID) -> Project | None:
    result = await session.execute(select(Project).where(Project.id == project_id))
    return result.scalar_one_or_none()


async def create(
    session: AsyncSession, *, workspace_id: UUID, name: str, color: str | None
) -> Project:
    project = Project(workspace_id=workspace_id, name=name, color=color)
    session.add(project)
    await session.commit()
    await session.refresh(project)
    return project


async def update(session: AsyncSession, *, project: Project) -> Project:
    await session.commit()
    await session.refresh(project)
    return project


async def delete(session: AsyncSession, *, project: Project) -> None:
    await session.delete(project)
    await session.commit()
