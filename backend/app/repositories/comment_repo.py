from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.comment import Comment
from app.models.user import User


async def list_by_task(
    session: AsyncSession, *, task_id: UUID
) -> list[tuple[Comment, str]]:
    """Comments on a task, oldest first, with each author's email."""
    result = await session.execute(
        select(Comment, User.email)
        .join(User, User.id == Comment.author_id)
        .where(Comment.task_id == task_id)
        .order_by(Comment.created_at.asc())
    )
    return [(comment, email) for comment, email in result.all()]


async def get(session: AsyncSession, *, comment_id: UUID) -> Comment | None:
    return await session.get(Comment, comment_id)


async def create(
    session: AsyncSession, *, task_id: UUID, author_id: UUID, body: str
) -> Comment:
    comment = Comment(task_id=task_id, author_id=author_id, body=body)
    session.add(comment)
    await session.commit()
    await session.refresh(comment)
    return comment


async def delete(session: AsyncSession, *, comment: Comment) -> None:
    await session.delete(comment)
    await session.commit()
