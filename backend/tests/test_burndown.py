from datetime import UTC, datetime, timedelta

from httpx import AsyncClient


async def test_burndown_replays_status_and_membership(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    today = datetime.now(UTC).date()
    sprint = (
        await client.post(
            "/sprints",
            json={
                "name": "Burn",
                "start_date": (today - timedelta(days=2)).isoformat(),
                "end_date": (today + timedelta(days=4)).isoformat(),
            },
            headers=auth_headers,
        )
    ).json()
    sid = sprint["id"]
    ids = []
    for title in ("a", "b", "c"):
        r = await client.post(
            "/tasks", json={"title": title, "sprint_id": sid}, headers=auth_headers
        )
        assert r.status_code == 201, r.text
        ids.append(r.json()["id"])
    await client.patch(f"/tasks/{ids[0]}", json={"status": "closed"}, headers=auth_headers)
    await client.patch(
        f"/tasks/{ids[1]}", json={"sprint_id": None}, headers=auth_headers
    )  # pulled out again

    rep = (await client.get(f"/sprints/{sid}/report", headers=auth_headers)).json()
    curve = rep["burndown"]
    assert len(curve) == 7
    assert [p["ideal"] for p in curve] == [2.0, 1.7, 1.3, 1.0, 0.7, 0.3, 0.0]
    # days before the tasks existed: nothing in the sprint yet
    assert [p["remaining"] for p in curve[:2]] == [0, 0]
    assert curve[2]["remaining"] == 1  # a closed, b removed, c open
    assert [p["remaining"] for p in curve[3:]] == [None] * 4

    # closing the sprint logs the carry-over and freezes the last point before it
    closed = await client.post(f"/sprints/{sid}/close", json={}, headers=auth_headers)
    assert closed.status_code == 200 and closed.json()["moved"] == 1
    events = (await client.get(f"/tasks/{ids[2]}/activity", headers=auth_headers)).json()
    assert any(
        e["field"] == "sprint_id" and e["old_value"] == sid and e["new_value"] is None
        for e in events
    )
    after = (await client.get(f"/sprints/{sid}/report", headers=auth_headers)).json()["burndown"]
    assert after[2]["remaining"] == 1
    assert [p["remaining"] for p in after[3:]] == [None] * 4
