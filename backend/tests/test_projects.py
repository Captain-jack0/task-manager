from fastapi import HTTPException
from httpx import AsyncClient


async def test_project_crud(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    created = await client.post(
        "/projects", json={"name": "Website", "color": "#ffffff"}, headers=auth_headers
    )
    assert created.status_code == 201
    pid = created.json()["id"]

    listed = await client.get("/projects", headers=auth_headers)
    assert any(p["id"] == pid for p in listed.json())

    updated = await client.put(f"/projects/{pid}", json={"name": "Web 2"}, headers=auth_headers)
    assert updated.status_code == 200 and updated.json()["name"] == "Web 2"

    deleted = await client.delete(f"/projects/{pid}", headers=auth_headers)
    assert deleted.status_code == 204


async def test_project_not_found(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    resp = await client.put(
        "/projects/00000000-0000-0000-0000-000000000000",
        json={"name": "x"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_guest_is_read_only(
    client: AsyncClient, auth_headers: dict[str, str], second_auth_headers: dict[str, str]
) -> None:
    # alice owns a team, bob joins as a guest
    ws = (await client.post("/workspaces", json={"name": "Team"}, headers=auth_headers)).json()
    wid = ws["id"]
    add = await client.post(
        f"/workspaces/{wid}/members",
        json={"email": "bob@example.com", "role": "guest"},
        headers=auth_headers,
    )
    assert add.status_code == 201

    # guest can read
    read = await client.get(f"/tasks?workspace_id={wid}", headers=second_auth_headers)
    assert read.status_code == 200

    # guest cannot write tasks or projects
    wtask = await client.post(
        f"/tasks?workspace_id={wid}", json={"title": "x"}, headers=second_auth_headers
    )
    assert wtask.status_code == 403
    wproj = await client.post(
        f"/projects?workspace_id={wid}", json={"name": "x"}, headers=second_auth_headers
    )
    assert wproj.status_code == 403


async def test_project_repo_must_be_visible_to_the_github_token(
    client: AsyncClient, auth_headers: dict[str, str], monkeypatch
) -> None:
    # No GitHub connection yet: linking a repo is refused up front.
    resp = await client.post(
        "/projects", json={"name": "Web", "github_repo": "octocat/hello"}, headers=auth_headers
    )
    assert resp.status_code == 400

    async def fake_verify(token: str, repo: str) -> None:
        if repo != "octocat/hello":
            raise HTTPException(status_code=400, detail="Repository not found")

    monkeypatch.setattr("app.services.github.verify_repo", fake_verify)
    await client.put(
        "/integrations/github",
        json={"token": "ghp_xxxxxxxxxx", "repo": "octocat/hello"},
        headers=auth_headers,
    )
    ok = await client.post(
        "/projects",
        json={"name": "Web", "github_repo": "https://github.com/octocat/hello"},
        headers=auth_headers,
    )
    assert ok.status_code == 201 and ok.json()["github_repo"] == "octocat/hello"

    denied = await client.put(
        f"/projects/{ok.json()['id']}", json={"github_repo": "octocat/private"}, headers=auth_headers
    )
    assert denied.status_code == 400
    cleared = await client.put(
        f"/projects/{ok.json()['id']}", json={"github_repo": ""}, headers=auth_headers
    )
    assert cleared.status_code == 200 and cleared.json()["github_repo"] is None
