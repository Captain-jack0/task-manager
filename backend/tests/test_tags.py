from httpx import AsyncClient


async def test_list_tags_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/tags")
    assert resp.status_code == 401


async def test_create_and_list_tags(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    create = await client.post(
        "/tags", json={"name": "work", "color": "#ff0000"}, headers=auth_headers
    )
    assert create.status_code == 201
    tag = create.json()
    assert tag["name"] == "work"
    assert tag["color"] == "#ff0000"

    listing = await client.get("/tags", headers=auth_headers)
    assert listing.status_code == 200
    names = [t["name"] for t in listing.json()]
    assert "work" in names


async def test_tag_color_validation(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    resp = await client.post(
        "/tags", json={"name": "bad", "color": "not-a-hex"}, headers=auth_headers
    )
    assert resp.status_code == 422


async def test_duplicate_tag_name_rejected(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    await client.post("/tags", json={"name": "urgent"}, headers=auth_headers)
    resp = await client.post("/tags", json={"name": "urgent"}, headers=auth_headers)
    assert resp.status_code == 409


async def test_update_tag(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    create = await client.post("/tags", json={"name": "old"}, headers=auth_headers)
    tag_id = create.json()["id"]
    resp = await client.patch(
        f"/tags/{tag_id}",
        json={"name": "new", "color": "#00ff00"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "new"


async def test_delete_tag(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    create = await client.post("/tags", json={"name": "delme"}, headers=auth_headers)
    tag_id = create.json()["id"]
    resp = await client.delete(f"/tags/{tag_id}", headers=auth_headers)
    assert resp.status_code == 204


async def test_user_cannot_access_other_users_tag(
    client: AsyncClient,
    auth_headers: dict[str, str],
    second_auth_headers: dict[str, str],
) -> None:
    create = await client.post(
        "/tags", json={"name": "alice-tag"}, headers=auth_headers
    )
    tag_id = create.json()["id"]
    # bob tries to update alice's tag
    resp = await client.patch(
        f"/tags/{tag_id}", json={"name": "hacked"}, headers=second_auth_headers
    )
    assert resp.status_code == 404
    resp = await client.delete(f"/tags/{tag_id}", headers=second_auth_headers)
    assert resp.status_code == 404
