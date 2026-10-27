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
        self.calls: list[str] = []

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
        self.calls.append("post")
        if self._raise:
            raise self._raise
        assert self._resp is not None
        return self._resp

    async def delete(self, *a: object, **k: object) -> _FakeResp:
        self.calls.append("delete")
        return _FakeResp(404)


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


async def test_add_test_label_creates_then_relabels(monkeypatch) -> None:
    fake = _FakeClient(_FakeResp(200, [{"name": "test"}]))
    monkeypatch.setattr("app.services.github.httpx.AsyncClient", lambda *a, **k: fake)
    await github.add_test_label("tok", "o/r", 7)
    # ensure the label exists, drop a stale one, apply it: the last POST decides
    assert fake.calls == ["post", "delete", "post"]


async def test_add_test_label_access_error(monkeypatch) -> None:
    _patch(monkeypatch, _FakeResp(403))
    with pytest.raises(HTTPException) as exc:
        await github.add_test_label("tok", "o/r", 7)
    assert exc.value.status_code == 400


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


# --- inbound test report (posted by .github/workflows/task-test.yml) ---

async def _linked_task(client: AsyncClient, auth_headers: dict[str, str], monkeypatch) -> dict:
    """A task pushed to octocat/hello#7 (GitHub calls mocked)."""
    async def fake_verify(token: str, repo: str) -> None:
        return None

    async def fake_issue(token, repo, *, title, body):
        return {"number": 7, "html_url": "https://github.com/octocat/hello/issues/7"}

    monkeypatch.setattr("app.services.github.verify_repo", fake_verify)
    monkeypatch.setattr("app.services.github.create_issue", fake_issue)
    await client.put(
        "/integrations/github",
        json={"token": "ghp_xxxxxxxxxx", "repo": "octocat/hello"},
        headers=auth_headers,
    )
    task = (await client.post("/tasks", json={"title": "t"}, headers=auth_headers)).json()
    return (await client.post(f"/tasks/{task['id']}/github-issue", headers=auth_headers)).json()


async def test_test_report_becomes_task_comment(
    client: AsyncClient, auth_headers: dict[str, str], monkeypatch
) -> None:
    task = await _linked_task(client, auth_headers, monkeypatch)
    token = (await client.get("/integrations/github", headers=auth_headers)).json()["report_token"]
    assert token and len(token) >= 32
    url = "/integrations/github/test-report"
    payload = {"repo": "octocat/hello", "issue_number": 7, "body": "## Test raporu\n3/3 geçti"}

    bad = await client.post(url, json=payload, headers={"X-Report-Token": "nope"})
    assert bad.status_code == 401
    unknown = await client.post(
        url, json={**payload, "issue_number": 8}, headers={"X-Report-Token": token}
    )
    assert unknown.status_code == 404
    ok = await client.post(url, json=payload, headers={"X-Report-Token": token})
    assert ok.status_code == 201, ok.text

    comments = (await client.get(f"/tasks/{task['id']}/comments", headers=auth_headers)).json()
    assert len(comments) == 1
    assert comments[0]["body"].startswith("_Otomatik test raporu")
    assert "3/3 geçti" in comments[0]["body"]


async def test_report_token_is_stable_until_disconnect(
    client: AsyncClient, auth_headers: dict[str, str], monkeypatch
) -> None:
    await _linked_task(client, auth_headers, monkeypatch)
    first = (await client.get("/integrations/github", headers=auth_headers)).json()["report_token"]
    second = (await client.get("/integrations/github", headers=auth_headers)).json()["report_token"]
    assert first == second

    await client.delete("/integrations/github", headers=auth_headers)
    gone = (await client.get("/integrations/github", headers=auth_headers)).json()
    assert gone == {"connected": False, "repo": None, "report_token": None}


def test_repo_from_issue_url() -> None:
    assert github.repo_from_issue_url("https://github.com/o/r/issues/12") == "o/r"
    assert github.repo_from_issue_url("https://gh/7") is None


async def test_issue_opens_in_the_projects_repo(
    client: AsyncClient, auth_headers: dict[str, str], monkeypatch
) -> None:
    async def fake_verify(token: str, repo: str) -> None:
        return None

    monkeypatch.setattr("app.services.github.verify_repo", fake_verify)
    await client.put(
        "/integrations/github",
        json={"token": "ghp_xxxxxxxxxx", "repo": "octocat/default"},
        headers=auth_headers,
    )
    project = (
        await client.post(
            "/projects", json={"name": "Web", "github_repo": "octocat/web"}, headers=auth_headers
        )
    ).json()
    task = (
        await client.post(
            "/tasks", json={"title": "t", "project_id": project["id"]}, headers=auth_headers
        )
    ).json()

    seen: dict[str, str] = {}

    async def fake_issue(token, repo, *, title, body):
        seen["create"] = repo
        return {"number": 3, "html_url": f"https://github.com/{repo}/issues/3"}

    async def fake_state(token, repo, number):
        seen["sync"] = repo
        return "open"

    monkeypatch.setattr("app.services.github.create_issue", fake_issue)
    monkeypatch.setattr("app.services.github.get_issue_state", fake_state)
    opened = await client.post(f"/tasks/{task['id']}/github-issue", headers=auth_headers)
    assert opened.status_code == 200, opened.text
    await client.post(f"/tasks/{task['id']}/github-sync", headers=auth_headers)
    assert seen == {"create": "octocat/web", "sync": "octocat/web"}


async def test_auto_test_labels_new_issues_and_test_button_relabels(
    client: AsyncClient, auth_headers: dict[str, str], monkeypatch
) -> None:
    async def fake_verify(token: str, repo: str) -> None:
        return None

    monkeypatch.setattr("app.services.github.verify_repo", fake_verify)
    await client.put(
        "/integrations/github",
        json={"token": "ghp_xxxxxxxxxx", "repo": "octocat/default"},
        headers=auth_headers,
    )
    project = (
        await client.post(
            "/projects",
            json={"name": "Web", "github_repo": "octocat/web", "auto_test": True},
            headers=auth_headers,
        )
    ).json()
    assert project["auto_test"] is True
    task = (
        await client.post(
            "/tasks", json={"title": "t", "project_id": project["id"]}, headers=auth_headers
        )
    ).json()

    labelled: list[tuple[str, int]] = []

    async def fake_issue(token, repo, *, title, body):
        return {"number": 3, "html_url": f"https://github.com/{repo}/issues/3"}

    async def fake_label(token, repo, number):
        labelled.append((repo, number))

    monkeypatch.setattr("app.services.github.create_issue", fake_issue)
    monkeypatch.setattr("app.services.github.add_test_label", fake_label)

    # nothing to test until the task is linked to an issue
    unlinked = await client.post(f"/tasks/{task['id']}/github-test", headers=auth_headers)
    assert unlinked.status_code == 400

    opened = await client.post(f"/tasks/{task['id']}/github-issue", headers=auth_headers)
    assert opened.status_code == 200, opened.text
    assert labelled == [("octocat/web", 3)]

    # the Test button re-applies the label on demand
    queued = await client.post(f"/tasks/{task['id']}/github-test", headers=auth_headers)
    assert queued.status_code == 202, queued.text
    assert labelled == [("octocat/web", 3), ("octocat/web", 3)]

    off = await client.put(
        f"/projects/{project['id']}", json={"auto_test": False}, headers=auth_headers
    )
    assert off.status_code == 200 and off.json()["auto_test"] is False
