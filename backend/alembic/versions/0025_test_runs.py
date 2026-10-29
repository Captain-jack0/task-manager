"""test runs table

Revision ID: 0025
Revises: 0024
Create Date: 2026-10-28
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0025"
down_revision: Union[str, None] = "0024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create test_run_status enum (if not exists)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE test_run_status AS ENUM ('running', 'passed', 'failed', 'error');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    # Create test_trigger_source enum (if not exists)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE test_trigger_source AS ENUM ('manual', 'auto', 'pr', 'issue');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Create test_runs table
    op.create_table(
        "test_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "running",
                "passed",
                "failed",
                "error",
                name="test_run_status",
            ),
            nullable=False,
        ),
        sa.Column(
            "trigger_source",
            sa.Enum(
                "manual",
                "auto",
                "pr",
                "issue",
                name="test_trigger_source",
            ),
            nullable=False,
        ),
        sa.Column("github_run_id", sa.String(100), nullable=True),
        sa.Column("github_run_url", sa.String(300), nullable=True),
        sa.Column("total_criteria", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("passed_criteria", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_criteria", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("test_command", sa.String(500), nullable=True),
        sa.Column("report_body", sa.Text(), nullable=True),
        sa.Column("findings", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["project_id"], ["projects.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["task_id"], ["tasks.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indexes for common queries
    op.create_index(
        "ix_test_runs_project_id",
        "test_runs",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        "ix_test_runs_task_id",
        "test_runs",
        ["task_id"],
        unique=False,
    )
    op.create_index(
        "ix_test_runs_project_created",
        "test_runs",
        ["project_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_test_runs_project_created", table_name="test_runs")
    op.drop_index("ix_test_runs_task_id", table_name="test_runs")
    op.drop_index("ix_test_runs_project_id", table_name="test_runs")
    op.drop_table("test_runs")
    op.execute("DROP TYPE test_trigger_source")
    op.execute("DROP TYPE test_run_status")
