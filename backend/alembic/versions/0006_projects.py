"""projects + tasks.project_id

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "workspace_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("color", sa.String(7), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_projects_workspace", "projects", ["workspace_id"])

    op.add_column("tasks", sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_tasks_project", "tasks", "projects", ["project_id"], ["id"], ondelete="SET NULL"
    )
    op.create_index("ix_task_project", "tasks", ["project_id"])


def downgrade() -> None:
    op.drop_index("ix_task_project", table_name="tasks")
    op.drop_constraint("fk_tasks_project", "tasks", type_="foreignkey")
    op.drop_column("tasks", "project_id")
    op.drop_index("ix_projects_workspace", table_name="projects")
    op.drop_table("projects")
