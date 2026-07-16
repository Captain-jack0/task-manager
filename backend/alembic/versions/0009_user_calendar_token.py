"""users.calendar_token — secret token for the read-only iCal feed

Revision ID: 0009
Revises: 0008
Create Date: 2026-07-16
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("calendar_token", sa.String(64), nullable=True))
    # Unique so a feed URL maps to exactly one user; nullable (Postgres allows
    # many NULLs under a unique constraint) so tokens are minted lazily.
    op.create_unique_constraint("uq_users_calendar_token", "users", ["calendar_token"])


def downgrade() -> None:
    op.drop_constraint("uq_users_calendar_token", "users", type_="unique")
    op.drop_column("users", "calendar_token")
