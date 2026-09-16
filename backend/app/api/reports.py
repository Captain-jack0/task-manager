from uuid import UUID

from fastapi import APIRouter, Query

from app.api.access import resolve_workspace
from app.api.deps import CurrentUser, SessionDep
from app.repositories import report_repo
from app.schemas.report import DashboardOut, DayPointOut, PersonRowOut, SprintSnapshotOut

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/dashboard", response_model=DashboardOut)
async def dashboard(
    current_user: CurrentUser,
    session: SessionDep,
    workspace_id: UUID | None = None,
    days: int = Query(default=14, ge=1, le=90),
) -> DashboardOut:
    """Workspace overview: open / overdue / completed / created, a per-day series
    for the window, load per person, and the active sprint."""
    ws_id = await resolve_workspace(session, current_user, workspace_id)
    d = await report_repo.dashboard(session, workspace_id=ws_id, days=days)
    return DashboardOut(
        days=d.days,
        open=d.open,
        overdue=d.overdue,
        completed=d.completed,
        created=d.created,
        by_status=d.by_status,
        per_day=[
            DayPointOut(day=p.day, completed=p.completed, created=p.created) for p in d.per_day
        ],
        people=[
            PersonRowOut(
                user_id=p.user_id,
                email=p.email,
                full_name=p.full_name,
                open=p.open,
                overdue=p.overdue,
                completed=p.completed,
                estimated_open_minutes=p.estimated_open_minutes,
                logged_minutes=p.logged_minutes,
            )
            for p in d.people
        ],
        active_sprint=(
            SprintSnapshotOut(
                id=d.active_sprint.id,
                name=d.active_sprint.name,
                end_date=d.active_sprint.end_date,
                total=d.active_sprint.total,
                finished=d.active_sprint.finished,
            )
            if d.active_sprint
            else None
        ),
    )
