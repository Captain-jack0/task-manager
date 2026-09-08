from httpx import AsyncClient

SPRINT = {"name": "Sprint 1", "start_date": "2026-09-07", "end_date": "2026-09-20", "goal": "Ship auth"}


async def test_sprint_crud_counts_and_task_filters(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    created = await client.post("/sprints", json=SPRINT, headers=auth_headers)
    assert created.status_code == 201, created.text
    sid = created.json()["id"]
    assert created.json()["task_count"] == 0

    in_sprint = await client.post(
        "/tasks", json={"title": "In sprint", "sprint_id": sid, "status": "done"}, headers=auth_headers
    )
    assert in_sprint.status_code == 201 and in_sprint.json()["sprint_id"] == sid
    await client.post("/tasks", json={"title": "Also in sprint", "sprint_id": sid}, headers=auth_headers)
    await client.post("/tasks", json={"title": "Backlog item"}, headers=auth_headers)

    listed = (await client.get("/sprints", headers=auth_headers)).json()
    sprint = next(s for s in listed if s["id"] == sid)
    assert (sprint["task_count"], sprint["done_count"]) == (2, 1)

    by_sprint = await client.get(f"/tasks?sprint_id={sid}&sort=title&order=asc", headers=auth_headers)
    assert [t["title"] for t in by_sprint.json()["data"]] == ["Also in sprint", "In sprint"]
    backlog = await client.get("/tasks?backlog=true", headers=auth_headers)
    assert [t["title"] for t in backlog.json()["data"]] == ["Backlog item"]

    moved = await client.patch(
        f"/tasks/{in_sprint.json()['id']}", json={"sprint_id": None}, headers=auth_headers
    )
    assert moved.status_code == 200 and moved.json()["sprint_id"] is None

    updated = await client.put(f"/sprints/{sid}", json={"name": "Sprint 1b"}, headers=auth_headers)
    assert updated.status_code == 200 and updated.json()["name"] == "Sprint 1b"
    assert updated.json()["task_count"] == 1

    deleted = await client.delete(f"/sprints/{sid}", headers=auth_headers)
    assert deleted.status_code == 204
    # Deleting a sprint sends its tasks back to the backlog instead of deleting them.
    backlog_after = await client.get("/tasks?backlog=true", headers=auth_headers)
    assert backlog_after.json()["total"] == 3


async def test_sprint_dates_are_validated(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    bad = await client.post(
        "/sprints",
        json={"name": "Backwards", "start_date": "2026-09-20", "end_date": "2026-09-07"},
        headers=auth_headers,
    )
    assert bad.status_code == 422

    sid = (await client.post("/sprints", json=SPRINT, headers=auth_headers)).json()["id"]
    resp = await client.put(f"/sprints/{sid}", json={"end_date": "2026-09-01"}, headers=auth_headers)
    assert resp.status_code == 400


async def test_task_cannot_join_sprint_of_another_workspace(
    client: AsyncClient, auth_headers: dict[str, str], second_auth_headers: dict[str, str]
) -> None:
    bobs_sprint = (await client.post("/sprints", json=SPRINT, headers=second_auth_headers)).json()
    resp = await client.post(
        "/tasks", json={"title": "Sneak in", "sprint_id": bobs_sprint["id"]}, headers=auth_headers
    )
    assert resp.status_code == 400

    unknown = await client.put(
        f"/sprints/{bobs_sprint['id']}", json={"name": "Mine now"}, headers=auth_headers
    )
    assert unknown.status_code == 404
