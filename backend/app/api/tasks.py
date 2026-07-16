from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentUser, SessionDep
from app.models.task import Task, TaskEnergy, TaskStatus
from app.models.user import User
from app.repositories import integration_repo, tag_repo, task_repo, workspace_repo
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


async def _require_workspace(
    session: AsyncSession, user: User, workspace_id: UUID | None
) -> UUID:
    """Resolve the target workspace: default to the user's personal one, and
    verify membership when an explicit workspace is given."""
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


async def _require_task(session: AsyncSession, user: User, task_id: UUID) -> Task:
    """Fetch a task and ensure the current user is a member of its workspace."""
    task = await task_repo.get_task(session, task_id=task_id)
    if task is None or not await workspace_repo.is_member(
        session, workspace_id=task.workspace_id, user_id=user.id
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


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


@router.get("", response_model=TaskListResponse)
async def list_tasks(
    current_user: CurrentUser,
    session: SessionDep,
    workspace_id: UUID | None = None,
    status_filter: TaskStatus | None = Query(default=None, alias="status"),
    tag_id: UUID | None = None,
    search: str | None = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
) -> TaskListResponse:
    ws_id = await _require_workspace(session, current_user, workspace_id)
    rows, total = await task_repo.list_tasks(
        session,
        workspace_id=ws_id,
        status=status_filter,
        tag_id=tag_id,
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
    ws_id = await _require_workspace(session, current_user, workspace_id)
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
    ws_id = await _require_workspace(session, current_user, workspace_id)
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
    task = await _require_task(session, current_user, task_id)

    update_data = payload.model_dump(exclude_unset=True, exclude={"tag_ids"})
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
    task = await _require_task(session, current_user, task_id)

    now = datetime.now(timezone.utc)
    if task.due_date is not None and task.due_date > now:
        task.due_date = task.due_date + timedelta(days=1)
    else:
        task.due_date = now + timedelta(days=1)
    task.snooze_count = (task.snooze_count or 0) + 1

    updated = await task_repo.update_task(session, task=task, tags=None)
    return TaskOut.model_validate(updated)


@router.post("/{task_id}/github-issue", response_model=TaskOut)
async def create_github_issue(
    task_id: UUID, current_user: CurrentUser, session: SessionDep
) -> TaskOut:
    """Open the task as a GitHub issue in the user's connected repo."""
    task = await _require_task(session, current_user, task_id)
    if task.github_issue_url:
        return TaskOut.model_validate(task)  # already linked — idempotent

    integration = await integration_repo.get_github(session, user_id=current_user.id)
    if integration is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Connect GitHub first (Settings → GitHub)",
        )

    result = await github.create_issue(
        integration.token,
        integration.repo,
        title=task.title,
        body=task.description or "",
    )
    task.github_issue_url = result["html_url"]
    task.github_issue_number = result["number"]
    updated = await task_repo.update_task(session, task=task, tags=None)
    return TaskOut.model_validate(updated)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: UUID, current_user: CurrentUser, session: SessionDep
) -> None:
    task = await _require_task(session, current_user, task_id)
    await task_repo.delete_task(session, task=task)
