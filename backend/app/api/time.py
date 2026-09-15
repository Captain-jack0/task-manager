from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.api.access import require_task, resolve_workspace
from app.api.deps import CurrentUser, SessionDep
from app.models.time_entry import TimeEntry
from app.repositories import task_repo, time_repo
from app.schemas.time import (
    RunningTimer,
    TaskTime,
    TimeEntryCreate,
    TimeEntryOut,
    TimeReport,
    TimeReportRow,
)

router = APIRouter(tags=["time"])


def _out(entry: TimeEntry, email: str | None = None, name: str | None = None) -> TimeEntryOut:
    return TimeEntryOut(
        id=entry.id,
        task_id=entry.task_id,
        user_id=entry.user_id,
        user_email=email,
        user_name=name,
        started_at=entry.started_at,
        ended_at=entry.ended_at,
        minutes=entry.minutes,
        note=entry.note,
    )


@router.post("/tasks/{task_id}/timer/start", response_model=TimeEntryOut)
async def start_timer(task_id: UUID, current_user: CurrentUser, session: SessionDep) -> TimeEntryOut:
    """Start working on a task. Any other timer of yours is stopped first."""
    await require_task(session, current_user, task_id, write=True)
    entry = await time_repo.start(session, task_id=task_id, user_id=current_user.id)
    return _out(entry, current_user.email, current_user.full_name)


@router.post("/tasks/{task_id}/timer/stop", response_model=TimeEntryOut)
async def stop_timer(task_id: UUID, current_user: CurrentUser, session: SessionDep) -> TimeEntryOut:
    await require_task(session, current_user, task_id, write=True)
    running = await time_repo.running_for_user(session, user_id=current_user.id)
    if running is None or running.task_id != task_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No timer running on this task")
    return _out(await time_repo.stop(session, entry=running), current_user.email, current_user.full_name)


@router.post("/tasks/{task_id}/time", response_model=TimeEntryOut, status_code=status.HTTP_201_CREATED)
async def log_time(
    task_id: UUID, payload: TimeEntryCreate, current_user: CurrentUser, session: SessionDep
) -> TimeEntryOut:
    await require_task(session, current_user, task_id, write=True)
    entry = await time_repo.add_manual(
        session,
        task_id=task_id,
        user_id=current_user.id,
        started_at=payload.started_at,
        ended_at=payload.ended_at,
        note=payload.note,
    )
    return _out(entry, current_user.email, current_user.full_name)


@router.get("/tasks/{task_id}/time", response_model=TaskTime)
async def task_time(task_id: UUID, current_user: CurrentUser, session: SessionDep) -> TaskTime:
    await require_task(session, current_user, task_id)
    rows = await time_repo.list_for_task(session, task_id=task_id)
    entries = [_out(e, email, name) for e, email, name in rows]
    running = next((e for e in entries if e.ended_at is None and e.user_id == current_user.id), None)
    return TaskTime(
        entries=entries,
        total_minutes=sum(e.minutes for e in entries),
        running=running,
    )


@router.delete("/time/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(entry_id: UUID, current_user: CurrentUser, session: SessionDep) -> None:
    entry = await time_repo.get(session, entry_id=entry_id)
    if entry is None or entry.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    await time_repo.delete(session, entry=entry)


@router.get("/time/running", response_model=RunningTimer | None)
async def running_timer(current_user: CurrentUser, session: SessionDep) -> RunningTimer | None:
    entry = await time_repo.running_for_user(session, user_id=current_user.id)
    if entry is None:
        return None
    task = await task_repo.get_task(session, task_id=entry.task_id)
    return RunningTimer(
        entry=_out(entry, current_user.email, current_user.full_name),
        task_title=task.title if task else "",
    )


@router.get("/time/report", response_model=TimeReport)
async def time_report(
    current_user: CurrentUser,
    session: SessionDep,
    start_at: datetime,
    end_at: datetime,
    workspace_id: UUID | None = None,
) -> TimeReport:
    """Finished minutes per task and person for entries started in [start_at, end_at)."""
    if end_at <= start_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="end_at must be after start_at")
    ws_id = await resolve_workspace(session, current_user, workspace_id)
    rows = await time_repo.report(session, workspace_id=ws_id, start_at=start_at, end_at=end_at)
    out = [
        TimeReportRow(
            task_id=r.task_id,
            task_title=r.task_title,
            user_id=r.user_id,
            user_email=r.user_email,
            user_name=r.user_name,
            minutes=r.minutes,
        )
        for r in rows
    ]
    return TimeReport(start_at=start_at, end_at=end_at, rows=out, total_minutes=sum(r.minutes for r in out))
