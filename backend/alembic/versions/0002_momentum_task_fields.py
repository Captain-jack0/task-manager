"""momentum task fields: estimated_minutes, energy_level, snooze_count

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-15

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    task_energy_enum = postgresql.ENUM(
        "low", "medium", "high", name="task_energy", create_type=False
    )
    task_energy_enum.create(op.get_bind(), checkfirst=True)

    op.add_column("tasks", sa.Column("estimated_minutes", sa.Integer(), nullable=True))
    op.add_column("tasks", sa.Column("energy_level", task_energy_enum, nullable=True))
    op.add_column(
        "tasks",
        sa.Column("snooze_count", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("tasks", "snooze_count")
    op.drop_column("tasks", "energy_level")
    op.drop_column("tasks", "estimated_minutes")
    op.execute("DROP TYPE IF EXISTS task_energy")
