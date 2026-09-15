from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification, NotificationKind


async def add(
    session: AsyncSession,
    *,
    user_id: UUID,
    kind: NotificationKind,
    message: str,
    task_id: UUID | None = None,
    actor_id: UUID | None = None,
) -> Notification:
    """Queue a notification in the current transaction (the caller commits)."""
    note = Notification(
        user_id=user_id, kind=kind, message=message[:300], task_id=task_id, actor_id=actor_id
    )
    session.add(note)
    return note


async def list_for_user(
    session: AsyncSession, *, user_id: UUID, unread_only: bool = False, limit: int = 50
) -> Sequence[Notification]:
    stmt = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        stmt = stmt.where(Notification.read_at.is_(None))
    result = await session.execute(stmt.order_by(Notification.created_at.desc()).limit(limit))
    return result.scalars().all()


async def unread_count(session: AsyncSession, *, user_id: UUID) -> int:
    count = await session.scalar(
        select(func.count(Notification.id)).where(
            Notification.user_id == user_id, Notification.read_at.is_(None)
        )
    )
    return int(count or 0)


async def get_for_user(
    session: AsyncSession, *, user_id: UUID, notification_id: UUID
) -> Notification | None:
    note = await session.get(Notification, notification_id)
    return note if note is not None and note.user_id == user_id else None


async def mark_read(session: AsyncSession, *, note: Notification) -> Notification:
    if note.read_at is None:
        note.read_at = datetime.now(UTC)
        await session.commit()
        await session.refresh(note)
    return note


async def mark_all_read(session: AsyncSession, *, user_id: UUID) -> None:
    await session.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.read_at.is_(None))
        .values(read_at=datetime.now(UTC))
    )
    await session.commit()
