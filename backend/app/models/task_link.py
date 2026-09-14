from enum import Enum
from uuid import UUID

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class LinkKind(str, Enum):
    """`blocks`: source must finish before target can start. `relates`: symmetric."""

    BLOCKS = "blocks"
    RELATES = "relates"


class TaskLink(Base, UUIDMixin, TimestampMixin):
    """A directed edge between two tasks of the same workspace."""

    __tablename__ = "task_links"
    __table_args__ = (
        UniqueConstraint("source_id", "target_id", "kind", name="uq_task_link"),
        Index("ix_task_link_source", "source_id"),
        Index("ix_task_link_target", "target_id"),
    )

    source_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    target_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[LinkKind] = mapped_column(
        SAEnum(LinkKind, name="task_link_kind", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
