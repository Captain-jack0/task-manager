from uuid import UUID

from sqlalchemy import ForeignKey, Index, Integer, LargeBinary, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, deferred, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin

# Cap for files kept in Postgres (no S3_BUCKET configured). With object storage
# the cap is ATTACHMENT_MAX_MB from settings.
MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024


class Attachment(Base, UUIDMixin, TimestampMixin):
    """One file on a task. Bytes live either in object storage (`storage_key`)
    or, when none is configured, inline in `data` — exactly one of the two is set."""

    __tablename__ = "attachments"
    __table_args__ = (Index("ix_attachments_task", "task_id"),)

    task_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    uploader_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(120), nullable=False)
    size: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_key: Mapped[str | None] = mapped_column(String(300), nullable=True)
    # Deferred: listing attachments never pulls the bytes; only the download does.
    data: Mapped[bytes | None] = deferred(mapped_column(LargeBinary, nullable=True))
