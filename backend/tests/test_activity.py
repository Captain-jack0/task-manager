from httpx import AsyncClient


async def _events(client: AsyncClient, headers: dict[str, str], task_id: str) -> list[dict[str, object]]:
    r = await client.get(f"/tasks/{task_id}/activity", headers=headers)
    assert r.status_code == 200, r.text
    return list(r.json())


async def test_changes_are_logged_with_actor_old_and_new(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    me = (await client.get("/auth/me", headers=auth_headers)).json()
    task = (await client.post("/tasks", json={"title": "Track me"}, headers=auth_headers)).json()
    events = await _events(client, auth_headers, task["id"])
    assert [e["field"] for e in events] == ["created"]
    assert events[0]["actor"]["id"] == me["id"]  # type: ignore[index]

    await client.patch(
        f"/tasks/{task['id']}",
        json={"status": "in_progress", "priority": "high", "assignee_id": me["id"]},
        headers=auth_headers,
    )
    events = await _events(client, auth_headers, task["id"])
    by_field = {e["field"]: e for e in events}
    assert (by_field["status"]["old_value"], by_field["status"]["new_value"]) == ("todo", "in_progress")
    assert (by_field["priority"]["old_value"], by_field["priority"]["new_value"]) == ("medium", "high")
    assert by_field["assignee_id"]["new_value"] == me["id"]
    # Re-saving the same values adds nothing.
    await client.patch(f"/tasks/{task['id']}", json={"priority": "high"}, headers=auth_headers)
    assert len(await _events(client, auth_headers, task["id"])) == 4


async def test_system_changes_and_links_are_logged(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    a = (await client.post("/tasks", json={"title": "A"}, headers=auth_headers)).json()
    b = (await client.post("/tasks", json={"title": "B"}, headers=auth_headers)).json()
    await client.post(f"/tasks/{a['id']}/links", json={"target_id": b["id"], "kind": "blocks"}, headers=auth_headers)

    # Linking blocked B: one link event on each side, and B's status flip has an actor (the linker).
    b_events = await _events(client, auth_headers, b["id"])
    fields = [e["field"] for e in b_events]
    assert "link" in fields and "status" in fields
    a_link = next(e for e in await _events(client, auth_headers, a["id"]) if e["field"] == "link")
    assert a_link["new_value"] == "blocks:B"

    # Finishing A releases B through the blocker rule: a status event with no actor.
    await client.patch(f"/tasks/{a['id']}", json={"status": "done"}, headers=auth_headers)
    release = next(e for e in await _events(client, auth_headers, b["id"]) if e["field"] == "status")
    assert (release["old_value"], release["new_value"], release["actor"]) == ("blocked", "todo", None)


async def test_bulk_changes_are_logged_per_task(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    ids = [
        (await client.post("/tasks", json={"title": t}, headers=auth_headers)).json()["id"] for t in ("x", "y")
    ]
    await client.post("/tasks/bulk", json={"task_ids": ids, "status": "closed"}, headers=auth_headers)
    for tid in ids:
        status_events = [e for e in await _events(client, auth_headers, tid) if e["field"] == "status"]
        assert status_events and status_events[0]["new_value"] == "closed"


async def test_activity_is_private_to_members(
    client: AsyncClient, auth_headers: dict[str, str], second_auth_headers: dict[str, str]
) -> None:
    task = (await client.post("/tasks", json={"title": "Mine"}, headers=auth_headers)).json()
    r = await client.get(f"/tasks/{task['id']}/activity", headers=second_auth_headers)
    assert r.status_code == 404
