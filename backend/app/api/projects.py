from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.access import _ensure_not_guest, resolve_workspace
from app.api.deps import CurrentUser, SessionDep
from app.core.crypto import decrypt_secret
from app.models.project import Project
from app.models.user import User
from app.repositories import integration_repo, project_repo, workspace_repo
from app.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate
from app.services import github

router = APIRouter(prefix="/projects", tags=["projects"])


async def _require_project(
    session: AsyncSession, user: User, project_id: UUID, *, write: bool = False
) -> Project:
    project = await project_repo.get(session, project_id=project_id)
    if project is None or not await workspace_repo.is_member(
        session, workspace_id=project.workspace_id, user_id=user.id
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if write:
        await _ensure_not_guest(session, workspace_id=project.workspace_id, user_id=user.id)
    return project


async def _check_repo_access(session: AsyncSession, user: User, repo: str) -> None:
    """A project's repo must be visible to the user's GitHub token now, or opening
    issues for its tasks would fail later with a confusing error."""
    integration = await integration_repo.get_github(session, user_id=user.id)
    if integration is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Connect GitHub first (account menu → GitHub integration)",
        )
    await github.verify_repo(decrypt_secret(integration.token), repo)


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
    ws_id = await resolve_workspace(session, current_user, workspace_id, write=True)
    if payload.github_repo:
        await _check_repo_access(session, current_user, payload.github_repo)
    project = await project_repo.create(
        session,
        workspace_id=ws_id,
        name=payload.name,
        color=payload.color,
        github_repo=payload.github_repo,
    )
    return ProjectOut.model_validate(project)


@router.put("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    current_user: CurrentUser,
    session: SessionDep,
) -> ProjectOut:
    project = await _require_project(session, current_user, project_id, write=True)
    data = payload.model_dump(exclude_unset=True)
    if data.get("github_repo"):
        await _check_repo_access(session, current_user, data["github_repo"])
    for key, value in data.items():
        setattr(project, key, value)
    updated = await project_repo.update(session, project=project)
    return ProjectOut.model_validate(updated)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID, current_user: CurrentUser, session: SessionDep
) -> None:
    project = await _require_project(session, current_user, project_id, write=True)
    await project_repo.delete(session, project=project)
