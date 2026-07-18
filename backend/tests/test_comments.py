from httpx import AsyncClient


async def _make_task(client: AsyncClient, headers: dict[str, str]) -> str:
    resp = await client.post("/tasks", json={"title": "t"}, headers=headers)
    return resp.json()["id"]


async def test_comment_crud(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    tid = await _make_task(client, auth_headers)

    created = await client.post(
        f"/tasks/{tid}/comments", json={"body": "hi there"}, headers=auth_headers
    )
    assert created.status_code == 201
    cid = created.json()["id"]
    assert created.json()["author_email"] == "alice@example.com"

    listed = await client.get(f"/tasks/{tid}/comments", headers=auth_headers)
    assert len(listed.json()) == 1

    deleted = await client.delete(f"/tasks/{tid}/comments/{cid}", headers=auth_headers)
    assert deleted.status_code == 204
    assert (await client.get(f"/tasks/{tid}/comments", headers=auth_headers)).json() == []


async def test_delete_missing_comment(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    tid = await _make_task(client, auth_headers)
    resp = await client.delete(
        f"/tasks/{tid}/comments/00000000-0000-0000-0000-000000000000", headers=auth_headers
    )
    assert resp.status_code == 404
