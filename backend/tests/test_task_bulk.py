from httpx import AsyncClient


async def _task(client: AsyncClient, headers: dict[str, str], title: str, **extra: object) -> str:
    r = await client.post("/tasks", json={"title": title, **extra}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _get(client: AsyncClient, headers: dict[str, str], task_id: str) -> dict[str, object]:
    r = await client.get(f"/tasks/{task_id}", headers=headers)
    assert r.status_code == 200, r.text
    return dict(r.json())


async def test_bulk_update_applies_fields_tags_and_block_rules(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    sprint = (
        await client.post(
            "/sprints",
            json={"name": "S", "start_date": "2026-09-07", "end_date": "2026-09-20"},
            headers=auth_headers,
        )
    ).json()["id"]
    tag = (await client.post("/tags", json={"name": "bulk"}, headers=auth_headers)).json()["id"]
    a = await _task(client, auth_headers, "A")
    b = await _task(client, auth_headers, "B")
    c = await _task(client, auth_headers, "C (blocked by A)")
    await client.post(f"/tasks/{a}/links", json={"target_id": c, "kind": "blocks"}, headers=auth_headers)
    assert (await _get(client, auth_headers, c))["status"] == "blocked"

    r = await client.post(
        "/tasks/bulk",
        json={
            "task_ids": [a, b, a],  # duplicates are fine
            "status": "done",
            "priority": "high",
            "sprint_id": sprint,
            "add_tag_ids": [tag],
        },
        headers=auth_headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["count"] == 2
    for tid in (a, b):
        t = await _get(client, auth_headers, tid)
        assert (t["status"], t["priority"], t["sprint_id"]) == ("done", "high", sprint)
        assert [x["name"] for x in t["tags"]] == ["bulk"]  # type: ignore[index]
    # A finished → C was released by the blocking rule.
    assert (await _get(client, auth_headers, c))["status"] == "todo"

    # Adding the same tag again does not duplicate it; sprint_id null = backlog.
    again = await client.post(
        "/tasks/bulk", json={"task_ids": [a], "add_tag_ids": [tag], "sprint_id": None}, headers=auth_headers
    )
    assert again.status_code == 200
    t = await _get(client, auth_headers, a)
    assert len(t["tags"]) == 1 and t["sprint_id"] is None  # type: ignore[arg-type]


async def test_bulk_is_all_or_nothing_across_workspaces(
    client: AsyncClient, auth_headers: dict[str, str], second_auth_headers: dict[str, str]
) -> None:
    mine = await _task(client, auth_headers, "mine")
    bobs = await _task(client, second_auth_headers, "bobs")
    r = await client.post(
        "/tasks/bulk", json={"task_ids": [mine, bobs], "status": "done"}, headers=auth_headers
    )
    assert r.status_code == 404
    assert (await _get(client, auth_headers, mine))["status"] == "todo"

    empty = await client.post("/tasks/bulk", json={"task_ids": [], "status": "done"}, headers=auth_headers)
    assert empty.status_code == 422


async def test_bulk_delete_releases_dependents(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    a = await _task(client, auth_headers, "A")
    b = await _task(client, auth_headers, "B")
    c = await _task(client, auth_headers, "C")
    await client.post(f"/tasks/{a}/links", json={"target_id": c, "kind": "blocks"}, headers=auth_headers)
    r = await client.post("/tasks/bulk-delete", json={"task_ids": [a, b]}, headers=auth_headers)
    assert r.status_code == 200 and r.json()["count"] == 2
    assert (await client.get(f"/tasks/{a}", headers=auth_headers)).status_code == 404
    assert (await client.get(f"/tasks/{b}", headers=auth_headers)).status_code == 404
    assert (await _get(client, auth_headers, c))["status"] == "todo"
