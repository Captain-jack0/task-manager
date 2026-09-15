from httpx import AsyncClient


async def _team(client: AsyncClient, alice: dict[str, str]) -> str:
    ws = (await client.post("/workspaces", json={"name": "Team"}, headers=alice)).json()
    add = await client.post(
        f"/workspaces/{ws['id']}/members",
        json={"email": "bob@example.com", "role": "member"},
        headers=alice,
    )
    assert add.status_code in (200, 201), add.text
    return str(ws["id"])


async def _inbox(client: AsyncClient, headers: dict[str, str]) -> dict[str, object]:
    r = await client.get("/notifications", headers=headers)
    assert r.status_code == 200, r.text
    return dict(r.json())


async def test_assignment_notifies_the_assignee_but_not_the_actor(
    client: AsyncClient, auth_headers: dict[str, str], second_auth_headers: dict[str, str]
) -> None:
    ws = await _team(client, auth_headers)
    bob = (await client.get("/auth/me", headers=second_auth_headers)).json()

    created = await client.post(
        f"/tasks?workspace_id={ws}",
        json={"title": "Write docs", "assignee_id": bob["id"]},
        headers=auth_headers,
    )
    assert created.status_code == 201, created.text
    inbox = await _inbox(client, second_auth_headers)
    assert inbox["unread"] == 1
    items = inbox["items"]
    assert isinstance(items, list) and items[0]["kind"] == "assigned"
    assert items[0]["message"] == "alice@example.com assigned you: Write docs"
    assert items[0]["task_id"] == created.json()["id"]

    # Re-saving with the same assignee, or assigning yourself, adds nothing.
    await client.patch(
        f"/tasks/{created.json()['id']}", json={"assignee_id": bob["id"]}, headers=auth_headers
    )
    alice = (await client.get("/auth/me", headers=auth_headers)).json()
    await client.post(
        f"/tasks?workspace_id={ws}", json={"title": "Mine", "assignee_id": alice["id"]}, headers=auth_headers
    )
    assert (await _inbox(client, second_auth_headers))["unread"] == 1
    assert (await _inbox(client, auth_headers))["unread"] == 0


async def test_comments_notify_creator_and_mentions(
    client: AsyncClient, auth_headers: dict[str, str], second_auth_headers: dict[str, str]
) -> None:
    ws = await _team(client, auth_headers)
    task = (
        await client.post(f"/tasks?workspace_id={ws}", json={"title": "Review PR"}, headers=auth_headers)
    ).json()

    # Bob comments → Alice (creator) gets a plain comment notification.
    r = await client.post(
        f"/tasks/{task['id']}/comments", json={"body": "Looks good"}, headers=second_auth_headers
    )
    assert r.status_code == 201, r.text
    inbox = await _inbox(client, auth_headers)
    items = inbox["items"]
    assert isinstance(items, list) and [i["kind"] for i in items] == ["comment"]

    # Bob mentions Alice → mention, not a second comment notification.
    await client.post(
        f"/tasks/{task['id']}/comments",
        json={"body": "@alice@example.com can you check?"},
        headers=second_auth_headers,
    )
    kinds = [i["kind"] for i in (await _inbox(client, auth_headers))["items"]]  # type: ignore[union-attr]
    assert kinds == ["mention", "comment"]
    # The author never notifies themselves.
    assert (await _inbox(client, second_auth_headers))["unread"] == 0


async def test_mark_read_and_read_all(
    client: AsyncClient, auth_headers: dict[str, str], second_auth_headers: dict[str, str]
) -> None:
    ws = await _team(client, auth_headers)
    bob = (await client.get("/auth/me", headers=second_auth_headers)).json()
    for title in ("one", "two"):
        await client.post(
            f"/tasks?workspace_id={ws}", json={"title": title, "assignee_id": bob["id"]}, headers=auth_headers
        )
    inbox = await _inbox(client, second_auth_headers)
    assert inbox["unread"] == 2
    first = inbox["items"][0]  # type: ignore[index]

    read = await client.post(f"/notifications/{first['id']}/read", headers=second_auth_headers)
    assert read.status_code == 200 and read.json()["read_at"] is not None
    assert (await _inbox(client, second_auth_headers))["unread"] == 1
    # Someone else's notification is invisible.
    foreign = await client.post(f"/notifications/{first['id']}/read", headers=auth_headers)
    assert foreign.status_code == 404

    all_read = await client.post("/notifications/read-all", headers=second_auth_headers)
    assert all_read.status_code == 200 and all_read.json()["unread"] == 0
    unread_only = await client.get("/notifications?unread_only=true", headers=second_auth_headers)
    assert unread_only.json()["items"] == []
