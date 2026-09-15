from httpx import AsyncClient


async def _task(client: AsyncClient, headers: dict[str, str], title: str) -> str:
    r = await client.post("/tasks", json={"title": title}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def test_timer_start_switch_stop(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    a = await _task(client, auth_headers, "A")
    b = await _task(client, auth_headers, "B")

    assert (await client.get("/time/running", headers=auth_headers)).json() is None
    started = await client.post(f"/tasks/{a}/timer/start", headers=auth_headers)
    assert started.status_code == 200 and started.json()["ended_at"] is None
    running = (await client.get("/time/running", headers=auth_headers)).json()
    assert running["task_title"] == "A" and running["entry"]["task_id"] == a

    # Starting another task stops the first one automatically.
    await client.post(f"/tasks/{b}/timer/start", headers=auth_headers)
    a_time = (await client.get(f"/tasks/{a}/time", headers=auth_headers)).json()
    assert a_time["entries"][0]["ended_at"] is not None and a_time["running"] is None
    assert (await client.get("/time/running", headers=auth_headers)).json()["task_title"] == "B"

    # Stopping a task with no running timer is a 409; stopping B works and clears "running".
    assert (await client.post(f"/tasks/{a}/timer/stop", headers=auth_headers)).status_code == 409
    stopped = await client.post(f"/tasks/{b}/timer/stop", headers=auth_headers)
    assert stopped.status_code == 200 and stopped.json()["ended_at"] is not None
    assert (await client.get("/time/running", headers=auth_headers)).json() is None


async def test_manual_entries_totals_report_and_delete(
    client: AsyncClient, auth_headers: dict[str, str], second_auth_headers: dict[str, str]
) -> None:
    t = await _task(client, auth_headers, "Deep work")
    first = await client.post(
        f"/tasks/{t}/time",
        json={"started_at": "2026-09-14T09:00:00Z", "ended_at": "2026-09-14T10:30:00Z", "note": "morning"},
        headers=auth_headers,
    )
    assert first.status_code == 201 and first.json()["minutes"] == 90
    await client.post(
        f"/tasks/{t}/time",
        json={"started_at": "2026-09-15T14:00:00Z", "ended_at": "2026-09-15T14:45:00Z"},
        headers=auth_headers,
    )
    bad = await client.post(
        f"/tasks/{t}/time",
        json={"started_at": "2026-09-15T14:00:00Z", "ended_at": "2026-09-15T13:00:00Z"},
        headers=auth_headers,
    )
    assert bad.status_code == 422

    time = (await client.get(f"/tasks/{t}/time", headers=auth_headers)).json()
    assert time["total_minutes"] == 135
    task = (await client.get(f"/tasks/{t}", headers=auth_headers)).json()
    assert task["logged_minutes"] == 135

    report = await client.get(
        "/time/report?start_at=2026-09-14T00:00:00Z&end_at=2026-09-21T00:00:00Z", headers=auth_headers
    )
    assert report.status_code == 200, report.text
    body = report.json()
    assert body["total_minutes"] == 135
    assert body["rows"][0]["task_title"] == "Deep work" and body["rows"][0]["minutes"] == 135
    outside = (
        await client.get(
            "/time/report?start_at=2026-09-21T00:00:00Z&end_at=2026-09-28T00:00:00Z", headers=auth_headers
        )
    ).json()
    assert outside["rows"] == []

    # Only the owner can delete an entry.
    entry_id = first.json()["id"]
    assert (await client.delete(f"/time/entries/{entry_id}", headers=second_auth_headers)).status_code == 404
    assert (await client.delete(f"/time/entries/{entry_id}", headers=auth_headers)).status_code == 204
    assert (await client.get(f"/tasks/{t}/time", headers=auth_headers)).json()["total_minutes"] == 45
