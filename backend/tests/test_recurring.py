from datetime import UTC, datetime

from httpx import AsyncClient

from app.models.task import Recurrence
from app.services.recurrence import next_due


def test_next_due_rules_and_month_clamping() -> None:
    jan31 = datetime(2026, 1, 31, 9, 0, tzinfo=UTC)
    assert next_due(jan31, Recurrence.DAILY) == datetime(2026, 2, 1, 9, 0, tzinfo=UTC)
    assert next_due(jan31, Recurrence.WEEKLY) == datetime(2026, 2, 7, 9, 0, tzinfo=UTC)
    assert next_due(jan31, Recurrence.BIWEEKLY) == datetime(2026, 2, 14, 9, 0, tzinfo=UTC)
    assert next_due(jan31, Recurrence.MONTHLY) == datetime(2026, 2, 28, 9, 0, tzinfo=UTC)
    dec15 = datetime(2026, 12, 15, tzinfo=UTC)
    assert next_due(dec15, Recurrence.MONTHLY) == datetime(2027, 1, 15, tzinfo=UTC)


async def test_closing_a_recurring_task_spawns_the_next_one(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    tag = (await client.post("/tags", json={"name": "weekly"}, headers=auth_headers)).json()["id"]
    created = await client.post(
        "/tasks",
        json={
            "title": "Weekly report",
            "description": "Send the numbers",
            "recurrence": "weekly",
            "due_date": "2026-09-07T09:00:00Z",
            "priority": "high",
            "estimated_minutes": 30,
            "tag_ids": [tag],
        },
        headers=auth_headers,
    )
    assert created.status_code == 201, created.text
    first = created.json()
    assert first["recurrence"] == "weekly"

    # Done (Test) is not the end of the cycle; Closed is.
    await client.patch(f"/tasks/{first['id']}", json={"status": "done"}, headers=auth_headers)
    listed = (await client.get("/tasks?search=Weekly%20report", headers=auth_headers)).json()
    assert listed["total"] == 1

    closed = await client.patch(f"/tasks/{first['id']}", json={"status": "closed"}, headers=auth_headers)
    assert closed.status_code == 200
    listed = (
        await client.get("/tasks?search=Weekly%20report&sort=created_at&order=asc", headers=auth_headers)
    ).json()
    assert listed["total"] == 2
    nxt = listed["data"][1]
    assert nxt["status"] == "todo"
    assert nxt["due_date"].startswith("2026-09-14T09:00:00")
    assert nxt["recurrence"] == "weekly"
    assert (nxt["priority"], nxt["estimated_minutes"], nxt["description"]) == ("high", 30, "Send the numbers")
    assert [t["name"] for t in nxt["tags"]] == ["weekly"]

    # Closing the same task again does not spawn a second copy.
    await client.patch(f"/tasks/{first['id']}", json={"status": "closed"}, headers=auth_headers)
    listed = (await client.get("/tasks?search=Weekly%20report", headers=auth_headers)).json()
    assert listed["total"] == 2

    # Bulk close also spawns, once per recurring task.
    bulk = await client.post(
        "/tasks/bulk", json={"task_ids": [nxt["id"]], "status": "closed"}, headers=auth_headers
    )
    assert bulk.status_code == 200
    listed = (await client.get("/tasks?search=Weekly%20report", headers=auth_headers)).json()
    assert listed["total"] == 3


async def test_non_recurring_tasks_are_untouched(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    created = (await client.post("/tasks", json={"title": "Once"}, headers=auth_headers)).json()
    await client.patch(f"/tasks/{created['id']}", json={"status": "closed"}, headers=auth_headers)
    listed = (await client.get("/tasks?search=Once", headers=auth_headers)).json()
    assert listed["total"] == 1
