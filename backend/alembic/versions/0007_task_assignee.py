"""tasks.assignee_id

Revision ID: 0007
Revises: 0006
Create Date: 2026-07-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("assignee_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_tasks_assignee", "tasks", "users", ["assignee_id"], ["id"], ondelete="SET NULL"
    )
    op.create_index("ix_task_assignee", "tasks", ["assignee_id"])


def downgrade() -> None:
    op.drop_index("ix_task_assignee", table_name="tasks")
    op.drop_constraint("fk_tasks_assignee", "tasks", type_="foreignkey")
    op.drop_column("tasks", "assignee_id")
