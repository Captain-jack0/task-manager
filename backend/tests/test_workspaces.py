from httpx import AsyncClient


async def test_create_and_list_workspaces(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    created = await client.post("/workspaces", json={"name": "Team"}, headers=auth_headers)
    assert created.status_code == 201
    assert created.json()["role"] == "owner"
    assert created.json()["is_personal"] is False

    listed = await client.get("/workspaces", headers=auth_headers)
    names = {w["name"] for w in listed.json()}
    assert {"Personal", "Team"} <= names


async def test_member_management_and_capacity(
    client: AsyncClient, auth_headers: dict[str, str], second_auth_headers: dict[str, str]
) -> None:
    wid = (await client.post("/workspaces", json={"name": "Team"}, headers=auth_headers)).json()[
        "id"
    ]

    add = await client.post(
        f"/workspaces/{wid}/members",
        json={"email": "bob@example.com", "role": "member"},
        headers=auth_headers,
    )
    assert add.status_code == 201

    members = await client.get(f"/workspaces/{wid}/members", headers=auth_headers)
    bob = next(m for m in members.json() if m["email"] == "bob@example.com")

    promoted = await client.put(
        f"/workspaces/{wid}/members/{bob['user_id']}",
        json={"role": "admin"},
        headers=auth_headers,
    )
    assert promoted.status_code == 200 and promoted.json()["role"] == "admin"

    capacity = await client.get(f"/workspaces/{wid}/capacity", headers=auth_headers)
    assert capacity.status_code == 200
    assert any(m["email"] == "bob@example.com" for m in capacity.json())

    removed = await client.delete(
        f"/workspaces/{wid}/members/{bob['user_id']}", headers=auth_headers
    )
    assert removed.status_code == 204


async def test_add_unknown_email_404(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    wid = (await client.post("/workspaces", json={"name": "T"}, headers=auth_headers)).json()["id"]
    resp = await client.post(
        f"/workspaces/{wid}/members",
        json={"email": "nobody@example.com", "role": "member"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_duplicate_member_conflict(
    client: AsyncClient, auth_headers: dict[str, str], second_auth_headers: dict[str, str]
) -> None:
    wid = (await client.post("/workspaces", json={"name": "T"}, headers=auth_headers)).json()["id"]
    body = {"email": "bob@example.com", "role": "member"}
    assert (await client.post(f"/workspaces/{wid}/members", json=body, headers=auth_headers)).status_code == 201
    dup = await client.post(f"/workspaces/{wid}/members", json=body, headers=auth_headers)
    assert dup.status_code == 409


async def test_non_member_cannot_access(
    client: AsyncClient, auth_headers: dict[str, str], second_auth_headers: dict[str, str]
) -> None:
    wid = (await client.post("/workspaces", json={"name": "T"}, headers=auth_headers)).json()["id"]
    # bob is not a member → listing that workspace's tasks is forbidden
    resp = await client.get(f"/tasks?workspace_id={wid}", headers=second_auth_headers)
    assert resp.status_code == 403
