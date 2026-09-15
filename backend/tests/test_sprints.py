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


async def test_close_sprint_carries_over_unfinished_and_keeps_closed(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    s1 = (await client.post("/sprints", json=SPRINT, headers=auth_headers)).json()["id"]
    s2 = (
        await client.post(
            "/sprints",
            json={"name": "Sprint 2", "start_date": "2026-09-21", "end_date": "2026-10-04"},
            headers=auth_headers,
        )
    ).json()["id"]

    async def make(title: str, status: str) -> str:
        r = await client.post(
            "/tasks", json={"title": title, "status": status, "sprint_id": s1}, headers=auth_headers
        )
        assert r.status_code == 201, r.text
        return r.json()["id"]

    todo = await make("todo", "todo")
    doing = await make("doing", "in_progress")
    testing = await make("in test", "done")
    finished = await make("finished", "closed")

    closed = await client.post(f"/sprints/{s1}/close", json={"move_to": s2}, headers=auth_headers)
    assert closed.status_code == 200, closed.text
    body = closed.json()
    assert (body["moved"], body["kept"]) == (3, 1)
    assert body["sprint"]["closed_at"] is not None

    for tid in (todo, doing, testing):
        assert (await client.get(f"/tasks/{tid}", headers=auth_headers)).json()["sprint_id"] == s2
    assert (await client.get(f"/tasks/{finished}", headers=auth_headers)).json()["sprint_id"] == s1

    # Closed sprints are history: no new tasks, no second close, not a carry-over target.
    again = await client.post(f"/sprints/{s1}/close", json={}, headers=auth_headers)
    assert again.status_code == 409
    join = await client.post("/tasks", json={"title": "late", "sprint_id": s1}, headers=auth_headers)
    assert join.status_code == 400
    into_closed = await client.post(f"/sprints/{s2}/close", json={"move_to": s1}, headers=auth_headers)
    assert into_closed.status_code == 400
    # Editing a task that still sits in the closed sprint (same sprint_id) is allowed.
    edit_kept = await client.patch(
        f"/tasks/{finished}", json={"title": "finished!", "sprint_id": s1}, headers=auth_headers
    )
    assert edit_kept.status_code == 200

    # Closing with no target sends unfinished tasks to the backlog.
    to_backlog = await client.post(f"/sprints/{s2}/close", json={}, headers=auth_headers)
    assert to_backlog.status_code == 200 and to_backlog.json()["moved"] == 3
    assert (await client.get(f"/tasks/{todo}", headers=auth_headers)).json()["sprint_id"] is None


async def test_sprint_report_and_carried_over(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    sid = (await client.post("/sprints", json=SPRINT, headers=auth_headers)).json()["id"]
    for title, status, minutes in (
        ("a", "todo", 30),
        ("b", "todo", 60),
        ("c", "done", 120),
        ("d", "closed", 10),
    ):
        r = await client.post(
            "/tasks",
            json={"title": title, "status": status, "estimated_minutes": minutes, "sprint_id": sid},
            headers=auth_headers,
        )
        assert r.status_code == 201, r.text

    rep = (await client.get(f"/sprints/{sid}/report", headers=auth_headers)).json()
    assert rep["by_status"] == {"todo": 2, "in_progress": 0, "blocked": 0, "done": 1, "closed": 1}
    assert (rep["total"], rep["finished"]) == (4, 2)
    assert (rep["estimated_minutes"], rep["estimated_minutes_finished"]) == (220, 130)
    assert rep["sprint"]["carried_over"] == 0

    closed = await client.post(f"/sprints/{sid}/close", json={}, headers=auth_headers)
    assert closed.status_code == 200 and closed.json()["sprint"]["carried_over"] == 3
    after = (await client.get(f"/sprints/{sid}/report", headers=auth_headers)).json()
    assert after["total"] == 1 and after["by_status"]["closed"] == 1
    assert after["sprint"]["carried_over"] == 3
