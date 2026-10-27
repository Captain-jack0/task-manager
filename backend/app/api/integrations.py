import hmac
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request, status

from app.api.deps import CurrentUser, SessionDep
from app.core.crypto import decrypt_secret
from app.core.rate_limit import limiter
from app.models.user import User
from app.repositories import comment_repo, integration_repo, task_repo
from app.schemas.integration import (
    GithubConnectRequest,
    GithubRepoOut,
    GithubStatusOut,
    GithubTestReportIn,
)
from app.services import github, notify

router = APIRouter(prefix="/integrations", tags=["integrations"])


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

    body = f"_Otomatik test raporu (GitHub Actions)_\n\n{payload.body}"
    comment = await comment_repo.create(session, task_id=task.id, author_id=author.id, body=body)
    await notify.comment_posted(session, background, task=task, author=author, body=body)
    await session.commit()
    return {"comment_id": str(comment.id)}
