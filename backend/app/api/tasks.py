from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.access import require_task, resolve_workspace
from app.api.deps import CurrentUser, SessionDep
from app.core.crypto import decrypt_secret
from app.core.rate_limit import limiter
from app.models.tag import Tag
from app.models.task import Task, TaskEnergy, TaskPriority, TaskStatus
from app.models.task_link import LinkKind, TaskLink
from app.models.user import User
from app.repositories import (
    integration_repo,
    project_repo,
    sprint_repo,
    tag_repo,
    task_link_repo,
    task_repo,
    workspace_repo,
)
from app.schemas.task import (
    SortOrder,
    SuggestResponse,
    TaskCreate,
    TaskLinkCreate,
    TaskListResponse,
    TaskOut,
    TaskRef,
    TaskSortField,
    TaskSuggestion,
    TaskUpdate,
)
from app.services import github, suggestions

router = APIRouter(prefix="/tasks", tags=["tasks"])


async def _require_task(
    session: AsyncSession, user: User, task_id: UUID, *, write: bool = False
) -> Task:
    """Membership check (delegates to the shared helper); `write=True` also
    forbids guests, who are read-only."""
    return await require_task(session, user, task_id, write=write)


async def _resolve_tags(
    session: AsyncSession, *, tag_ids: list[UUID], user_id: UUID
) -> list[Tag]:
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


async def _validate_sprint(
    session: AsyncSession, sprint_id: UUID | None, workspace_id: UUID
) -> None:
    """A task's sprint must belong to the same workspace as the task."""
    if sprint_id is None:
        return
    sprint = await sprint_repo.get(session, sprint_id=sprint_id)
    if sprint is None or sprint.workspace_id != workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sprint does not belong to this workspace",
        )


async def _out_many(session: AsyncSession, tasks: Sequence[Task]) -> list[TaskOut]:
    """TaskOut with blocked_by / blocks / related attached — one extra query for all rows."""
    links = await task_link_repo.summaries(session, task_ids=[t.id for t in tasks])
    return [
        TaskOut.model_validate(t).model_copy(
            update={k: [TaskRef.model_validate(r) for r in v] for k, v in links.get(t.id, {}).items()}
        )
        for t in tasks
    ]


async def _out(session: AsyncSession, task: Task) -> TaskOut:
    return (await _out_many(session, [task]))[0]


@router.get("", response_model=TaskListResponse)
async def list_tasks(
    current_user: CurrentUser,
    session: SessionDep,
    workspace_id: UUID | None = None,
    status_filter: TaskStatus | None = Query(default=None, alias="status"),
    tag_id: UUID | None = None,
    project_id: UUID | None = None,
    assignee_id: UUID | None = None,
    unassigned: bool = False,
    sprint_id: UUID | None = None,
    backlog: bool = False,
    priority: TaskPriority | None = None,
    energy: TaskEnergy | None = None,
    due_before: datetime | None = None,
    due_after: datetime | None = None,
    has_due_date: bool | None = None,
    max_minutes: int | None = Query(default=None, ge=1),
    search: str | None = None,
    sort: TaskSortField = "created_at",
    order: SortOrder = "desc",
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
        unassigned=unassigned,
        sprint_id=sprint_id,
        backlog=backlog,
        priority=priority,
        energy=energy,
        due_before=due_before,
        due_after=due_after,
        has_due_date=has_due_date,
        max_minutes=max_minutes,
        search=search,
        sort=sort,
        order=order,
        page=page,
        limit=limit,
    )
    return TaskListResponse(
        data=await _out_many(session, rows),
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
    await _validate_sprint(session, payload.sprint_id, ws_id)
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
        sprint_id=payload.sprint_id,
    )
    created = await task_repo.create_task(session, task=task, tags=tags)
    return await _out(session, created)


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
    now = datetime.now(UTC)
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
    return await _out(session, task)


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
    if "sprint_id" in update_data:
        await _validate_sprint(session, update_data["sprint_id"], task.workspace_id)
    old_status = task.status
    for key, value in update_data.items():
        setattr(task, key, value)
    if task.status != old_status:
        await task_link_repo.propagate_blocker_status(session, task)

    tags = None
    if payload.tag_ids is not None:
        tags = await _resolve_tags(
            session, tag_ids=payload.tag_ids, user_id=current_user.id
        )

    updated = await task_repo.update_task(session, task=task, tags=tags)
    return await _out(session, updated)


@router.post("/{task_id}/snooze", response_model=TaskOut)
async def snooze_task(
    task_id: UUID, current_user: CurrentUser, session: SessionDep
) -> TaskOut:
    """Push a task to a later day without guilt, and count the postponement."""
    task = await _require_task(session, current_user, task_id, write=True)

    now = datetime.now(UTC)
    if task.due_date is not None and task.due_date > now:
        task.due_date = task.due_date + timedelta(days=1)
    else:
        task.due_date = now + timedelta(days=1)
    task.snooze_count = (task.snooze_count or 0) + 1

    updated = await task_repo.update_task(session, task=task, tags=None)
    return await _out(session, updated)


@router.post("/{task_id}/reset-snooze", response_model=TaskOut)
async def reset_snooze(
    task_id: UUID, current_user: CurrentUser, session: SessionDep
) -> TaskOut:
    """Clear the postponement counter — used when the user acts on a task that
    the procrastination detector flagged."""
    task = await _require_task(session, current_user, task_id, write=True)
    task.snooze_count = 0
    updated = await task_repo.update_task(session, task=task, tags=None)
    return await _out(session, updated)


@router.post("/{task_id}/github-issue", response_model=TaskOut)
@limiter.limit("30/minute")
async def create_github_issue(
    request: Request, task_id: UUID, current_user: CurrentUser, session: SessionDep
) -> TaskOut:
    """Open the task as a GitHub issue in the user's connected repo."""
    task = await _require_task(session, current_user, task_id, write=True)
    if task.github_issue_url:
        return await _out(session, task)  # already linked — idempotent

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
    return await _out(session, updated)


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
        await task_link_repo.propagate_blocker_status(session, task)
        task = await task_repo.update_task(session, task=task, tags=None)
    return await _out(session, task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: UUID, current_user: CurrentUser, session: SessionDep
) -> None:
    task = await _require_task(session, current_user, task_id, write=True)
    # Tasks this one was blocking may become free once it is gone.
    dependents = await task_link_repo.dependents(session, blocker_id=task.id)
    await task_repo.delete_task(session, task=task)
    for dependent in dependents:
        await task_link_repo.release_if_unblocked(session, dependent)
    await session.commit()


@router.post("/{task_id}/links", response_model=TaskOut)
async def add_link(
    task_id: UUID,
    payload: TaskLinkCreate,
    current_user: CurrentUser,
    session: SessionDep,
) -> TaskOut:
    """Link two tasks. A `blocks` link puts the blocked task into `blocked`
    straight away (unless the blocker is already finished)."""
    task = await _require_task(session, current_user, task_id, write=True)
    other = await _require_task(session, current_user, payload.target_id)
    if other.id == task.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A task cannot link to itself")
    if other.workspace_id != task.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Tasks must be in the same workspace"
        )

    kind = LinkKind.RELATES if payload.kind == "relates" else LinkKind.BLOCKS
    source, target = (other, task) if payload.kind == "blocked_by" else (task, other)
    if await task_link_repo.find(session, source_id=source.id, target_id=target.id, kind=kind):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already linked")
    if kind == LinkKind.BLOCKS and await task_link_repo.find(
        session, source_id=target.id, target_id=source.id, kind=kind
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="These tasks already block each other the other way"
        )

    session.add(TaskLink(source_id=source.id, target_id=target.id, kind=kind))
    if (
        kind == LinkKind.BLOCKS
        and source.status not in task_link_repo.FINISHED
        and target.status in task_link_repo.OPEN
    ):
        target.status = TaskStatus.BLOCKED
    await session.commit()
    await session.refresh(task)
    return await _out(session, task)


@router.delete("/{task_id}/links/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_link(
    task_id: UUID, link_id: UUID, current_user: CurrentUser, session: SessionDep
) -> None:
    task = await _require_task(session, current_user, task_id, write=True)
    link = await task_link_repo.get(session, link_id=link_id)
    if link is None or task.id not in (link.source_id, link.target_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link not found")
    target_id, kind = link.target_id, link.kind
    await session.delete(link)
    await session.flush()
    if kind == LinkKind.BLOCKS:
        target = await task_repo.get_task(session, task_id=target_id)
        if target is not None:
            await task_link_repo.release_if_unblocked(session, target)
    await session.commit()
