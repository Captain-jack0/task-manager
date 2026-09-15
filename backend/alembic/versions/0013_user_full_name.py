"""users.full_name

Revision ID: 0013
Revises: 0012
Create Date: 2026-09-15
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("full_name", sa.String(120), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "full_name")
