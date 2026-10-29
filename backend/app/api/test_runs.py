from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, SessionDep
from app.api.projects import _require_project
from app.core.crypto import decrypt_secret
from app.repositories import integration_repo, project_repo, test_run_repo
from app.schemas.test_run import (
    TestRunOut,
    TestRunSummaryOut,
    TestTriggerRequest,
)
from app.services import github

router = APIRouter(prefix="/projects/{project_id}/test-runs", tags=["test-runs"])
dashboard_router = APIRouter(prefix="/test-runs", tags=["test-runs"])


@router.get("", response_model=list[TestRunOut])
async def list_test_runs(
    project_id: UUID,
    current_user: CurrentUser,
    session: SessionDep,
    limit: int = 50,
    offset: int = 0,
) -> list[TestRunOut]:
    """List test runs for a project, ordered by most recent first."""
    await _require_project(session, current_user, project_id)
    test_runs = await test_run_repo.list_by_project(
        session, project_id=project_id, limit=limit, offset=offset
    )
    return [TestRunOut.model_validate(run) for run in test_runs]


@router.get("/summary", response_model=TestRunSummaryOut)
async def get_test_run_summary(
    project_id: UUID,
    current_user: CurrentUser,
    session: SessionDep,
) -> TestRunSummaryOut:
    """Get test run summary for a project (total, status, trends)."""
    await _require_project(session, current_user, project_id)
    summary = await test_run_repo.get_project_summary(session, project_id=project_id)
    return TestRunSummaryOut(**summary)


@router.get("/{run_id}", response_model=TestRunOut)
async def get_test_run(
    project_id: UUID,
    run_id: UUID,
    current_user: CurrentUser,
    session: SessionDep,
) -> TestRunOut:
    """Get a specific test run by ID."""
    await _require_project(session, current_user, project_id)
    test_run = await test_run_repo.get(session, test_run_id=run_id)
    if test_run is None or test_run.project_id != project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test run not found"
        )
    return TestRunOut.model_validate(test_run)


@router.post("/trigger", status_code=status.HTTP_202_ACCEPTED)
async def trigger_tests(
    project_id: UUID,
    payload: TestTriggerRequest,
    current_user: CurrentUser,
    session: SessionDep,
) -> dict[str, str]:
    """Trigger tests for a project via GitHub Actions repository_dispatch.

    Returns 202 Accepted with a message. The actual test run is created by the
    GitHub Actions workflow when it posts the test report.
    """
    # Ensure user can write to this project
    project = await _require_project(session, current_user, project_id, write=True)

    # Verify project_id matches
    if payload.project_id != project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="project_id in payload must match URL parameter"
        )

    # Get GitHub integration for the repo
    integration = await integration_repo.get_github(session, user_id=current_user.id)
    if integration is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Connect GitHub first (account menu → GitHub integration)",
        )

    # Determine which repo to use: project-specific or user's default
    repo = project.github_repo or integration.repo
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No GitHub repo configured for this project or user",
        )

    # Fetch task relationships if task_id is provided
    related_issues: list[int] = []
    blocked_by_issues: list[int] = []
    if payload.task_id:
        from app.api.tasks import _out
        from app.repositories import task_repo

        task = await task_repo.get_task(session, task_id=payload.task_id)
        if task:
            task_out = await _out(session, task)
            related_issues = [
                r.github_issue_number for r in task_out.related if r.github_issue_number
            ]
            blocked_by_issues = [
                b.github_issue_number for b in task_out.blocked_by if b.github_issue_number
            ]

    # Trigger GitHub Actions workflow via repository_dispatch
    client_payload = {
        "project_id": str(project_id),
        "task_id": str(payload.task_id) if payload.task_id else None,
        "trigger_source": "manual",
        "related_issues": related_issues,
        "blocked_by_issues": blocked_by_issues,
    }

    await github.trigger_repository_dispatch(
        decrypt_secret(integration.token),
        repo,
        event_type="test-run",
        client_payload=client_payload,
    )

    return {
        "message": "Tests triggered successfully. Results will appear in test history when complete.",
        "project_id": str(project_id),
        "repo": repo,
    }


@dashboard_router.get("/dashboard")
async def get_dashboard(
    current_user: CurrentUser,
    session: SessionDep,
) -> dict[str, dict[str, Any]]:
    """Get test run summaries for all projects the user has access to."""
    # Get all workspaces for user
    from app.repositories import workspace_repo
    workspaces = await workspace_repo.list_for_user(session, user_id=current_user.id)

    # Get all projects in those workspaces
    project_ids: list[UUID] = []
    for workspace in workspaces:
        projects = await project_repo.list_by_workspace(session, workspace_id=workspace.id)
        project_ids.extend([p.id for p in projects])

    # Get summaries for all projects
    summaries = await test_run_repo.get_multi_project_summary(
        session, project_ids=project_ids
    )

    # Convert UUID keys to strings for JSON serialization
    return {str(project_id): summary for project_id, summary in summaries.items()}
