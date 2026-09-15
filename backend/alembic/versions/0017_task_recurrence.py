"""tasks.recurrence

Revision ID: 0017
Revises: 0016
Create Date: 2026-09-15
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    rule = postgresql.ENUM(
        "daily", "weekly", "biweekly", "monthly", name="task_recurrence", create_type=False
    )
    rule.create(op.get_bind(), checkfirst=True)
    op.add_column("tasks", sa.Column("recurrence", rule, nullable=True))


def downgrade() -> None:
    op.drop_column("tasks", "recurrence")
    postgresql.ENUM(name="task_recurrence").drop(op.get_bind(), checkfirst=True)
