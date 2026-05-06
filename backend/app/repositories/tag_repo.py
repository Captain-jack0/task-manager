from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tag import Tag


async def list_tags(session: AsyncSession, *, user_id: UUID) -> Sequence[Tag]:
    result = await session.execute(
        select(Tag).where(Tag.user_id == user_id).order_by(Tag.name)
    )
    return result.scalars().all()


async def get_tag(session: AsyncSession, *, tag_id: UUID, user_id: UUID) -> Tag | None:
    result = await session.execute(
        select(Tag).where(Tag.id == tag_id, Tag.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def get_tags_by_ids(
    session: AsyncSession, *, tag_ids: Sequence[UUID], user_id: UUID
) -> list[Tag]:
    if not tag_ids:
        return []
    result = await session.execute(
        select(Tag).where(Tag.id.in_(tag_ids), Tag.user_id == user_id)
    )
    return list(result.scalars().all())


async def create_tag(
    session: AsyncSession, *, user_id: UUID, name: str, color: str | None
) -> Tag:
    tag = Tag(user_id=user_id, name=name, color=color)
    session.add(tag)
    await session.commit()
    await session.refresh(tag)
    return tag


async def update_tag(
    session: AsyncSession,
    *,
    tag: Tag,
    name: str | None,
    color: str | None,
) -> Tag:
    if name is not None:
        tag.name = name
    if color is not None:
        tag.color = color
    await session.commit()
    await session.refresh(tag)
    return tag


async def delete_tag(session: AsyncSession, *, tag: Tag) -> None:
    await session.delete(tag)
    await session.commit()
