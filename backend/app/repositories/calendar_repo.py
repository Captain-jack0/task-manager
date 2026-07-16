import secrets
from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task
from app.models.user import User

# 32 bytes → 256-bit, ~43 url-safe chars. Infeasible to guess, so the feed
# endpoint can be unauthenticated (the token is the credential).
_TOKEN_BYTES = 32
# Bound the feed so a huge history can't blow up a single response.
_FEED_LIMIT = 1000


async def get_user_by_calendar_token(
    session: AsyncSession, *, token: str
) -> User | None:
    if not token:
        return None
    result = await session.execute(select(User).where(User.calendar_token == token))
    return result.scalar_one_or_none()


async def ensure_calendar_token(session: AsyncSession, *, user: User) -> str:
    """Return the user's feed token, minting one on first use."""
    if not user.calendar_token:
        user.calendar_token = secrets.token_urlsafe(_TOKEN_BYTES)
        await session.commit()
        await session.refresh(user)
    return user.calendar_token


async def rotate_calendar_token(session: AsyncSession, *, user: User) -> str:
    """Issue a fresh token, invalidating any previously shared feed URL."""
    user.calendar_token = secrets.token_urlsafe(_TOKEN_BYTES)
    await session.commit()
    await session.refresh(user)
    return user.calendar_token


async def tasks_for_calendar(
    session: AsyncSession, *, user_id: UUID
) -> Sequence[Task]:
    """Dated tasks the user owns or is assigned — the 'my calendar' set."""
    result = await session.execute(
        select(Task)
        .where(
            Task.due_date.is_not(None),
            or_(Task.user_id == user_id, Task.assignee_id == user_id),
        )
        .order_by(Task.due_date.asc())
        .limit(_FEED_LIMIT)
    )
    return result.scalars().unique().all()
