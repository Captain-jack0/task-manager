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
    data: bytes,
) -> Attachment:
    att = Attachment(
        task_id=task_id,
        uploader_id=uploader_id,
        filename=filename,
        content_type=content_type,
        size=len(data),
        data=data,
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


async def get(session: AsyncSession, *, attachment_id: UUID, with_data: bool = False) -> Attachment | None:
    stmt = select(Attachment).where(Attachment.id == attachment_id)
    if with_data:
        stmt = stmt.options(undefer(Attachment.data))
    return (await session.execute(stmt)).scalar_one_or_none()


async def delete(session: AsyncSession, *, attachment: Attachment) -> None:
    await session.delete(attachment)
    await session.flush()
