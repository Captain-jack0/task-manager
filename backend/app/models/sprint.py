from datetime import date, datetime
from uuid import UUID

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class Sprint(Base, UUIDMixin, TimestampMixin):
    """A time-boxed iteration within a workspace. A task belongs to at most
    one sprint; tasks without one are the backlog."""

    __tablename__ = "sprints"

    workspace_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    goal: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    # Set when the sprint is completed. A closed sprint is history: its
    # unfinished tasks were carried over and no new task can join it.
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # How many unfinished tasks were moved out when the sprint was completed.
    carried_over: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0", default=0)
