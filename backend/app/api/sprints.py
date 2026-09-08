from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.access import _ensure_not_guest, resolve_workspace
from app.api.deps import CurrentUser, SessionDep
from app.models.sprint import Sprint
from app.models.user import User
from app.repositories import sprint_repo, workspace_repo
from app.schemas.sprint import SprintCreate, SprintOut, SprintUpdate

router = APIRouter(prefix="/sprints", tags=["sprints"])


async def _require_sprint(
    session: AsyncSession, user: User, sprint_id: UUID, *, write: bool = False
) -> Sprint:
    sprint = await sprint_repo.get(session, sprint_id=sprint_id)
    if sprint is None or not await workspace_repo.is_member(
        session, workspace_id=sprint.workspace_id, user_id=user.id
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint not found")
    if write:
        await _ensure_not_guest(session, workspace_id=sprint.workspace_id, user_id=user.id)
    return sprint


def _out(sprint: Sprint, counts: dict[UUID, tuple[int, int]] | None = None) -> SprintOut:
    total, done = (counts or {}).get(sprint.id, (0, 0))
    return SprintOut.model_validate(sprint).model_copy(
        update={"task_count": total, "done_count": done}
    )


@router.get("", response_model=list[SprintOut])
async def list_sprints(
    current_user: CurrentUser,
    session: SessionDep,
    workspace_id: UUID | None = None,
) -> list[SprintOut]:
    ws_id = await resolve_workspace(session, current_user, workspace_id)
    sprints = await sprint_repo.list_by_workspace(session, workspace_id=ws_id)
    counts = await sprint_repo.task_counts(session, workspace_id=ws_id)
    return [_out(s, counts) for s in sprints]


@router.post("", response_model=SprintOut, status_code=status.HTTP_201_CREATED)
async def create_sprint(
    payload: SprintCreate,
    current_user: CurrentUser,
    session: SessionDep,
    workspace_id: UUID | None = None,
) -> SprintOut:
    ws_id = await resolve_workspace(session, current_user, workspace_id, write=True)
    sprint = await sprint_repo.create(
        session,
        workspace_id=ws_id,
        name=payload.name,
        goal=payload.goal,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    return _out(sprint)


@router.put("/{sprint_id}", response_model=SprintOut)
async def update_sprint(
    sprint_id: UUID,
    payload: SprintUpdate,
    current_user: CurrentUser,
    session: SessionDep,
) -> SprintOut:
    sprint = await _require_sprint(session, current_user, sprint_id, write=True)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(sprint, key, value)
    if sprint.end_date < sprint.start_date:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_date must be on or after start_date",
        )
    updated = await sprint_repo.update(session, sprint=sprint)
    counts = await sprint_repo.task_counts(session, workspace_id=updated.workspace_id)
    return _out(updated, counts)


@router.delete("/{sprint_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sprint(
    sprint_id: UUID, current_user: CurrentUser, session: SessionDep
) -> None:
    sprint = await _require_sprint(session, current_user, sprint_id, write=True)
    await sprint_repo.delete(session, sprint=sprint)
