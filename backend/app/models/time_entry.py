from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class TimeEntry(Base, UUIDMixin, TimestampMixin):
    """Time one user spent on one task. ended_at NULL = the timer is running.
    A user has at most one running entry at a time."""

    __tablename__ = "time_entries"
    __table_args__ = (
        Index("ix_time_entries_task", "task_id"),
        Index("ix_time_entries_user_running", "user_id", "ended_at"),
    )

    task_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    note: Mapped[str | None] = mapped_column(String(200), nullable=True)

    @property
    def minutes(self) -> int:
        if self.ended_at is None:
            return 0
        return max(0, round((self.ended_at - self.started_at).total_seconds() / 60))
