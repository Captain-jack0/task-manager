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
