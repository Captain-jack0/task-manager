from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import undefer

from app.models.attachment import Attachment
from app.models.user import User


async def create(
    session: AsyncSession,
    *,
    task_id: UUID,
    uploader_id: UUID,
    filename: str,
    content_type: str,
    size: int,
    data: bytes | None = None,
    storage_key: str | None = None,
) -> Attachment:
    att = Attachment(
        task_id=task_id,
        uploader_id=uploader_id,
        filename=filename,
        content_type=content_type,
        size=size,
        data=data,
        storage_key=storage_key,
    )
    session.add(att)
    await session.flush()
    return att


async def list_by_task(
    session: AsyncSession, *, task_id: UUID
) -> Sequence[tuple[Attachment, str | None, str | None]]:
    """Metadata only (bytes stay deferred), with the uploader's email and name."""
    result = await session.execute(
        select(Attachment, User.email, User.full_name)
        .outerjoin(User, User.id == Attachment.uploader_id)
        .where(Attachment.task_id == task_id)
        .order_by(Attachment.created_at.asc())
    )
    return [(a, email, name) for a, email, name in result.all()]


async def get(
    session: AsyncSession, *, attachment_id: UUID, with_data: bool = False
) -> Attachment | None:
    stmt = select(Attachment).where(Attachment.id == attachment_id)
    if with_data:
        stmt = stmt.options(undefer(Attachment.data))
    return (await session.execute(stmt)).scalar_one_or_none()


async def storage_keys_for_tasks(session: AsyncSession, *, task_ids: Sequence[UUID]) -> list[str]:
    """Object keys to remove from the bucket when these tasks are deleted (the rows cascade)."""
    if not task_ids:
        return []
    result = await session.execute(
        select(Attachment.storage_key).where(
            Attachment.task_id.in_(task_ids), Attachment.storage_key.is_not(None)
        )
    )
    return [k for k in result.scalars().all() if k]


async def delete(session: AsyncSession, *, attachment: Attachment) -> None:
    await session.delete(attachment)
    await session.flush()
