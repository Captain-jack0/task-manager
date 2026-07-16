"""add 'blocked' and 'closed' to task_status enum

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-16
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE must run outside a transaction block.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'blocked' AFTER 'in_progress'")
        op.execute("ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'closed' AFTER 'done'")


def downgrade() -> None:
    # PostgreSQL cannot drop a value from an enum without recreating the type
    # and rewriting every column that uses it; left as a no-op on purpose.
    pass
