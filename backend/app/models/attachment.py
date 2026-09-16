from uuid import UUID

from sqlalchemy import ForeignKey, Index, Integer, LargeBinary, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, deferred, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin

# ponytail: files live in Postgres (bytea) with a small cap — no object storage
# to configure. Move to S3/R2 with a URL column if uploads grow past a few MB.
MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024


class Attachment(Base, UUIDMixin, TimestampMixin):
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
    # Deferred: listing attachments never pulls the bytes; only the download does.
    data: Mapped[bytes] = deferred(mapped_column(LargeBinary, nullable=False))
