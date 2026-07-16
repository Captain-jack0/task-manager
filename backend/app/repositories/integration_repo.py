from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import encrypt_secret
from app.models.integration import GithubIntegration


async def get_github(
    session: AsyncSession, *, user_id: UUID
) -> GithubIntegration | None:
    result = await session.execute(
        select(GithubIntegration).where(GithubIntegration.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def upsert_github(
    session: AsyncSession, *, user_id: UUID, token: str, repo: str
) -> GithubIntegration:
    encrypted = encrypt_secret(token)
    integration = await get_github(session, user_id=user_id)
    if integration is None:
        integration = GithubIntegration(user_id=user_id, token=encrypted, repo=repo)
        session.add(integration)
    else:
        integration.token = encrypted
        integration.repo = repo
    await session.commit()
    await session.refresh(integration)
    return integration


async def delete_github(session: AsyncSession, *, user_id: UUID) -> None:
    await session.execute(
        delete(GithubIntegration).where(GithubIntegration.user_id == user_id)
    )
    await session.commit()
