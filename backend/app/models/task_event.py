from uuid import UUID

from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class TaskEvent(Base, UUIDMixin, TimestampMixin):
    """One change on a task: which field, from what, to what, by whom.

    Values are stored raw (status codes, ids, ISO dates); clients render them
    with the names they already have. actor NULL = the system (blocker rules,
    recurrence)."""

    __tablename__ = "task_events"
    __table_args__ = (Index("ix_task_events_task", "task_id", "created_at"),)

    task_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    actor_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    field: Mapped[str] = mapped_column(String(40), nullable=False)
    old_value: Mapped[str | None] = mapped_column(String(200), nullable=True)
    new_value: Mapped[str | None] = mapped_column(String(200), nullable=True)
