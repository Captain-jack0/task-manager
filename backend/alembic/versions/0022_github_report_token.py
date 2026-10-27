"""github integration report token

Revision ID: 0022
Revises: 0021
Create Date: 2026-10-27
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0022"
down_revision: Union[str, None] = "0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "github_integrations", sa.Column("report_token", sa.String(255), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("github_integrations", "report_token")
