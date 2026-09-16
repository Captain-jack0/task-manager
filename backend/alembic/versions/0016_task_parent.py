"""tasks.parent_id (subtasks, one level)

Revision ID: 0016
Revises: 0015
Create Date: 2026-09-15
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("parent_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_tasks_parent", "tasks", "tasks", ["parent_id"], ["id"], ondelete="CASCADE"
    )
    op.create_index("ix_task_parent", "tasks", ["parent_id"])


def downgrade() -> None:
    op.drop_index("ix_task_parent", table_name="tasks")
    op.drop_constraint("fk_tasks_parent", "tasks", type_="foreignkey")
    op.drop_column("tasks", "parent_id")
