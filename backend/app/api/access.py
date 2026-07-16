"""Shared workspace authorization helpers used by task, project and comment routes."""
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task
from app.models.user import User
from app.repositories import task_repo, workspace_repo


async def resolve_workspace(
    session: AsyncSession, user: User, workspace_id: UUID | None
) -> UUID:
    """Default to the user's personal workspace, or verify membership of the
    given workspace."""
    if workspace_id is None:
        personal = await workspace_repo.get_personal(session, user_id=user.id)
        if personal is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No personal workspace",
            )
        return personal.id
    if not await workspace_repo.is_member(
        session, workspace_id=workspace_id, user_id=user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this workspace",
        )
    return workspace_id


async def require_task(session: AsyncSession, user: User, task_id: UUID) -> Task:
    """Fetch a task and ensure the current user is a member of its workspace."""
    task = await task_repo.get_task(session, task_id=task_id)
    if task is None or not await workspace_repo.is_member(
        session, workspace_id=task.workspace_id, user_id=user.id
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task
