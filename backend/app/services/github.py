"""Thin GitHub REST client for the issue integration.

Uses the user's personal access token to verify repo access and create issues.
Network/permission problems are mapped to clean 400/502 HTTPExceptions.
"""
import httpx
from fastapi import HTTPException, status

GITHUB_API = "https://api.github.com"


def _headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


async def verify_repo(token: str, repo: str) -> None:
    """Confirm the token can see the repo before we save it."""
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(f"{GITHUB_API}/repos/{repo}", headers=_headers(token))
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not reach GitHub"
            ) from exc
    _raise_for_access(resp.status_code)


async def create_issue(token: str, repo: str, *, title: str, body: str) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.post(
                f"{GITHUB_API}/repos/{repo}/issues",
                headers=_headers(token),
                json={"title": title, "body": body},
            )
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not reach GitHub"
            ) from exc
    if resp.status_code == 201:
        data = resp.json()
        return {"number": data["number"], "html_url": data["html_url"]}
    if resp.status_code == 410:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Issues are disabled on this repository",
        )
    _raise_for_access(resp.status_code)
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"GitHub returned an unexpected status ({resp.status_code})",
    )


def _raise_for_access(code: int) -> None:
    if code in (401, 403):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GitHub rejected the token — check it has issues write access to the repo",
        )
    if code == 404:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Repository not found, or the token cannot access it",
        )
    if code >= 300:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"GitHub error ({code})",
        )
