from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember, WorkspaceRole


async def list_for_user(
    session: AsyncSession, *, user_id: UUID
) -> list[tuple[Workspace, WorkspaceRole]]:
    """Workspaces the user belongs to, personal first, with the user's role."""
    result = await session.execute(
        select(Workspace, WorkspaceMember.role)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == user_id)
        .order_by(Workspace.is_personal.desc(), Workspace.created_at.asc())
    )
    return [(ws, role) for ws, role in result.all()]


async def get(session: AsyncSession, *, workspace_id: UUID) -> Workspace | None:
    return await session.get(Workspace, workspace_id)


async def get_personal(session: AsyncSession, *, user_id: UUID) -> Workspace | None:
    result = await session.execute(
        select(Workspace).where(
            Workspace.owner_id == user_id, Workspace.is_personal.is_(True)
        )
    )
    return result.scalars().first()


async def is_member(
    session: AsyncSession, *, workspace_id: UUID, user_id: UUID
) -> bool:
    result = await session.execute(
        select(WorkspaceMember.id).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    return result.first() is not None


async def get_role(
    session: AsyncSession, *, workspace_id: UUID, user_id: UUID
) -> WorkspaceRole | None:
    result = await session.execute(
        select(WorkspaceMember.role).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def get_member(
    session: AsyncSession, *, workspace_id: UUID, user_id: UUID
) -> WorkspaceMember | None:
    result = await session.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def list_members(
    session: AsyncSession, *, workspace_id: UUID
) -> list[tuple[User, WorkspaceRole]]:
    result = await session.execute(
        select(User, WorkspaceMember.role)
        .join(WorkspaceMember, WorkspaceMember.user_id == User.id)
        .where(WorkspaceMember.workspace_id == workspace_id)
        .order_by(WorkspaceMember.role.asc(), User.email.asc())
    )
    return [(user, role) for user, role in result.all()]


async def add_member(
    session: AsyncSession, *, workspace_id: UUID, user_id: UUID, role: WorkspaceRole
) -> WorkspaceMember:
    member = WorkspaceMember(workspace_id=workspace_id, user_id=user_id, role=role)
    session.add(member)
    await session.commit()
    await session.refresh(member)
    return member


async def update_member(
    session: AsyncSession, *, member: WorkspaceMember
) -> WorkspaceMember:
    await session.commit()
    await session.refresh(member)
    return member


async def remove_member(
    session: AsyncSession, *, workspace_id: UUID, user_id: UUID
) -> None:
    await session.execute(
        delete(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    await session.commit()


async def get_user_by_email(session: AsyncSession, *, email: str) -> User | None:
    result = await session.execute(select(User).where(User.email == email.lower()))
    return result.scalar_one_or_none()


async def create_workspace(
    session: AsyncSession,
    *,
    name: str,
    owner_id: UUID,
    is_personal: bool = False,
) -> Workspace:
    """Create a workspace and its owner membership. Does not commit — the
    caller owns the transaction."""
    workspace = Workspace(name=name, owner_id=owner_id, is_personal=is_personal)
    session.add(workspace)
    await session.flush()
    session.add(
        WorkspaceMember(
            workspace_id=workspace.id, user_id=owner_id, role=WorkspaceRole.OWNER
        )
    )
    await session.flush()
    return workspace
