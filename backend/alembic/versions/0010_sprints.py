"""sprints + tasks.sprint_id

Revision ID: 0010
Revises: 0009
Create Date: 2026-09-08
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sprints",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "workspace_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("goal", sa.Text(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_sprints_workspace", "sprints", ["workspace_id"])

    op.add_column("tasks", sa.Column("sprint_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_tasks_sprint", "tasks", "sprints", ["sprint_id"], ["id"], ondelete="SET NULL"
    )
    op.create_index("ix_task_sprint", "tasks", ["sprint_id"])


def downgrade() -> None:
    op.drop_index("ix_task_sprint", table_name="tasks")
    op.drop_constraint("fk_tasks_sprint", "tasks", type_="foreignkey")
    op.drop_column("tasks", "sprint_id")
    op.drop_index("ix_sprints_workspace", table_name="sprints")
    op.drop_table("sprints")
