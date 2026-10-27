"""Thin GitHub REST client for the issue integration.

Uses the user's personal access token to verify repo access and create issues.
Network/permission problems are mapped to clean 400/502 HTTPExceptions.
"""
import re
from typing import Any

import httpx
from fastapi import HTTPException, status

GITHUB_API = "https://api.github.com"
# Applying this label is what starts the repo's task-test workflow.
TEST_LABEL = "test"
_ISSUE_URL_RE = re.compile(r"^https://github[.]com/([^/]+/[^/]+)/issues/[0-9]+$")


def repo_from_issue_url(url: str) -> str | None:
    """owner/repo from an issue html_url, or None if it is not one."""
    match = _ISSUE_URL_RE.match(url)
    return match.group(1) if match else None


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


async def create_issue(token: str, repo: str, *, title: str, body: str) -> dict[str, Any]:
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


async def add_test_label(token: str, repo: str, number: int) -> None:
    """Apply the `test` label to an issue so the repo's task-test workflow runs.

    The label is created if the repo lacks it and removed first if already set,
    so GitHub fires a fresh `labeled` event either way.
    """
    labels = f"{GITHUB_API}/repos/{repo}/issues/{number}/labels"
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            await client.post(  # 422 when it already exists, which is fine
                f"{GITHUB_API}/repos/{repo}/labels",
                headers=_headers(token),
                json={"name": TEST_LABEL, "color": "0e8a16", "description": "Run task tests"},
            )
            # 404 when the label is not on the issue, which is fine too
            await client.delete(f"{labels}/{TEST_LABEL}", headers=_headers(token))
            resp = await client.post(
                labels, headers=_headers(token), json={"labels": [TEST_LABEL]}
            )
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not reach GitHub"
            ) from exc
    if resp.status_code != 200:
        _raise_for_access(resp.status_code)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"GitHub returned an unexpected status ({resp.status_code})",
        )


async def get_issue_state(token: str, repo: str, number: int) -> str:
    """Return the linked issue's state — 'open' or 'closed'."""
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(
                f"{GITHUB_API}/repos/{repo}/issues/{number}", headers=_headers(token)
            )
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not reach GitHub"
            ) from exc
    if resp.status_code == 200:
        return str(resp.json().get("state", "open"))
    _raise_for_access(resp.status_code)
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"GitHub returned an unexpected status ({resp.status_code})",
    )


async def list_repos(token: str) -> list[dict[str, Any]]:
    """List repositories the token can access (most-recently-updated first)."""
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(
                f"{GITHUB_API}/user/repos",
                headers=_headers(token),
                params={"per_page": 100, "sort": "updated"},
            )
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not reach GitHub"
            ) from exc
    if resp.status_code != 200:
        _raise_for_access(resp.status_code)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"GitHub returned an unexpected status ({resp.status_code})",
        )
    return [{"name": r["name"], "full_name": r["full_name"]} for r in resp.json()]


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
