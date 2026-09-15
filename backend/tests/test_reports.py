from datetime import UTC, datetime, timedelta

from httpx import AsyncClient


async def test_dashboard_counts_people_and_sprint(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    me = (await client.get("/auth/me", headers=auth_headers)).json()
    yesterday = (datetime.now(UTC) - timedelta(days=1)).isoformat()
    next_week = (datetime.now(UTC) + timedelta(days=7)).isoformat()
    today = datetime.now(UTC).date()
    sprint = (
        await client.post(
            "/sprints",
            json={
                "name": "Now",
                "start_date": (today - timedelta(days=1)).isoformat(),
                "end_date": (today + timedelta(days=6)).isoformat(),
            },
            headers=auth_headers,
        )
    ).json()

    async def make(title: str, **extra: object) -> str:
        r = await client.post("/tasks", json={"title": title, **extra}, headers=auth_headers)
        assert r.status_code == 201, r.text
        return r.json()["id"]

    overdue = await make(
        "late",
        due_date=yesterday,
        assignee_id=me["id"],
        estimated_minutes=30,
        sprint_id=sprint["id"],
    )
    await make(
        "soon",
        due_date=next_week,
        assignee_id=me["id"],
        estimated_minutes=45,
        sprint_id=sprint["id"],
    )
    finished = await make("shipped", sprint_id=sprint["id"])
    await client.patch(
        f"/tasks/{finished}",
        json={"status": "closed", "assignee_id": me["id"]},
        headers=auth_headers,
    )
    await client.post(
        f"/tasks/{overdue}/time",
        json={
            "started_at": (datetime.now(UTC) - timedelta(hours=2)).isoformat(),
            "ended_at": (datetime.now(UTC) - timedelta(hours=1)).isoformat(),
        },
        headers=auth_headers,
    )

    r = await client.get("/reports/dashboard?days=7", headers=auth_headers)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["days"] == 7 and len(d["per_day"]) == 7
    assert (d["open"], d["overdue"], d["completed"], d["created"]) == (2, 1, 1, 3)
    assert d["by_status"]["closed"] == 1 and d["by_status"]["todo"] == 2
    assert d["per_day"][-1]["created"] == 3 and d["per_day"][-1]["completed"] == 1

    person = next(p for p in d["people"] if p["user_id"] == me["id"])
    assert (person["open"], person["overdue"], person["completed"]) == (2, 1, 1)
    assert person["estimated_open_minutes"] == 75
    assert person["logged_minutes"] == 60

    assert d["active_sprint"]["name"] == "Now"
    assert (d["active_sprint"]["total"], d["active_sprint"]["finished"]) == (3, 1)


async def test_dashboard_is_per_workspace_and_validates_days(
    client: AsyncClient, auth_headers: dict[str, str], second_auth_headers: dict[str, str]
) -> None:
    await client.post("/tasks", json={"title": "mine"}, headers=auth_headers)
    theirs = (await client.get("/reports/dashboard", headers=second_auth_headers)).json()
    assert theirs["created"] == 0
    assert all(p["open"] == 0 for p in theirs["people"])
    assert (await client.get("/reports/dashboard?days=0", headers=auth_headers)).status_code == 422
    assert (await client.get("/reports/dashboard?days=91", headers=auth_headers)).status_code == 422
