"""task_links (blocks / relates)

Revision ID: 0011
Revises: 0010
Create Date: 2026-09-13
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    kind = postgresql.ENUM("blocks", "relates", name="task_link_kind", create_type=False)
    kind.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "task_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "source_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "target_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", kind, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("source_id", "target_id", "kind", name="uq_task_link"),
    )
    op.create_index("ix_task_link_source", "task_links", ["source_id"])
    op.create_index("ix_task_link_target", "task_links", ["target_id"])


def downgrade() -> None:
    op.drop_index("ix_task_link_target", table_name="task_links")
    op.drop_index("ix_task_link_source", table_name="task_links")
    op.drop_table("task_links")
    postgresql.ENUM(name="task_link_kind").drop(op.get_bind(), checkfirst=True)
