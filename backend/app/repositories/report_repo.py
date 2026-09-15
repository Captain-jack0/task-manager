"""Workspace dashboard numbers. Everything is grouped SQL — no per-task loops."""

from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from sqlalchemy import Date, Subquery, and_, case, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sprint import Sprint
from app.models.task import Task, TaskStatus
from app.models.task_event import TaskEvent
from app.models.time_entry import TimeEntry
from app.models.user import User
from app.models.workspace import WorkspaceMember

FINISHED = (TaskStatus.DONE, TaskStatus.CLOSED)
FINISHED_VALUES = tuple(s.value for s in FINISHED)


@dataclass(frozen=True)
class DayPoint:
    day: date
    completed: int
    created: int


@dataclass(frozen=True)
class PersonRow:
    user_id: UUID
    email: str
    full_name: str | None
    open: int
    overdue: int
    completed: int
    estimated_open_minutes: int
    logged_minutes: int


@dataclass(frozen=True)
class SprintSnapshot:
    id: UUID
    name: str
    end_date: date
    total: int
    finished: int


@dataclass(frozen=True)
class Dashboard:
    days: int
    open: int
    overdue: int
    completed: int
    created: int
    by_status: dict[str, int] = field(default_factory=dict)
    per_day: list[DayPoint] = field(default_factory=list)
    people: list[PersonRow] = field(default_factory=list)
    active_sprint: SprintSnapshot | None = None


def _completed_events(workspace_id: UUID, start: datetime) -> Subquery:
    """Distinct (task_id, day) pairs where a task entered done/closed inside the window."""
    return (
        select(TaskEvent.task_id, cast(TaskEvent.created_at, Date).label("day"))
        .join(Task, Task.id == TaskEvent.task_id)
        .where(
            Task.workspace_id == workspace_id,
            TaskEvent.field == "status",
            TaskEvent.new_value.in_(FINISHED_VALUES),
            TaskEvent.created_at >= start,
        )
        .distinct()
        .subquery()
    )


async def dashboard(session: AsyncSession, *, workspace_id: UUID, days: int) -> Dashboard:
    now = datetime.now(UTC)
    start = (now - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)

    # --- status counts / open / overdue --------------------------------------
    rows = await session.execute(
        select(Task.status, func.count(Task.id))
        .where(Task.workspace_id == workspace_id)
        .group_by(Task.status)
    )
    by_status = {s.value: 0 for s in TaskStatus}
    for st, count in rows.all():
        by_status[st.value] = int(count)
    open_count = sum(v for k, v in by_status.items() if k not in FINISHED_VALUES)
    overdue = await session.scalar(
        select(func.count(Task.id)).where(
            Task.workspace_id == workspace_id,
            Task.status.not_in(FINISHED),
            Task.due_date.is_not(None),
            Task.due_date < now,
        )
    )

    # --- per day: completed (from the activity log) and created --------------
    done_sq = _completed_events(workspace_id, start)
    done_rows = await session.execute(select(done_sq.c.day, func.count()).group_by(done_sq.c.day))
    done_by_day = {d: int(c) for d, c in done_rows.all()}
    created_rows = await session.execute(
        select(cast(Task.created_at, Date), func.count(Task.id))
        .where(Task.workspace_id == workspace_id, Task.created_at >= start)
        .group_by(cast(Task.created_at, Date))
    )
    created_by_day = {d: int(c) for d, c in created_rows.all()}
    per_day = [
        DayPoint(day=d, completed=done_by_day.get(d, 0), created=created_by_day.get(d, 0))
        for d in (start.date() + timedelta(days=i) for i in range(days))
    ]

    # --- people -------------------------------------------------------------
    overdue_case = case((and_(Task.due_date.is_not(None), Task.due_date < now), 1), else_=0)
    load_rows = await session.execute(
        select(
            Task.assignee_id,
            func.count(Task.id),
            func.sum(overdue_case),
            func.coalesce(func.sum(Task.estimated_minutes), 0),
        )
        .where(
            Task.workspace_id == workspace_id,
            Task.status.not_in(FINISHED),
            Task.assignee_id.is_not(None),
        )
        .group_by(Task.assignee_id)
    )
    load = {uid: (int(n), int(od or 0), int(est or 0)) for uid, n, od, est in load_rows.all()}

    completed_rows = await session.execute(
        select(Task.assignee_id, func.count(func.distinct(done_sq.c.task_id)))
        .join(Task, Task.id == done_sq.c.task_id)
        .where(Task.assignee_id.is_not(None))
        .group_by(Task.assignee_id)
    )
    completed_by_user = {uid: int(c) for uid, c in completed_rows.all()}

    logged_rows = await session.execute(
        select(
            TimeEntry.user_id,
            func.sum(func.extract("epoch", TimeEntry.ended_at - TimeEntry.started_at)),
        )
        .join(Task, Task.id == TimeEntry.task_id)
        .where(
            Task.workspace_id == workspace_id,
            TimeEntry.ended_at.is_not(None),
            TimeEntry.started_at >= start,
        )
        .group_by(TimeEntry.user_id)
    )
    logged = {uid: int(round((secs or 0) / 60)) for uid, secs in logged_rows.all()}

    member_rows = await session.execute(
        select(User)
        .join(WorkspaceMember, WorkspaceMember.user_id == User.id)
        .where(WorkspaceMember.workspace_id == workspace_id)
        .order_by(User.email)
    )
    people = []
    for user in member_rows.scalars().all():
        n, od, est = load.get(user.id, (0, 0, 0))
        people.append(
            PersonRow(
                user_id=user.id,
                email=user.email,
                full_name=user.full_name,
                open=n,
                overdue=od,
                completed=completed_by_user.get(user.id, 0),
                estimated_open_minutes=est,
                logged_minutes=logged.get(user.id, 0),
            )
        )

    # --- active sprint --------------------------------------------------------
    today = now.date()
    sprint = (
        (
            await session.execute(
                select(Sprint)
                .where(
                    Sprint.workspace_id == workspace_id,
                    Sprint.closed_at.is_(None),
                    Sprint.start_date <= today,
                    Sprint.end_date >= today,
                )
                .order_by(Sprint.end_date.asc())
            )
        )
        .scalars()
        .first()
    )
    snapshot = None
    if sprint is not None:
        finished_case = case((Task.status.in_(FINISHED), 1), else_=0)
        total, finished = (
            await session.execute(
                select(func.count(Task.id), func.sum(finished_case)).where(
                    Task.sprint_id == sprint.id
                )
            )
        ).one()
        snapshot = SprintSnapshot(
            id=sprint.id,
            name=sprint.name,
            end_date=sprint.end_date,
            total=int(total or 0),
            finished=int(finished or 0),
        )

    return Dashboard(
        days=days,
        open=open_count,
        overdue=int(overdue or 0),
        completed=sum(p.completed for p in per_day),
        created=sum(p.created for p in per_day),
        by_status=by_status,
        per_day=per_day,
        people=people,
        active_sprint=snapshot,
    )
