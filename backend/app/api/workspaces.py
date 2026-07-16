from fastapi import APIRouter, status

from app.api.deps import CurrentUser, SessionDep
from app.models.workspace import WorkspaceRole
from app.repositories import workspace_repo
from app.schemas.workspace import WorkspaceCreate, WorkspaceOut

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


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
