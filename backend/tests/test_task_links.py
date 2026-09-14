from httpx import AsyncClient


async def _task(client: AsyncClient, headers: dict[str, str], title: str, **extra: object) -> str:
    r = await client.post("/tasks", json={"title": title, **extra}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _status(client: AsyncClient, headers: dict[str, str], task_id: str) -> str:
    r = await client.get(f"/tasks/{task_id}", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()["status"]


async def test_block_link_drives_status(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    a = await _task(client, auth_headers, "A (blocker)")
    b = await _task(client, auth_headers, "B", status="in_progress")

    linked = await client.post(
        f"/tasks/{b}/links", json={"target_id": a, "kind": "blocked_by"}, headers=auth_headers
    )
    assert linked.status_code == 200, linked.text
    body = linked.json()
    assert body["status"] == "blocked"
    assert [x["id"] for x in body["blocked_by"]] == [a]
    link_id = body["blocked_by"][0]["link_id"]

    a_out = (await client.get(f"/tasks/{a}", headers=auth_headers)).json()
    assert [x["id"] for x in a_out["blocks"]] == [b]
    assert a_out["blocks"][0]["status"] == "blocked"

    # Blocker finishes → dependent goes back to To do.
    await client.patch(f"/tasks/{a}", json={"status": "done"}, headers=auth_headers)
    assert await _status(client, auth_headers, b) == "todo"

    # Blocker reopens → dependent is blocked again.
    await client.patch(f"/tasks/{a}", json={"status": "todo"}, headers=auth_headers)
    assert await _status(client, auth_headers, b) == "blocked"

    # Removing the link releases the dependent.
    removed = await client.delete(f"/tasks/{b}/links/{link_id}", headers=auth_headers)
    assert removed.status_code == 204
    assert await _status(client, auth_headers, b) == "todo"
    assert (await client.get(f"/tasks/{b}", headers=auth_headers)).json()["blocked_by"] == []


async def test_stays_blocked_until_every_blocker_is_done(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    a = await _task(client, auth_headers, "A")
    c = await _task(client, auth_headers, "C")
    b = await _task(client, auth_headers, "B")
    for blocker in (a, c):
        await client.post(f"/tasks/{blocker}/links", json={"target_id": b, "kind": "blocks"}, headers=auth_headers)
    assert await _status(client, auth_headers, b) == "blocked"

    await client.patch(f"/tasks/{a}", json={"status": "done"}, headers=auth_headers)
    assert await _status(client, auth_headers, b) == "blocked"
    await client.patch(f"/tasks/{c}", json={"status": "closed"}, headers=auth_headers)
    assert await _status(client, auth_headers, b) == "todo"


async def test_deleting_a_blocker_releases_its_dependents(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    a = await _task(client, auth_headers, "A")
    b = await _task(client, auth_headers, "B")
    await client.post(f"/tasks/{a}/links", json={"target_id": b, "kind": "blocks"}, headers=auth_headers)
    assert await _status(client, auth_headers, b) == "blocked"
    assert (await client.delete(f"/tasks/{a}", headers=auth_headers)).status_code == 204
    assert await _status(client, auth_headers, b) == "todo"


async def test_related_links_are_symmetric_and_validated(
    client: AsyncClient, auth_headers: dict[str, str], second_auth_headers: dict[str, str]
) -> None:
    a = await _task(client, auth_headers, "A")
    b = await _task(client, auth_headers, "B")

    r = await client.post(f"/tasks/{a}/links", json={"target_id": b, "kind": "relates"}, headers=auth_headers)
    assert r.status_code == 200 and [x["id"] for x in r.json()["related"]] == [b]
    assert r.json()["status"] == "todo"  # related never changes status
    b_out = (await client.get(f"/tasks/{b}", headers=auth_headers)).json()
    assert [x["id"] for x in b_out["related"]] == [a]

    dup = await client.post(f"/tasks/{a}/links", json={"target_id": b, "kind": "relates"}, headers=auth_headers)
    assert dup.status_code == 409
    mirror = await client.post(f"/tasks/{b}/links", json={"target_id": a, "kind": "relates"}, headers=auth_headers)
    assert mirror.status_code == 409

    self_link = await client.post(f"/tasks/{a}/links", json={"target_id": a, "kind": "blocks"}, headers=auth_headers)
    assert self_link.status_code == 400

    await client.post(f"/tasks/{a}/links", json={"target_id": b, "kind": "blocks"}, headers=auth_headers)
    cycle = await client.post(f"/tasks/{b}/links", json={"target_id": a, "kind": "blocks"}, headers=auth_headers)
    assert cycle.status_code == 400

    bobs = await _task(client, second_auth_headers, "Bob's task")
    foreign = await client.post(f"/tasks/{a}/links", json={"target_id": bobs, "kind": "relates"}, headers=auth_headers)
    assert foreign.status_code == 404
