from httpx import AsyncClient


async def _task(client: AsyncClient, headers: dict[str, str], title: str, **extra: object) -> dict[str, object]:
    r = await client.post("/tasks", json={"title": title, **extra}, headers=headers)
    assert r.status_code == 201, r.text
    return dict(r.json())


async def test_subtasks_counts_parent_ref_and_listing(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    parent = await _task(client, auth_headers, "Epic")
    a = await _task(client, auth_headers, "part one", parent_id=parent["id"], status="done")
    b = await _task(client, auth_headers, "part two", parent_id=parent["id"])
    assert a["parent"] == {"id": parent["id"], "title": "Epic", "status": "todo"}  # type: ignore[comparison-overlap]

    got = (await client.get(f"/tasks/{parent['id']}", headers=auth_headers)).json()
    assert (got["subtask_total"], got["subtask_done"]) == (2, 1)
    assert got["parent"] is None

    listed = await client.get(f"/tasks?parent_id={parent['id']}&sort=title&order=asc", headers=auth_headers)
    assert [t["title"] for t in listed.json()["data"]] == ["part one", "part two"]

    # Moving a subtask out of the parent, then finishing the other, updates the counts.
    await client.patch(f"/tasks/{b['id']}", json={"parent_id": None}, headers=auth_headers)
    got = (await client.get(f"/tasks/{parent['id']}", headers=auth_headers)).json()
    assert (got["subtask_total"], got["subtask_done"]) == (1, 1)

    # Deleting the parent deletes its subtasks.
    assert (await client.delete(f"/tasks/{parent['id']}", headers=auth_headers)).status_code == 204
    assert (await client.get(f"/tasks/{a['id']}", headers=auth_headers)).status_code == 404
    assert (await client.get(f"/tasks/{b['id']}", headers=auth_headers)).status_code == 200


async def test_subtask_rules(
    client: AsyncClient, auth_headers: dict[str, str], second_auth_headers: dict[str, str]
) -> None:
    parent = await _task(client, auth_headers, "Parent")
    child = await _task(client, auth_headers, "Child", parent_id=parent["id"])

    # One level only: a subtask cannot be a parent, and a parent cannot become a subtask.
    nested = await client.post(
        "/tasks", json={"title": "grandchild", "parent_id": child["id"]}, headers=auth_headers
    )
    assert nested.status_code == 400
    other = await _task(client, auth_headers, "Other")
    demote = await client.patch(
        f"/tasks/{parent['id']}", json={"parent_id": other["id"]}, headers=auth_headers
    )
    assert demote.status_code == 400

    itself = await client.patch(
        f"/tasks/{other['id']}", json={"parent_id": other["id"]}, headers=auth_headers
    )
    assert itself.status_code == 400

    bobs = await _task(client, second_auth_headers, "Bob's")
    foreign = await client.post(
        "/tasks", json={"title": "x", "parent_id": bobs["id"]}, headers=auth_headers
    )
    assert foreign.status_code == 400
