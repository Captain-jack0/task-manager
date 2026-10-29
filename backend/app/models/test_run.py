from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class TestRunStatus(str, Enum):
    """Status of a test run."""

    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"
    ERROR = "error"


class TestTriggerSource(str, Enum):
    """What triggered the test run."""

    MANUAL = "manual"  # User clicked "Run Tests"
    AUTO = "auto"  # Auto-test on issue creation
    PR = "pr"  # PR opened/updated
    ISSUE = "issue"  # Issue labeled with "test"


class TestRun(Base, UUIDMixin, TimestampMixin):
    """A single test execution run for a project."""

    __tablename__ = "test_runs"

    project_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    # Optional: if this test run was for a specific task
    task_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[TestRunStatus] = mapped_column(
        SAEnum(
            TestRunStatus,
            name="test_run_status",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        default=TestRunStatus.RUNNING,
    )
    trigger_source: Mapped[TestTriggerSource] = mapped_column(
        SAEnum(
            TestTriggerSource,
            name="test_trigger_source",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
    )
    # GitHub Actions run info
    github_run_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    github_run_url: Mapped[str | None] = mapped_column(String(300), nullable=True)
    # Test results summary
    total_criteria: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    passed_criteria: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_criteria: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Test execution details
    test_command: Mapped[str | None] = mapped_column(String(500), nullable=True)
    report_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Failed/untestable criteria as JSON: [{criterion, test, reason}]
    findings: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # When the test started and finished
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True  # Set when test run starts
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True  # Set when status → PASSED/FAILED/ERROR
    )
