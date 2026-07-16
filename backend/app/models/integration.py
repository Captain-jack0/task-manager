from uuid import UUID

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class GithubIntegration(Base, UUIDMixin, TimestampMixin):
    """A user's GitHub connection: a personal access token and target repo.

    One row per user. The token is a secret — it is stored server-side and is
    NEVER returned by any API response (only `connected` + `repo` are exposed).
    """

    __tablename__ = "github_integrations"

    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    repo: Mapped[str] = mapped_column(String(140), nullable=False)  # "owner/repo"
    token: Mapped[str] = mapped_column(String(255), nullable=False)
