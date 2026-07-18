from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request, status

from app.api.access import require_task, resolve_workspace
from app.api.deps import CurrentUser, SessionDep
from app.core.crypto import decrypt_secret
from app.core.rate_limit import limiter
from app.models.task import Task, TaskEnergy, TaskStatus
from app.models.user import User
from app.repositories import (
    integration_repo,
    project_repo,
    tag_repo,
    task_repo,
    workspace_repo,
)
from app.schemas.task import (
    SuggestResponse,
    TaskCreate,
    TaskListResponse,
    TaskOut,
    TaskSuggestion,
    TaskUpdate,
)
from app.services import github, suggestions
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/tasks", tags=["tasks"])


async def _require_task(
    session: AsyncSession, user: User, task_id: UUID, *, write: bool = False
) -> Task:
    """Membership check (delegates to the shared helper); `write=True` also
    forbids guests, who are read-only."""
    return await require_task(session, user, task_id, write=write)


async def _resolve_tags(session, *, tag_ids, user_id):
    if not tag_ids:
        return []
    tags = await tag_repo.get_tags_by_ids(session, tag_ids=tag_ids, user_id=user_id)
    if len(tags) != len(set(tag_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more tag_ids are invalid",
        )
    return tags


async def _validate_project(
    session: AsyncSession, project_id: UUID | None, workspace_id: UUID
) -> None:
    """A task's project must belong to the same workspace as the task."""
    if project_id is None:
        return
    project = await project_repo.get(session, project_id=project_id)
    if project is None or project.workspace_id != workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project does not belong to this workspace",
        )


async def _validate_assignee(
    session: AsyncSession, assignee_id: UUID | None, workspace_id: UUID
) -> None:
    """A task can only be assigned to a member of its workspace."""
    if assignee_id is None:
        return
    if not await workspace_repo.is_member(
        session, workspace_id=workspace_id, user_id=assignee_id
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assignee is not a member of this workspace",
        )


@router.get("", response_model=TaskListResponse)
async def list_tasks(
    current_user: CurrentUser,
    session: SessionDep,
    workspace_id: UUID | None = None,
    status_filter: TaskStatus | None = Query(default=None, alias="status"),
    tag_id: UUID | None = None,
    project_id: UUID | None = None,
    assignee_id: UUID | None = None,
    search: str | None = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
) -> TaskListResponse:
    ws_id = await resolve_workspace(session, current_user, workspace_id)
    rows, total = await task_repo.list_tasks(
        session,
        workspace_id=ws_id,
        status=status_filter,
        tag_id=tag_id,
        project_id=project_id,
        assignee_id=assignee_id,
        search=search,
        page=page,
        limit=limit,
    )
    return TaskListResponse(
        data=[TaskOut.model_validate(t) for t in rows],
        total=total,
        page=page,
        limit=limit,
    )


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate,
    current_user: CurrentUser,
    session: SessionDep,
    workspace_id: UUID | None = None,
) -> TaskOut:
    ws_id = await resolve_workspace(session, current_user, workspace_id, write=True)
    await _validate_project(session, payload.project_id, ws_id)
    await _validate_assignee(session, payload.assignee_id, ws_id)
    tags = await _resolve_tags(session, tag_ids=payload.tag_ids, user_id=current_user.id)
    task = Task(
        user_id=current_user.id,
        workspace_id=ws_id,
        title=payload.title,
        description=payload.description,
        status=payload.status,
        priority=payload.priority,
        due_date=payload.due_date,
        estimated_minutes=payload.estimated_minutes,
        energy_level=payload.energy_level,
        project_id=payload.project_id,
        assignee_id=payload.assignee_id,
    )
    created = await task_repo.create_task(session, task=task, tags=tags)
    return TaskOut.model_validate(created)


@router.get("/suggest", response_model=SuggestResponse)
async def suggest_tasks(
    current_user: CurrentUser,
    session: SessionDep,
    workspace_id: UUID | None = None,
    minutes: int | None = Query(default=None, ge=1, le=1440),
    energy: TaskEnergy | None = Query(default=None),
    limit: int = Query(default=5, ge=1, le=10),
) -> SuggestResponse:
    """The 'What should I do now?' engine: rank open tasks in the workspace by
    how well they fit the time and energy the user has right now."""
    ws_id = await resolve_workspace(session, current_user, workspace_id)
    tasks = await task_repo.list_active_tasks(session, workspace_id=ws_id)
    now = datetime.now(timezone.utc)
    ranked = suggestions.rank_tasks(
        tasks, available_minutes=minutes, energy=energy, now=now, limit=limit
    )
    return SuggestResponse(
        suggestions=[
            TaskSuggestion(task=TaskOut.model_validate(task), score=round(score, 2), reason=reason)
            for task, score, reason in ranked
        ]
    )


@router.get("/{task_id}", response_model=TaskOut)
async def get_task(
    task_id: UUID, current_user: CurrentUser, session: SessionDep
) -> TaskOut:
    task = await _require_task(session, current_user, task_id)
    return TaskOut.model_validate(task)


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: UUID,
    payload: TaskUpdate,
    current_user: CurrentUser,
    session: SessionDep,
) -> TaskOut:
    task = await _require_task(session, current_user, task_id, write=True)

    update_data = payload.model_dump(exclude_unset=True, exclude={"tag_ids"})
    if "project_id" in update_data:
        await _validate_project(session, update_data["project_id"], task.workspace_id)
    if "assignee_id" in update_data:
        await _validate_assignee(session, update_data["assignee_id"], task.workspace_id)
    for key, value in update_data.items():
        setattr(task, key, value)

    tags = None
    if payload.tag_ids is not None:
        tags = await _resolve_tags(
            session, tag_ids=payload.tag_ids, user_id=current_user.id
        )

    updated = await task_repo.update_task(session, task=task, tags=tags)
    return TaskOut.model_validate(updated)


@router.post("/{task_id}/snooze", response_model=TaskOut)
async def snooze_task(
    task_id: UUID, current_user: CurrentUser, session: SessionDep
) -> TaskOut:
    """Push a task to a later day without guilt, and count the postponement."""
    task = await _require_task(session, current_user, task_id, write=True)

    now = datetime.now(timezone.utc)
    if task.due_date is not None and task.due_date > now:
        task.due_date = task.due_date + timedelta(days=1)
    else:
        task.due_date = now + timedelta(days=1)
    task.snooze_count = (task.snooze_count or 0) + 1

    updated = await task_repo.update_task(session, task=task, tags=None)
    return TaskOut.model_validate(updated)


@router.post("/{task_id}/reset-snooze", response_model=TaskOut)
async def reset_snooze(
    task_id: UUID, current_user: CurrentUser, session: SessionDep
) -> TaskOut:
    """Clear the postponement counter — used when the user acts on a task that
    the procrastination detector flagged."""
    task = await _require_task(session, current_user, task_id, write=True)
    task.snooze_count = 0
    updated = await task_repo.update_task(session, task=task, tags=None)
    return TaskOut.model_validate(updated)


@router.post("/{task_id}/github-issue", response_model=TaskOut)
@limiter.limit("30/minute")
async def create_github_issue(
    request: Request, task_id: UUID, current_user: CurrentUser, session: SessionDep
) -> TaskOut:
    """Open the task as a GitHub issue in the user's connected repo."""
    task = await _require_task(session, current_user, task_id, write=True)
    if task.github_issue_url:
        return TaskOut.model_validate(task)  # already linked — idempotent

    integration = await integration_repo.get_github(session, user_id=current_user.id)
    if integration is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Connect GitHub first (Settings → GitHub)",
        )

    result = await github.create_issue(
        decrypt_secret(integration.token),
        integration.repo,
        title=task.title,
        body=task.description or "",
    )
    task.github_issue_url = result["html_url"]
    task.github_issue_number = result["number"]
    updated = await task_repo.update_task(session, task=task, tags=None)
    return TaskOut.model_validate(updated)


@router.post("/{task_id}/github-sync", response_model=TaskOut)
@limiter.limit("30/minute")
async def sync_github_issue(
    request: Request, task_id: UUID, current_user: CurrentUser, session: SessionDep
) -> TaskOut:
    """Pull the linked GitHub issue's state; if it's closed, move the task to Done."""
    task = await _require_task(session, current_user, task_id, write=True)
    if not task.github_issue_number:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This task isn't linked to a GitHub issue",
        )
    integration = await integration_repo.get_github(session, user_id=current_user.id)
    if integration is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Connect GitHub first"
        )

    state = await github.get_issue_state(
        decrypt_secret(integration.token), integration.repo, task.github_issue_number
    )
    if state == "closed" and task.status not in (TaskStatus.DONE, TaskStatus.CLOSED):
        task.status = TaskStatus.DONE
        task = await task_repo.update_task(session, task=task, tags=None)
    return TaskOut.model_validate(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: UUID, current_user: CurrentUser, session: SessionDep
) -> None:
    task = await _require_task(session, current_user, task_id, write=True)
    await task_repo.delete_task(session, task=task)
