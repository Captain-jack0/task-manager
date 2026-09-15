from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task
from app.models.time_entry import TimeEntry
from app.models.user import User


async def running_for_user(session: AsyncSession, *, user_id: UUID) -> TimeEntry | None:
    result = await session.execute(
        select(TimeEntry).where(TimeEntry.user_id == user_id, TimeEntry.ended_at.is_(None))
    )
    return result.scalars().first()


async def start(session: AsyncSession, *, task_id: UUID, user_id: UUID) -> TimeEntry:
    """Start a timer on `task_id`; any timer this user still has running is stopped first."""
    now = datetime.now(UTC)
    current = await running_for_user(session, user_id=user_id)
    if current is not None:
        if current.task_id == task_id:
            return current
        current.ended_at = now
    entry = TimeEntry(task_id=task_id, user_id=user_id, started_at=now)
    session.add(entry)
    await session.commit()
    await session.refresh(entry)
    return entry


async def stop(session: AsyncSession, *, entry: TimeEntry) -> TimeEntry:
    if entry.ended_at is None:
        entry.ended_at = datetime.now(UTC)
        await session.commit()
        await session.refresh(entry)
    return entry


async def add_manual(
    session: AsyncSession,
    *,
    task_id: UUID,
    user_id: UUID,
    started_at: datetime,
    ended_at: datetime,
    note: str | None,
) -> TimeEntry:
    entry = TimeEntry(
        task_id=task_id, user_id=user_id, started_at=started_at, ended_at=ended_at, note=note
    )
    session.add(entry)
    await session.commit()
    await session.refresh(entry)
    return entry


async def get(session: AsyncSession, *, entry_id: UUID) -> TimeEntry | None:
    return await session.get(TimeEntry, entry_id)


async def delete(session: AsyncSession, *, entry: TimeEntry) -> None:
    await session.delete(entry)
    await session.commit()


async def list_for_task(
    session: AsyncSession, *, task_id: UUID
) -> Sequence[tuple[TimeEntry, str, str | None]]:
    result = await session.execute(
        select(TimeEntry, User.email, User.full_name)
        .join(User, User.id == TimeEntry.user_id)
        .where(TimeEntry.task_id == task_id)
        .order_by(TimeEntry.started_at.desc())
    )
    return [(e, email, name) for e, email, name in result.all()]


_SECONDS = func.extract("epoch", TimeEntry.ended_at - TimeEntry.started_at)


async def logged_minutes(session: AsyncSession, *, task_ids: Sequence[UUID]) -> dict[UUID, int]:
    """Finished minutes per task (running timers excluded), one grouped query."""
    if not task_ids:
        return {}
    result = await session.execute(
        select(TimeEntry.task_id, func.sum(_SECONDS))
        .where(TimeEntry.task_id.in_(task_ids), TimeEntry.ended_at.is_not(None))
        .group_by(TimeEntry.task_id)
    )
    return {tid: int(round((secs or 0) / 60)) for tid, secs in result.all()}


@dataclass(frozen=True)
class ReportRow:
    task_id: UUID
    task_title: str
    user_id: UUID
    user_email: str
    user_name: str | None
    minutes: int


async def report(
    session: AsyncSession, *, workspace_id: UUID, start_at: datetime, end_at: datetime
) -> list[ReportRow]:
    """Finished time per (task, user) that started inside [start_at, end_at)."""
    result = await session.execute(
        select(
            Task.id,
            Task.title,
            User.id,
            User.email,
            User.full_name,
            func.sum(_SECONDS),
        )
        .join(Task, Task.id == TimeEntry.task_id)
        .join(User, User.id == TimeEntry.user_id)
        .where(
            Task.workspace_id == workspace_id,
            TimeEntry.ended_at.is_not(None),
            TimeEntry.started_at >= start_at,
            TimeEntry.started_at < end_at,
        )
        .group_by(Task.id, Task.title, User.id, User.email, User.full_name)
        .order_by(func.sum(_SECONDS).desc())
    )
    return [
        ReportRow(tid, title, uid, email, name, int(round((secs or 0) / 60)))
        for tid, title, uid, email, name, secs in result.all()
    ]
