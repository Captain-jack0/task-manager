from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentUser, SessionDep
from app.models.task import Task, TaskStatus
from app.repositories import tag_repo, task_repo
from app.schemas.task import TaskCreate, TaskListResponse, TaskOut, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"])


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
    status_filter: TaskStatus | None = Query(default=None, alias="status"),
    tag_id: UUID | None = None,
    search: str | None = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
) -> TaskListResponse:
    rows, total = await task_repo.list_tasks(
        session,
        user_id=current_user.id,
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
    payload: TaskCreate, current_user: CurrentUser, session: SessionDep
) -> TaskOut:
    tags = await _resolve_tags(session, tag_ids=payload.tag_ids, user_id=current_user.id)
    task = Task(
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        status=payload.status,
        priority=payload.priority,
        due_date=payload.due_date,
    )
    created = await task_repo.create_task(session, task=task, tags=tags)
    return TaskOut.model_validate(created)


@router.get("/{task_id}", response_model=TaskOut)
async def get_task(
    task_id: UUID, current_user: CurrentUser, session: SessionDep
) -> TaskOut:
    task = await task_repo.get_task(session, task_id=task_id, user_id=current_user.id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return TaskOut.model_validate(task)


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: UUID,
    payload: TaskUpdate,
    current_user: CurrentUser,
    session: SessionDep,
) -> TaskOut:
    task = await task_repo.get_task(session, task_id=task_id, user_id=current_user.id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

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


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: UUID, current_user: CurrentUser, session: SessionDep
) -> None:
    task = await task_repo.get_task(session, task_id=task_id, user_id=current_user.id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    await task_repo.delete_task(session, task=task)
