from uuid import UUID

from fastapi import APIRouter

from app.api.access import require_task
from app.api.deps import CurrentUser, SessionDep
from app.repositories import activity_repo
from app.schemas.activity import ActivityActor, TaskEventOut

router = APIRouter(prefix="/tasks", tags=["activity"])


@router.get("/{task_id}/activity", response_model=list[TaskEventOut])
async def task_activity(
    task_id: UUID, current_user: CurrentUser, session: SessionDep
) -> list[TaskEventOut]:
    await require_task(session, current_user, task_id)
    rows = await activity_repo.list_for_task(session, task_id=task_id)
    return [
        TaskEventOut(
            id=e.id,
            field=e.field,
            old_value=e.old_value,
            new_value=e.new_value,
            actor=(
                ActivityActor(id=e.actor_id, email=email, full_name=name)
                if e.actor_id is not None and email is not None
                else None
            ),
            created_at=e.created_at,
        )
        for e, email, name in rows
    ]
