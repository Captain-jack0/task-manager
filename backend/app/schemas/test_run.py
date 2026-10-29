from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.test_run import TestRunStatus, TestTriggerSource


class TestFinding(BaseModel):
    """A single failed or untestable criterion."""

    criterion: str
    test: str | None = None
    reason: str


class TestRunCreate(BaseModel):
    """Request to create a new test run."""

    project_id: UUID
    task_id: UUID | None = None
    trigger_source: TestTriggerSource


class TestRunUpdate(BaseModel):
    """Update an existing test run with results."""

    status: TestRunStatus | None = None
    total_criteria: int | None = None
    passed_criteria: int | None = None
    failed_criteria: int | None = None
    test_command: str | None = Field(default=None, max_length=500)
    report_body: str | None = None
    findings: list[TestFinding] | None = None
    duration_seconds: int | None = None


class TestRunOut(BaseModel):
    """Test run response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    task_id: UUID | None = None
    status: TestRunStatus
    trigger_source: TestTriggerSource
    github_run_id: str | None = None
    github_run_url: str | None = None
    total_criteria: int = 0
    passed_criteria: int = 0
    failed_criteria: int = 0
    test_command: str | None = None
    report_body: str | None = None
    findings: dict | None = None
    duration_seconds: int | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class TestRunSummaryOut(BaseModel):
    """Summary of test runs for a project."""

    total_runs: int
    latest_status: str | None = None
    latest_run_id: str | None = None
    latest_created_at: datetime | None = None
    last_30_days: dict[str, int] = Field(
        default_factory=lambda: {"passed": 0, "failed": 0, "error": 0}
    )


class TestTriggerRequest(BaseModel):
    """Request to manually trigger tests for a project."""

    project_id: UUID
    task_id: UUID | None = Field(
        default=None,
        description="Optional: run tests for a specific task"
    )


class MultiProjectTestSummary(BaseModel):
    """Test summaries for multiple projects (dashboard)."""

    summaries: dict[str, TestRunSummaryOut]
