"""Shared workspace authorization helpers used by task, project and comment routes."""
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task
from app.models.user import User
from app.models.workspace import WorkspaceRole
from app.repositories import task_repo, workspace_repo


async def _ensure_not_guest(
    session: AsyncSession, *, workspace_id: UUID, user_id: UUID
) -> None:
    """Guests have read-only access — block them from mutating a workspace."""
    role = await workspace_repo.get_role(
        session, workspace_id=workspace_id, user_id=user_id
    )
    if role == WorkspaceRole.GUEST:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Guests have read-only access to this workspace",
        )


async def resolve_workspace(
    session: AsyncSession, user: User, workspace_id: UUID | None, *, write: bool = False
) -> UUID:
    """Default to the user's personal workspace, or verify membership of the
    given workspace. `write=True` additionally forbids guests (read-only role)."""
    if workspace_id is None:
        personal = await workspace_repo.get_personal(session, user_id=user.id)
        if personal is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No personal workspace",
            )
        return personal.id  # user owns their personal workspace — never a guest
    if not await workspace_repo.is_member(
        session, workspace_id=workspace_id, user_id=user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this workspace",
        )
    if write:
        await _ensure_not_guest(session, workspace_id=workspace_id, user_id=user.id)
    return workspace_id


async def require_task(
    session: AsyncSession, user: User, task_id: UUID, *, write: bool = False
) -> Task:
    """Fetch a task and ensure the current user is a member of its workspace.
    `write=True` additionally forbids guests (read-only role)."""
    task = await task_repo.get_task(session, task_id=task_id)
    if task is None or not await workspace_repo.is_member(
        session, workspace_id=task.workspace_id, user_id=user.id
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if write:
        await _ensure_not_guest(session, workspace_id=task.workspace_id, user_id=user.id)
    return task
