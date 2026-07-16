from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.api.access import resolve_workspace
from app.api.deps import CurrentUser, SessionDep
from app.models.project import Project
from app.repositories import project_repo, workspace_repo
from app.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


async def _require_project(session, user, project_id: UUID) -> Project:
    project = await project_repo.get(session, project_id=project_id)
    if project is None or not await workspace_repo.is_member(
        session, workspace_id=project.workspace_id, user_id=user.id
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.get("", response_model=list[ProjectOut])
async def list_projects(
    current_user: CurrentUser,
    session: SessionDep,
    workspace_id: UUID | None = None,
) -> list[ProjectOut]:
    ws_id = await resolve_workspace(session, current_user, workspace_id)
    projects = await project_repo.list_by_workspace(session, workspace_id=ws_id)
    return [ProjectOut.model_validate(p) for p in projects]


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    current_user: CurrentUser,
    session: SessionDep,
    workspace_id: UUID | None = None,
) -> ProjectOut:
    ws_id = await resolve_workspace(session, current_user, workspace_id)
    project = await project_repo.create(
        session, workspace_id=ws_id, name=payload.name, color=payload.color
    )
    return ProjectOut.model_validate(project)


@router.put("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    current_user: CurrentUser,
    session: SessionDep,
) -> ProjectOut:
    project = await _require_project(session, current_user, project_id)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(project, key, value)
    updated = await project_repo.update(session, project=project)
    return ProjectOut.model_validate(updated)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID, current_user: CurrentUser, session: SessionDep
) -> None:
    project = await _require_project(session, current_user, project_id)
    await project_repo.delete(session, project=project)
