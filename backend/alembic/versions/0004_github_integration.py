"""github integration: per-user token/repo + task issue link

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "github_integrations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("repo", sa.String(140), nullable=False),
        sa.Column("token", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", name="uq_github_integration_user"),
    )

    op.add_column("tasks", sa.Column("github_issue_url", sa.String(300), nullable=True))
    op.add_column("tasks", sa.Column("github_issue_number", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("tasks", "github_issue_number")
    op.drop_column("tasks", "github_issue_url")
    op.drop_table("github_integrations")
