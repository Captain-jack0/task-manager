from httpx import AsyncClient


async def test_subscription_feed_and_rotate(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    await client.post(
        "/tasks",
        json={"title": "Dated task", "due_date": "2026-07-20T14:00:00Z"},
        headers=auth_headers,
    )

    sub = await client.get("/calendar/subscription", headers=auth_headers)
    assert sub.status_code == 200
    token = sub.json()["token"]
    assert sub.json()["url"].endswith(f"/calendar/feed/{token}.ics")

    # Public feed — no auth header.
    feed = await client.get(f"/calendar/feed/{token}.ics")
    assert feed.status_code == 200
    assert feed.headers["content-type"].startswith("text/calendar")
    assert "BEGIN:VCALENDAR" in feed.text
    assert "Dated task" in feed.text

    # Unknown token → 404 (no oracle).
    assert (await client.get("/calendar/feed/not-a-real-token.ics")).status_code == 404

    # Rotating invalidates the old token.
    rotated = await client.post("/calendar/subscription/rotate", headers=auth_headers)
    assert rotated.status_code == 200
    assert rotated.json()["token"] != token
    assert (await client.get(f"/calendar/feed/{token}.ics")).status_code == 404


async def test_subscription_requires_auth(client: AsyncClient) -> None:
    assert (await client.get("/calendar/subscription")).status_code == 401
