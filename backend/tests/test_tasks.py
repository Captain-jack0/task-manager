from httpx import AsyncClient


async def test_list_tasks_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/tasks")
    assert resp.status_code == 401


async def test_create_task_minimal(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    resp = await client.post(
        "/tasks", json={"title": "Buy milk"}, headers=auth_headers
    )
    assert resp.status_code == 201
    task = resp.json()
    assert task["title"] == "Buy milk"
    assert task["status"] == "todo"
    assert task["priority"] == "medium"
    assert task["tags"] == []


async def test_create_task_with_tags(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    tag_a = await client.post("/tags", json={"name": "shopping"}, headers=auth_headers)
    tag_b = await client.post("/tags", json={"name": "home"}, headers=auth_headers)

    resp = await client.post(
        "/tasks",
        json={
            "title": "Buy milk",
            "priority": "high",
            "tag_ids": [tag_a.json()["id"], tag_b.json()["id"]],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    task = resp.json()
    assert task["priority"] == "high"
    assert {t["name"] for t in task["tags"]} == {"shopping", "home"}


async def test_create_task_with_invalid_tag_rejected(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    resp = await client.post(
        "/tasks",
        json={
            "title": "x",
            "tag_ids": ["00000000-0000-0000-0000-000000000000"],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 400


async def test_create_task_empty_title_rejected(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    resp = await client.post(
        "/tasks", json={"title": "   "}, headers=auth_headers
    )
    assert resp.status_code == 422


async def test_list_tasks_pagination_and_filters(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    for i in range(5):
        await client.post(
            "/tasks",
            json={"title": f"Task {i}", "status": "todo" if i % 2 == 0 else "done"},
            headers=auth_headers,
        )
    resp = await client.get("/tasks?status=done", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert all(t["status"] == "done" for t in body["data"])
    assert body["total"] == 2

    resp = await client.get("/tasks?search=Task%201", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 1


async def test_get_task(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    create = await client.post(
        "/tasks", json={"title": "x"}, headers=auth_headers
    )
    task_id = create.json()["id"]
    resp = await client.get(f"/tasks/{task_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["title"] == "x"


async def test_get_nonexistent_task_404(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    resp = await client.get(
        "/tasks/00000000-0000-0000-0000-000000000000", headers=auth_headers
    )
    assert resp.status_code == 404


async def test_update_task_partial(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    create = await client.post("/tasks", json={"title": "x"}, headers=auth_headers)
    task_id = create.json()["id"]
    resp = await client.patch(
        f"/tasks/{task_id}",
        json={"status": "in_progress", "priority": "high"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "in_progress"
    assert body["priority"] == "high"
    assert body["title"] == "x"  # unchanged


async def test_update_task_replaces_tags(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    tag_a = (await client.post("/tags", json={"name": "a"}, headers=auth_headers)).json()
    tag_b = (await client.post("/tags", json={"name": "b"}, headers=auth_headers)).json()
    task = (
        await client.post(
            "/tasks",
            json={"title": "x", "tag_ids": [tag_a["id"]]},
            headers=auth_headers,
        )
    ).json()

    resp = await client.patch(
        f"/tasks/{task['id']}",
        json={"tag_ids": [tag_b["id"]]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert {t["name"] for t in resp.json()["tags"]} == {"b"}


async def test_delete_task(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    create = await client.post("/tasks", json={"title": "x"}, headers=auth_headers)
    task_id = create.json()["id"]
    resp = await client.delete(f"/tasks/{task_id}", headers=auth_headers)
    assert resp.status_code == 204
    resp = await client.get(f"/tasks/{task_id}", headers=auth_headers)
    assert resp.status_code == 404


async def test_user_isolation_on_tasks(
    client: AsyncClient,
    auth_headers: dict[str, str],
    second_auth_headers: dict[str, str],
) -> None:
    create = await client.post(
        "/tasks", json={"title": "alice's task"}, headers=auth_headers
    )
    task_id = create.json()["id"]

    resp = await client.get(f"/tasks/{task_id}", headers=second_auth_headers)
    assert resp.status_code == 404
    resp = await client.patch(
        f"/tasks/{task_id}", json={"title": "hacked"}, headers=second_auth_headers
    )
    assert resp.status_code == 404
    resp = await client.delete(f"/tasks/{task_id}", headers=second_auth_headers)
    assert resp.status_code == 404

    listing = await client.get("/tasks", headers=second_auth_headers)
    assert listing.json()["total"] == 0


async def test_filter_tasks_by_tag(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    tag = (
        await client.post("/tags", json={"name": "filter-me"}, headers=auth_headers)
    ).json()
    await client.post(
        "/tasks",
        json={"title": "tagged", "tag_ids": [tag["id"]]},
        headers=auth_headers,
    )
    await client.post("/tasks", json={"title": "untagged"}, headers=auth_headers)

    resp = await client.get(f"/tasks?tag_id={tag['id']}", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["data"][0]["title"] == "tagged"


async def test_health_endpoint(client: AsyncClient) -> None:
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
