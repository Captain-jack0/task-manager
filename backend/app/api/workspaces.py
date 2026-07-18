from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, SessionDep
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceRole
from app.repositories import task_repo, workspace_repo
from app.schemas.workspace import (
    AddMemberRequest,
    CapacityOut,
    MemberOut,
    UpdateMemberRequest,
    WorkspaceCreate,
    WorkspaceOut,
)

router = APIRouter(prefix="/workspaces", tags=["workspaces"])

_MANAGERS = (WorkspaceRole.OWNER, WorkspaceRole.ADMIN)


@router.get("", response_model=list[WorkspaceOut])
async def list_workspaces(
    current_user: CurrentUser, session: SessionDep
) -> list[WorkspaceOut]:
    pairs = await workspace_repo.list_for_user(session, user_id=current_user.id)
    return [WorkspaceOut.of(ws, role) for ws, role in pairs]


@router.post("", response_model=WorkspaceOut, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    payload: WorkspaceCreate, current_user: CurrentUser, session: SessionDep
) -> WorkspaceOut:
    workspace = await workspace_repo.create_workspace(
        session, name=payload.name, owner_id=current_user.id, is_personal=False
    )
    await session.commit()
    await session.refresh(workspace)
    return WorkspaceOut.of(workspace, WorkspaceRole.OWNER)


# --- members ---


async def _require_workspace(session: AsyncSession, user: User, workspace_id: UUID) -> Workspace:
    """The workspace must exist and the current user must be a member."""
    workspace = await workspace_repo.get(session, workspace_id=workspace_id)
    role = await workspace_repo.get_role(
        session, workspace_id=workspace_id, user_id=user.id
    )
    if workspace is None or role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    return workspace


async def _require_manager(session: AsyncSession, user: User, workspace_id: UUID) -> Workspace:
    workspace = await _require_workspace(session, user, workspace_id)
    role = await workspace_repo.get_role(
        session, workspace_id=workspace_id, user_id=user.id
    )
    if role not in _MANAGERS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners and admins can manage members",
        )
    if workspace.is_personal:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Personal workspaces are private and cannot have members",
        )
    return workspace


@router.get("/{workspace_id}/members", response_model=list[MemberOut])
async def list_members(
    workspace_id: UUID, current_user: CurrentUser, session: SessionDep
) -> list[MemberOut]:
    await _require_workspace(session, current_user, workspace_id)
    members = await workspace_repo.list_members(session, workspace_id=workspace_id)
    return [MemberOut(user_id=u.id, email=u.email, role=role) for u, role in members]


@router.get("/{workspace_id}/capacity", response_model=list[CapacityOut])
async def workspace_capacity(
    workspace_id: UUID, current_user: CurrentUser, session: SessionDep
) -> list[CapacityOut]:
    """Per-member load: open assigned tasks + their total estimated minutes."""
    await _require_workspace(session, current_user, workspace_id)
    members = await workspace_repo.list_members(session, workspace_id=workspace_id)
    cap = await task_repo.capacity_by_assignee(session, workspace_id=workspace_id)
    return [
        CapacityOut(
            user_id=u.id,
            email=u.email,
            role=role,
            open_task_count=cap.get(u.id, (0, 0))[0],
            estimated_minutes=cap.get(u.id, (0, 0))[1],
        )
        for u, role in members
    ]


@router.post(
    "/{workspace_id}/members",
    response_model=MemberOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_member(
    workspace_id: UUID,
    payload: AddMemberRequest,
    current_user: CurrentUser,
    session: SessionDep,
) -> MemberOut:
    await _require_manager(session, current_user, workspace_id)
    if payload.role is WorkspaceRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="There is only one owner",
        )

    user = await workspace_repo.get_user_by_email(session, email=payload.email)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No user with that email — they must sign up first",
        )
    if await workspace_repo.is_member(session, workspace_id=workspace_id, user_id=user.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Already a member"
        )

    await workspace_repo.add_member(
        session, workspace_id=workspace_id, user_id=user.id, role=payload.role
    )
    return MemberOut(user_id=user.id, email=user.email, role=payload.role)


@router.put("/{workspace_id}/members/{user_id}", response_model=MemberOut)
async def update_member_role(
    workspace_id: UUID,
    user_id: UUID,
    payload: UpdateMemberRequest,
    current_user: CurrentUser,
    session: SessionDep,
) -> MemberOut:
    workspace = await _require_manager(session, current_user, workspace_id)
    if user_id == workspace.owner_id or payload.role is WorkspaceRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The workspace owner's role cannot be changed",
        )
    member = await workspace_repo.get_member(
        session, workspace_id=workspace_id, user_id=user_id
    )
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    member.role = payload.role
    await workspace_repo.update_member(session, member=member)

    user = await session.get(User, user_id)
    return MemberOut(user_id=user_id, email=user.email if user else "", role=payload.role)


@router.delete(
    "/{workspace_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def remove_member(
    workspace_id: UUID,
    user_id: UUID,
    current_user: CurrentUser,
    session: SessionDep,
) -> None:
    workspace = await _require_manager(session, current_user, workspace_id)
    if user_id == workspace.owner_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The workspace owner cannot be removed",
        )
    await workspace_repo.remove_member(
        session, workspace_id=workspace_id, user_id=user_id
    )
