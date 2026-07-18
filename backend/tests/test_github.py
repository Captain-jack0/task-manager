"""GitHub service unit tests (fake httpx) + integration endpoints (mocked service)."""
import httpx
import pytest
from fastapi import HTTPException
from httpx import AsyncClient

from app.services import github


class _FakeResp:
    def __init__(self, status_code: int, payload: object = None) -> None:
        self.status_code = status_code
        self._payload = {} if payload is None else payload

    def json(self) -> object:
        return self._payload


class _FakeClient:
    def __init__(self, resp: _FakeResp | None, raise_exc: Exception | None = None) -> None:
        self._resp = resp
        self._raise = raise_exc

    async def __aenter__(self) -> "_FakeClient":
        return self

    async def __aexit__(self, *a: object) -> bool:
        return False

    async def get(self, *a: object, **k: object) -> _FakeResp:
        if self._raise:
            raise self._raise
        assert self._resp is not None
        return self._resp

    async def post(self, *a: object, **k: object) -> _FakeResp:
        if self._raise:
            raise self._raise
        assert self._resp is not None
        return self._resp


def _patch(monkeypatch, resp=None, raise_exc=None) -> None:
    monkeypatch.setattr(
        "app.services.github.httpx.AsyncClient",
        lambda *a, **k: _FakeClient(resp, raise_exc),
    )


# --- service unit tests ---

async def test_verify_repo_ok(monkeypatch) -> None:
    _patch(monkeypatch, _FakeResp(200, {"full_name": "o/r"}))
    await github.verify_repo("tok", "o/r")  # no raise


@pytest.mark.parametrize("code,expected", [(401, 400), (404, 400), (500, 400)])
async def test_verify_repo_errors(monkeypatch, code, expected) -> None:
    _patch(monkeypatch, _FakeResp(code))
    with pytest.raises(HTTPException) as exc:
        await github.verify_repo("tok", "o/r")
    assert exc.value.status_code == expected


async def test_verify_repo_network_error(monkeypatch) -> None:
    _patch(monkeypatch, raise_exc=httpx.ConnectError("boom"))
    with pytest.raises(HTTPException) as exc:
        await github.verify_repo("tok", "o/r")
    assert exc.value.status_code == 502


async def test_create_issue_ok(monkeypatch) -> None:
    _patch(monkeypatch, _FakeResp(201, {"number": 5, "html_url": "https://gh/5"}))
    out = await github.create_issue("tok", "o/r", title="t", body="b")
    assert out == {"number": 5, "html_url": "https://gh/5"}


async def test_create_issue_disabled(monkeypatch) -> None:
    _patch(monkeypatch, _FakeResp(410))
    with pytest.raises(HTTPException) as exc:
        await github.create_issue("tok", "o/r", title="t", body="b")
    assert exc.value.status_code == 400


async def test_list_repos_ok(monkeypatch) -> None:
    _patch(monkeypatch, _FakeResp(200, [{"name": "a", "full_name": "o/a", "x": 1}]))
    repos = await github.list_repos("tok")
    assert repos == [{"name": "a", "full_name": "o/a"}]


async def test_issue_state(monkeypatch) -> None:
    _patch(monkeypatch, _FakeResp(200, {"state": "closed"}))
    assert await github.get_issue_state("tok", "o/r", 1) == "closed"


async def test_create_issue_unexpected_status(monkeypatch) -> None:
    _patch(monkeypatch, _FakeResp(500))
    with pytest.raises(HTTPException):
        await github.create_issue("tok", "o/r", title="t", body="b")


async def test_list_repos_error(monkeypatch) -> None:
    _patch(monkeypatch, _FakeResp(403))
    with pytest.raises(HTTPException):
        await github.list_repos("tok")


async def test_issue_state_not_found(monkeypatch) -> None:
    _patch(monkeypatch, _FakeResp(404))
    with pytest.raises(HTTPException):
        await github.get_issue_state("tok", "o/r", 1)


async def test_network_errors(monkeypatch) -> None:
    _patch(monkeypatch, raise_exc=httpx.ConnectError("x"))
    for coro in (
        github.list_repos("t"),
        github.get_issue_state("t", "o/r", 1),
        github.create_issue("t", "o/r", title="t", body="b"),
    ):
        with pytest.raises(HTTPException) as exc:
            await coro
        assert exc.value.status_code == 502


# --- endpoint integration (service mocked) ---

async def test_github_endpoints_flow(
    client: AsyncClient, auth_headers: dict[str, str], monkeypatch
) -> None:
    async def fake_verify(token: str, repo: str) -> None:
        return None

    monkeypatch.setattr("app.services.github.verify_repo", fake_verify)
    r = await client.put(
        "/integrations/github",
        json={"token": "ghp_xxxxxxxxxx", "repo": "octocat/hello"},
        headers=auth_headers,
    )
    assert r.status_code == 200
    assert (await client.get("/integrations/github", headers=auth_headers)).json()["connected"]

    async def fake_repos(token: str) -> list[dict]:
        return [{"name": "hello", "full_name": "octocat/hello"}]

    monkeypatch.setattr("app.services.github.list_repos", fake_repos)
    repos = await client.get("/integrations/github/repos", headers=auth_headers)
    assert repos.status_code == 200 and repos.json()[0]["name"] == "hello"

    task = (await client.post("/tasks", json={"title": "t"}, headers=auth_headers)).json()

    async def fake_issue(token, repo, *, title, body):
        return {"number": 7, "html_url": "https://gh/7"}

    monkeypatch.setattr("app.services.github.create_issue", fake_issue)
    issue = await client.post(f"/tasks/{task['id']}/github-issue", headers=auth_headers)
    assert issue.json()["github_issue_number"] == 7

    async def fake_state(token, repo, number):
        return "closed"

    monkeypatch.setattr("app.services.github.get_issue_state", fake_state)
    sync = await client.post(f"/tasks/{task['id']}/github-sync", headers=auth_headers)
    assert sync.json()["status"] == "done"

    assert (await client.delete("/integrations/github", headers=auth_headers)).status_code == 204


async def test_repos_requires_connection(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    resp = await client.get("/integrations/github/repos", headers=auth_headers)
    assert resp.status_code == 400
