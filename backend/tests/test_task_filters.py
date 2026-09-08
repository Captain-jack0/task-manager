from httpx import AsyncClient


async def test_list_filters_and_suggest(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    proj = (await client.post("/projects", json={"name": "P"}, headers=auth_headers)).json()
    tag = (await client.post("/tags", json={"name": "urgent"}, headers=auth_headers)).json()

    await client.post(
        "/tasks",
        json={
            "title": "Alpha report",
            "project_id": proj["id"],
            "tag_ids": [tag["id"]],
            "estimated_minutes": 20,
            "energy_level": "low",
        },
        headers=auth_headers,
    )
    await client.post(
        "/tasks",
        json={"title": "Beta work", "status": "in_progress"},
        headers=auth_headers,
    )

    by_status = await client.get("/tasks?status=in_progress", headers=auth_headers)
    assert all(t["status"] == "in_progress" for t in by_status.json()["data"])

    by_search = await client.get("/tasks?search=Alpha", headers=auth_headers)
    assert any("Alpha" in t["title"] for t in by_search.json()["data"])

    by_project = await client.get(f"/tasks?project_id={proj['id']}", headers=auth_headers)
    assert all(t["project_id"] == proj["id"] for t in by_project.json()["data"])

    by_tag = await client.get(f"/tasks?tag_id={tag['id']}", headers=auth_headers)
    assert len(by_tag.json()["data"]) >= 1

    suggest = await client.get("/tasks/suggest?minutes=30&energy=low", headers=auth_headers)
    assert suggest.status_code == 200
    assert isinstance(suggest.json()["suggestions"], list)


async def test_field_filters_and_sorting(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    async def make(title: str, **extra: object) -> None:
        r = await client.post("/tasks", json={"title": title, **extra}, headers=auth_headers)
        assert r.status_code == 201, r.text

    me = (await client.get("/auth/me", headers=auth_headers)).json()
    await make(
        "Zeta",
        priority="low",
        energy_level="high",
        estimated_minutes=90,
        due_date="2026-01-10T10:00:00Z",
    )
    await make(
        "Alpha",
        priority="high",
        energy_level="low",
        estimated_minutes=15,
        due_date="2026-01-01T10:00:00Z",
        assignee_id=me["id"],
    )
    await make("Mid", priority="medium", estimated_minutes=30)  # no due date, no energy

    async def titles(qs: str) -> list[str]:
        r = await client.get(f"/tasks?{qs}", headers=auth_headers)
        assert r.status_code == 200, r.text
        return [t["title"] for t in r.json()["data"]]

    assert await titles("priority=high") == ["Alpha"]
    assert await titles("energy=high") == ["Zeta"]
    assert await titles(f"assignee_id={me['id']}") == ["Alpha"]
    assert await titles("unassigned=true&sort=title&order=asc") == ["Mid", "Zeta"]
    assert await titles("has_due_date=false") == ["Mid"]
    assert await titles("due_before=2026-01-05T00:00:00Z") == ["Alpha"]
    assert await titles("due_after=2026-01-05T00:00:00Z") == ["Zeta"]
    assert await titles("max_minutes=30&sort=estimated_minutes&order=asc") == ["Alpha", "Mid"]

    assert await titles("sort=priority&order=desc") == ["Alpha", "Mid", "Zeta"]
    assert await titles("sort=energy&order=desc") == ["Zeta", "Alpha", "Mid"]  # no energy last
    assert await titles("sort=due_date&order=asc") == ["Alpha", "Zeta", "Mid"]  # no date last
    assert await titles("sort=due_date&order=desc") == ["Zeta", "Alpha", "Mid"]
    assert await titles("sort=title&order=asc") == ["Alpha", "Mid", "Zeta"]

    bad = await client.get("/tasks?sort=password_hash", headers=auth_headers)
    assert bad.status_code == 422
