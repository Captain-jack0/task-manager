from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from uuid import UUID

from sqlalchemy import case, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sprint import Sprint
from app.models.task import Task, TaskStatus
from app.models.task_event import TaskEvent
from app.repositories import activity_repo

FINISHED = (TaskStatus.DONE.value, TaskStatus.CLOSED.value)


async def list_by_workspace(session: AsyncSession, *, workspace_id: UUID) -> Sequence[Sprint]:
    result = await session.execute(
        select(Sprint)
        .where(Sprint.workspace_id == workspace_id)
        .order_by(Sprint.start_date.desc(), Sprint.created_at.desc())
    )
    return result.scalars().all()


async def get(session: AsyncSession, *, sprint_id: UUID) -> Sprint | None:
    result = await session.execute(select(Sprint).where(Sprint.id == sprint_id))
    return result.scalar_one_or_none()


async def create(
    session: AsyncSession,
    *,
    workspace_id: UUID,
    name: str,
    goal: str | None,
    start_date: date,
    end_date: date,
) -> Sprint:
    sprint = Sprint(
        workspace_id=workspace_id,
        name=name,
        goal=goal,
        start_date=start_date,
        end_date=end_date,
    )
    session.add(sprint)
    await session.commit()
    await session.refresh(sprint)
    return sprint


async def update_sprint(session: AsyncSession, *, sprint: Sprint) -> Sprint:
    await session.commit()
    await session.refresh(sprint)
    return sprint


async def delete(session: AsyncSession, *, sprint: Sprint) -> None:
    await session.delete(sprint)
    await session.commit()


async def close(
    session: AsyncSession, *, sprint: Sprint, move_to: UUID | None, actor_id: UUID | None = None
) -> tuple[int, int]:
    """Complete a sprint: every task that is not `closed` is carried over to
    `move_to` (or the backlog); closed tasks stay behind as history.
    Returns (moved, kept)."""
    unfinished = (Task.sprint_id == sprint.id) & (Task.status != TaskStatus.CLOSED)
    now = datetime.now(UTC)
    moved_ids = (await session.execute(select(Task.id).where(unfinished))).scalars().all()
    for tid in moved_ids:
        # Stamped exactly at closed_at so the burndown can stop just before the move.
        event = await activity_repo.record(
            session,
            task_id=tid,
            actor_id=actor_id,
            field="sprint_id",
            old_value=sprint.id,
            new_value=move_to,
        )
        event.created_at = now
    await session.execute(update(Task).where(unfinished).values(sprint_id=move_to))
    kept = await session.scalar(select(func.count(Task.id)).where(Task.sprint_id == sprint.id))
    moved = len(moved_ids)
    sprint.closed_at = now
    sprint.carried_over = int(moved or 0)
    await session.commit()
    await session.refresh(sprint)
    return int(moved or 0), int(kept or 0)


async def task_counts(session: AsyncSession, *, workspace_id: UUID) -> dict[UUID, tuple[int, int]]:
    """{sprint_id: (total, finished)} for every sprint in the workspace that has tasks."""
    finished = case((Task.status.in_([TaskStatus.DONE, TaskStatus.CLOSED]), 1), else_=0)
    result = await session.execute(
        select(Task.sprint_id, func.count(Task.id), func.sum(finished))
        .where(Task.workspace_id == workspace_id, Task.sprint_id.is_not(None))
        .group_by(Task.sprint_id)
    )
    return {sid: (int(total), int(done or 0)) for sid, total, done in result.all()}


@dataclass(frozen=True)
class SprintReportData:
    by_status: dict[str, int]
    total: int
    finished: int
    estimated_minutes: int
    estimated_minutes_finished: int


async def report(session: AsyncSession, *, sprint: Sprint) -> SprintReportData:
    """Task counts and estimated minutes per status for one sprint."""
    rows = await session.execute(
        select(Task.status, func.count(Task.id), func.coalesce(func.sum(Task.estimated_minutes), 0))
        .where(Task.sprint_id == sprint.id)
        .group_by(Task.status)
    )
    by_status = {s.value: 0 for s in TaskStatus}
    minutes = {s.value: 0 for s in TaskStatus}
    for st, count, mins in rows.all():
        by_status[st.value] = int(count)
        minutes[st.value] = int(mins or 0)
    finished = (TaskStatus.DONE.value, TaskStatus.CLOSED.value)
    return SprintReportData(
        by_status=by_status,
        total=sum(by_status.values()),
        finished=sum(by_status[s] for s in finished),
        estimated_minutes=sum(minutes.values()),
        estimated_minutes_finished=sum(minutes[s] for s in finished),
    )


@dataclass(frozen=True)
class BurndownPoint:
    day: date
    remaining: int | None  # None = not measured yet (future day)
    ideal: float


def _value_at(events: list[TaskEvent], current: str | None, at: datetime) -> str | None:
    """Field value just before `at`, replayed from the log (events sorted by created_at)."""
    if not events:
        return current
    if events[0].created_at >= at:
        return events[0].old_value
    last = None
    for e in events:
        if e.created_at >= at:
            break
        last = e
    return last.new_value if last else current


async def burndown(session: AsyncSession, *, sprint: Sprint) -> list[BurndownPoint]:
    """Remaining (unfinished) tasks at the end of each sprint day, replayed from
    task_events, next to a straight ideal line. Days after today / the close are
    left unmeasured."""
    sid = str(sprint.id)
    ids_now = select(Task.id).where(Task.sprint_id == sprint.id)
    ids_ever = select(TaskEvent.task_id).where(
        TaskEvent.field == "sprint_id", or_(TaskEvent.old_value == sid, TaskEvent.new_value == sid)
    )
    tasks = (
        (
            await session.execute(
                select(Task).where(or_(Task.id.in_(ids_now), Task.id.in_(ids_ever)))
            )
        )
        .scalars()
        .all()
    )
    task_ids = [t.id for t in tasks]
    events: dict[tuple[UUID, str], list[TaskEvent]] = {}
    if task_ids:
        rows = await session.execute(
            select(TaskEvent)
            .where(TaskEvent.task_id.in_(task_ids), TaskEvent.field.in_(("status", "sprint_id")))
            .order_by(TaskEvent.created_at.asc())
        )
        for e in rows.scalars().all():
            events.setdefault((e.task_id, e.field), []).append(e)

    now = datetime.now(UTC)
    last_measured = min(
        sprint.end_date, now.date(), sprint.closed_at.date() if sprint.closed_at else now.date()
    )
    n_days = (sprint.end_date - sprint.start_date).days + 1
    days = [sprint.start_date + timedelta(days=i) for i in range(max(n_days, 1))]

    in_sprint: list[int] = []
    remaining: list[int | None] = []
    for day in days:
        if day > last_measured:
            remaining.append(None)
            continue
        cutoff = datetime.combine(day + timedelta(days=1), time.min, tzinfo=UTC)
        if sprint.closed_at and sprint.closed_at < cutoff:
            cutoff = sprint.closed_at  # state right before the carry-over
        members = [
            t
            for t in tasks
            if t.created_at < cutoff
            and _value_at(
                events.get((t.id, "sprint_id"), []),
                str(t.sprint_id) if t.sprint_id else None,
                cutoff,
            )
            == sid
        ]
        in_sprint.append(len(members))
        remaining.append(
            sum(
                1
                for t in members
                if _value_at(events.get((t.id, "status"), []), t.status.value, cutoff)
                not in FINISHED
            )
        )
    scope = max(in_sprint) if in_sprint else len(tasks)
    span = max(len(days) - 1, 1)
    return [
        BurndownPoint(day=d, remaining=r, ideal=round(scope * (1 - i / span), 1))
        for i, (d, r) in enumerate(zip(days, remaining, strict=True))
    ]
