from fastapi import APIRouter, HTTPException, Request, status

from app.api.deps import CurrentUser, SessionDep
from app.core.crypto import decrypt_secret
from app.core.rate_limit import limiter
from app.repositories import integration_repo
from app.schemas.integration import GithubConnectRequest, GithubRepoOut, GithubStatusOut
from app.services import github

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.get("/github", response_model=GithubStatusOut)
async def github_status(current_user: CurrentUser, session: SessionDep) -> GithubStatusOut:
    integration = await integration_repo.get_github(session, user_id=current_user.id)
    return GithubStatusOut(
        connected=integration is not None,
        repo=integration.repo if integration else None,
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
    return GithubStatusOut(connected=True, repo=integration.repo)


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
