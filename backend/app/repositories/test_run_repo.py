from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.test_run import TestRun, TestRunStatus, TestTriggerSource


async def create(
    session: AsyncSession,
    *,
    project_id: UUID,
    trigger_source: TestTriggerSource,
    task_id: UUID | None = None,
    github_run_id: str | None = None,
    github_run_url: str | None = None,
    started_at: datetime | None = None,
) -> TestRun:
    """Create a new test run."""
    test_run = TestRun(
        project_id=project_id,
        task_id=task_id,
        status=TestRunStatus.RUNNING,
        trigger_source=trigger_source,
        github_run_id=github_run_id,
        github_run_url=github_run_url,
        started_at=started_at or datetime.utcnow(),
    )
    session.add(test_run)
    await session.commit()
    await session.refresh(test_run)
    return test_run


async def get(session: AsyncSession, *, test_run_id: UUID) -> TestRun | None:
    """Get a test run by ID."""
    result = await session.execute(select(TestRun).where(TestRun.id == test_run_id))
    return result.scalar_one_or_none()


async def list_by_project(
    session: AsyncSession,
    *,
    project_id: UUID,
    limit: int = 50,
    offset: int = 0,
) -> Sequence[TestRun]:
    """List test runs for a project, ordered by most recent first."""
    result = await session.execute(
        select(TestRun)
        .where(TestRun.project_id == project_id)
        .order_by(desc(TestRun.created_at))
        .limit(limit)
        .offset(offset)
    )
    return result.scalars().all()


async def get_latest_by_project(
    session: AsyncSession, *, project_id: UUID
) -> TestRun | None:
    """Get the most recent test run for a project."""
    result = await session.execute(
        select(TestRun)
        .where(TestRun.project_id == project_id)
        .order_by(desc(TestRun.created_at))
        .limit(1)
    )
    return result.scalar_one_or_none()


async def update(session: AsyncSession, *, test_run: TestRun) -> TestRun:
    """Update a test run (commits and refreshes)."""
    await session.commit()
    await session.refresh(test_run)
    return test_run


async def complete(
    session: AsyncSession,
    *,
    test_run: TestRun,
    status: TestRunStatus,
    total_criteria: int = 0,
    passed_criteria: int = 0,
    failed_criteria: int = 0,
    test_command: str | None = None,
    report_body: str | None = None,
    findings: dict | None = None,
    duration_seconds: int | None = None,
) -> TestRun:
    """Mark a test run as complete and update its results."""
    test_run.status = status
    test_run.total_criteria = total_criteria
    test_run.passed_criteria = passed_criteria
    test_run.failed_criteria = failed_criteria
    test_run.test_command = test_command
    test_run.report_body = report_body
    test_run.findings = findings
    test_run.duration_seconds = duration_seconds
    test_run.completed_at = datetime.utcnow()
    await session.commit()
    await session.refresh(test_run)
    return test_run


async def count_by_project(session: AsyncSession, *, project_id: UUID) -> int:
    """Count total test runs for a project."""
    result = await session.execute(
        select(func.count()).select_from(TestRun).where(TestRun.project_id == project_id)
    )
    return result.scalar_one()


async def get_project_summary(
    session: AsyncSession, *, project_id: UUID
) -> dict:
    """Get test run summary for a project (total, passed, failed, latest status)."""
    # Total runs
    total = await count_by_project(session, project_id=project_id)

    # Latest run
    latest = await get_latest_by_project(session, project_id=project_id)

    # Count by status (last 30 days for trend)
    from datetime import timedelta
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)

    result = await session.execute(
        select(
            TestRun.status,
            func.count().label("count")
        )
        .where(TestRun.project_id == project_id)
        .where(TestRun.created_at >= thirty_days_ago)
        .group_by(TestRun.status)
    )
    status_counts = {row.status: row.count for row in result}

    return {
        "total_runs": total,
        "latest_status": latest.status.value if latest else None,
        "latest_run_id": str(latest.id) if latest else None,
        "latest_created_at": latest.created_at if latest else None,
        "last_30_days": {
            "passed": status_counts.get(TestRunStatus.PASSED, 0),
            "failed": status_counts.get(TestRunStatus.FAILED, 0),
            "error": status_counts.get(TestRunStatus.ERROR, 0),
        }
    }


async def get_multi_project_summary(
    session: AsyncSession, *, project_ids: list[UUID]
) -> dict[UUID, dict]:
    """Get test run summaries for multiple projects (for dashboard)."""
    summaries = {}
    for project_id in project_ids:
        summaries[project_id] = await get_project_summary(session, project_id=project_id)
    return summaries
