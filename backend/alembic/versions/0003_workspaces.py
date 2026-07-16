"""workspaces + members; scope tasks to a workspace

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-16

Backfill strategy: give every existing user a personal workspace (owner
membership), then point their existing tasks at it, before making
tasks.workspace_id NOT NULL.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    workspace_role_enum = postgresql.ENUM(
        "owner", "admin", "member", "guest", name="workspace_role", create_type=False
    )
    workspace_role_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "workspaces",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("is_personal", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "owner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_workspaces_owner", "workspaces", ["owner_id"])

    op.create_table(
        "workspace_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "workspace_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", workspace_role_enum, nullable=False, server_default="member"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("workspace_id", "user_id", name="uq_workspace_member"),
    )
    op.create_index("ix_workspace_members_user", "workspace_members", ["user_id"])
    op.create_index("ix_workspace_members_workspace", "workspace_members", ["workspace_id"])

    # Add the column nullable so existing rows survive; backfill; then enforce.
    op.add_column("tasks", sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=True))

    op.execute(
        """
        INSERT INTO workspaces (id, name, is_personal, owner_id, created_at, updated_at)
        SELECT gen_random_uuid(), 'Personal', true, u.id, now(), now()
        FROM users u
        """
    )
    op.execute(
        """
        INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at, updated_at)
        SELECT gen_random_uuid(), w.id, w.owner_id, 'owner', now(), now()
        FROM workspaces w
        WHERE w.is_personal = true
        """
    )
    op.execute(
        """
        UPDATE tasks t
        SET workspace_id = w.id
        FROM workspaces w
        WHERE w.owner_id = t.user_id AND w.is_personal = true
        """
    )

    op.alter_column("tasks", "workspace_id", nullable=False)
    op.create_foreign_key(
        "fk_tasks_workspace", "tasks", "workspaces", ["workspace_id"], ["id"], ondelete="CASCADE"
    )
    op.create_index("ix_task_workspace", "tasks", ["workspace_id"])


def downgrade() -> None:
    op.drop_index("ix_task_workspace", table_name="tasks")
    op.drop_constraint("fk_tasks_workspace", "tasks", type_="foreignkey")
    op.drop_column("tasks", "workspace_id")
    op.drop_index("ix_workspace_members_workspace", table_name="workspace_members")
    op.drop_index("ix_workspace_members_user", table_name="workspace_members")
    op.drop_table("workspace_members")
    op.drop_index("ix_workspaces_owner", table_name="workspaces")
    op.drop_table("workspaces")
    op.execute("DROP TYPE IF EXISTS workspace_role")
