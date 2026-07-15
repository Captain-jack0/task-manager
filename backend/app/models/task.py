from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, Integer
from sqlalchemy import Enum as SAEnum
from sqlalchemy import String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin
from app.models.task_tag import task_tags

if TYPE_CHECKING:
    from app.models.tag import Tag
    from app.models.user import User


class TaskStatus(str, Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"


class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class TaskEnergy(str, Enum):
    """Mental effort a task needs — used by the 'What should I do now?' engine."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Task(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "tasks"
    __table_args__ = (
        Index("ix_task_user_status", "user_id", "status"),
        Index("ix_task_user_due", "user_id", "due_date"),
    )

    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[TaskStatus] = mapped_column(
        # values_callable makes SQLAlchemy use the enum .value ("todo") rather
        # than its .name ("TODO"); the Postgres task_status enum stores the
        # lowercase values, so without this reads/filters raise
        # InvalidTextRepresentationError.
        SAEnum(TaskStatus, name="task_status", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        default=TaskStatus.TODO,
    )
    priority: Mapped[TaskPriority] = mapped_column(
        SAEnum(TaskPriority, name="task_priority", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        default=TaskPriority.MEDIUM,
    )
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # --- Momentum core fields ---
    # Estimated effort in minutes (null = unknown).
    estimated_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Mental energy the task demands (null = unspecified).
    energy_level: Mapped[TaskEnergy | None] = mapped_column(
        SAEnum(TaskEnergy, name="task_energy", values_callable=lambda e: [m.value for m in e]),
        nullable=True,
    )
    # How many times the task has been pushed to a later day (procrastination signal).
    snooze_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0", default=0
    )

    user: Mapped["User"] = relationship(back_populates="tasks")
    tags: Mapped[list["Tag"]] = relationship(
        secondary=task_tags, back_populates="tasks", lazy="selectin"
    )
