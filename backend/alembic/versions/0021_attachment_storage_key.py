"""attachments on object storage

Revision ID: 0021
Revises: 0020
Create Date: 2026-09-15
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0021"
down_revision: Union[str, None] = "0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("attachments", sa.Column("storage_key", sa.String(300), nullable=True))
    op.alter_column("attachments", "data", existing_type=sa.LargeBinary(), nullable=True)


def downgrade() -> None:
    # Rows whose bytes live in the bucket cannot be brought back inline.
    op.execute("DELETE FROM attachments WHERE data IS NULL")
    op.alter_column("attachments", "data", existing_type=sa.LargeBinary(), nullable=False)
    op.drop_column("attachments", "storage_key")
