import hmac
import json
import re
from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request, status

from app.api.deps import CurrentUser, SessionDep
from app.core.crypto import decrypt_secret
from app.core.rate_limit import limiter
from app.models.test_run import TestRunStatus, TestTriggerSource
from app.models.user import User
from app.repositories import comment_repo, integration_repo, task_repo, test_run_repo
from app.schemas.integration import (
    GithubConnectRequest,
    GithubRepoOut,
    GithubStatusOut,
    GithubTestReportIn,
)
from app.services import github, notify

router = APIRouter(prefix="/integrations", tags=["integrations"])


def _parse_test_results(report_body: str) -> tuple[int, int, str | None]:
    """Parse test report to extract passed/total criteria and test command.

    Returns: (passed_criteria, total_criteria, test_command)
    """
    # Limit report body size for regex safety (already limited by FastAPI but be explicit)
    if len(report_body) > 100_000:  # 100KB
        return 0, 0, None

    # Extract "X/Y geçti" or "X/Y passed"
    result_match = re.search(r"\*\*Sonuç:\*\*\s+(\d+)/(\d+)\s+geçti", report_body)
    if not result_match:
        result_match = re.search(r"\*\*Result:\*\*\s+(\d+)/(\d+)\s+passed", report_body)

    passed = int(result_match.group(1)) if result_match else 0
    total = int(result_match.group(2)) if result_match else 0

    # Sanity check: reasonable limits
    if total > 1000 or passed > total:
        return 0, 0, None

    # Extract test command from "**Komut:** `command`" or "**Command:** `command`"
    command_match = re.search(
        r"\*\*(?:Komut|Command):\*\*\s+`([^`]+)`",
        report_body
    )
    test_command = command_match.group(1) if command_match else None

    # Limit test command length
    if test_command and len(test_command) > 500:
        test_command = test_command[:500]

    return passed, total, test_command


def _extract_findings(report_body: str) -> list[dict[str, Any]] | None:
    """Extract test findings from hidden JSON block in report.

    Format: <!-- task-test-findings [...] -->
    """
    findings_match = re.search(
        r"<!-- task-test-findings\s+(.+?)\s+-->",
        report_body,
        re.DOTALL
    )
    if not findings_match:
        return None

    try:
        findings_json = findings_match.group(1).strip()
        # Limit findings JSON size to prevent DoS
        if len(findings_json) > 50_000:  # 50KB
            return None

        findings = json.loads(findings_json)

        # Validate findings structure and limit count
        if not isinstance(findings, list):
            return None
        if len(findings) > 100:  # Max 100 findings
            findings = findings[:100]

        # Validate each finding has expected structure
        validated_findings = []
        for finding in findings:
            if isinstance(finding, dict) and "criterion" in finding:
                # Truncate long strings
                validated_findings.append({
                    "criterion": str(finding.get("criterion", ""))[:1000],
                    "test": str(finding.get("test", ""))[:500] if finding.get("test") else None,
                    "reason": str(finding.get("reason", ""))[:1000],
                })

        return validated_findings if validated_findings else None
    except (json.JSONDecodeError, AttributeError, ValueError):
        return None


@router.get("/github", response_model=GithubStatusOut)
async def github_status(current_user: CurrentUser, session: SessionDep) -> GithubStatusOut:
    integration = await integration_repo.get_github(session, user_id=current_user.id)
    if integration is None:
        return GithubStatusOut(connected=False)
    return GithubStatusOut(
        connected=True,
        repo=integration.repo,
        report_token=await integration_repo.ensure_report_token(session, integration),
    )


@router.put("/github", response_model=GithubStatusOut)
@limiter.limit("10/minute")
async def connect_github(
    request: Request,
    payload: GithubConnectRequest,
    current_user: CurrentUser,
    session: SessionDep,
) -> GithubStatusOut:
    # Verify the token can reach the repo before persisting it.
    await github.verify_repo(payload.token, payload.repo)
    integration = await integration_repo.upsert_github(
        session, user_id=current_user.id, token=payload.token, repo=payload.repo
    )
    return GithubStatusOut(
        connected=True,
        repo=integration.repo,
        report_token=await integration_repo.ensure_report_token(session, integration),
    )


@router.delete("/github", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_github(current_user: CurrentUser, session: SessionDep) -> None:
    await integration_repo.delete_github(session, user_id=current_user.id)


@router.get("/github/repos", response_model=list[GithubRepoOut])
@limiter.limit("20/minute")
async def github_repos(
    request: Request, current_user: CurrentUser, session: SessionDep
) -> list[GithubRepoOut]:
    integration = await integration_repo.get_github(session, user_id=current_user.id)
    if integration is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="GitHub is not connected"
        )
    repos = await github.list_repos(decrypt_secret(integration.token))
    return [GithubRepoOut(**r) for r in repos]


@router.post("/github/test-report", status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def github_test_report(
    request: Request,
    payload: GithubTestReportIn,
    session: SessionDep,
    background: BackgroundTasks,
    x_report_token: Annotated[str, Header()] = "",
) -> dict[str, str]:
    """Inbound hook for the task-test workflow (.github/workflows/task-test.yml):
    attach a CI test report, as a comment, to the task linked to a GitHub issue.

    The caller is GitHub Actions, not a user, so instead of a JWT it presents the
    task owner's report token (shown in Settings → GitHub, stored on the repo as
    TASK_MANAGER_REPORT_SECRET)."""
    url = f"https://github.com/{payload.repo}/issues/{payload.issue_number}"
    task = await task_repo.get_by_github_issue_url(session, url=url)
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No task is linked to that issue"
        )
    integration = await integration_repo.get_github(session, user_id=task.user_id)
    if integration is None or integration.report_token is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="The task's owner has no GitHub connection"
        )
    expected = decrypt_secret(integration.report_token)
    if not hmac.compare_digest(x_report_token.encode(), expected.encode()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bad report token")

    # ponytail: the report is posted as the task's creator; a dedicated system
    # user if attribution ever matters.
    author = await session.get(User, task.user_id)
    if author is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="The task's owner no longer exists"
        )

    # Parse test results from the report
    passed, total, test_command = _parse_test_results(payload.body)
    failed = total - passed
    findings = _extract_findings(payload.body)

    # Determine test run status
    if total == 0:
        status_value = TestRunStatus.ERROR
    elif passed == total:
        status_value = TestRunStatus.PASSED
    else:
        status_value = TestRunStatus.FAILED

    # Create or update test run record if task has a project
    test_run = None
    if task.project_id:
        # Determine trigger source (auto if project.auto_test, else issue)
        from app.repositories import project_repo
        project = await project_repo.get(session, project_id=task.project_id)
        trigger_source = TestTriggerSource.AUTO if (project and project.auto_test) else TestTriggerSource.ISSUE

        # Create test run
        test_run = await test_run_repo.create(
            session,
            project_id=task.project_id,
            task_id=task.id,
            trigger_source=trigger_source,
            started_at=datetime.utcnow(),
        )

        # Complete test run with results
        await test_run_repo.complete(
            session,
            test_run=test_run,
            status=status_value,
            total_criteria=total,
            passed_criteria=passed,
            failed_criteria=failed,
            test_command=test_command,
            report_body=payload.body,
            findings={"findings": findings} if findings else None,
        )

    # Post report as comment
    body = f"_Otomatik test raporu (GitHub Actions)_\n\n{payload.body}"
    comment = await comment_repo.create(session, task_id=task.id, author_id=author.id, body=body)
    await notify.comment_posted(session, background, task=task, author=author, body=body)
    await session.commit()

    result = {"comment_id": str(comment.id)}
    if test_run:
        result["test_run_id"] = str(test_run.id)
    return result
