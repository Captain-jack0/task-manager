from httpx import AsyncClient

from app.models.attachment import MAX_ATTACHMENT_BYTES


async def test_upload_list_download_delete(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    task = (await client.post("/tasks", json={"title": "With files"}, headers=auth_headers)).json()
    up = await client.post(
        f"/tasks/{task['id']}/attachments",
        files={"file": ("notlar ü.txt", b"hello attachment", "text/plain")},
        headers=auth_headers,
    )
    assert up.status_code == 201, up.text
    meta = up.json()
    assert (meta["filename"], meta["content_type"], meta["size"]) == ("notlar ü.txt", "text/plain", 16)
    assert meta["uploader_email"] == "alice@example.com"

    listed = await client.get(f"/tasks/{task['id']}/attachments", headers=auth_headers)
    assert [a["id"] for a in listed.json()] == [meta["id"]]

    down = await client.get(f"/attachments/{meta['id']}/download", headers=auth_headers)
    assert down.status_code == 200
    assert down.content == b"hello attachment"
    assert down.headers["content-type"].startswith("text/plain")
    assert "attachment" in down.headers["content-disposition"]
    assert down.headers["x-content-type-options"] == "nosniff"

    activity = (await client.get(f"/tasks/{task['id']}/activity", headers=auth_headers)).json()
    assert activity[0]["field"] == "attachment" and activity[0]["new_value"] == "notlar ü.txt"

    gone = await client.delete(f"/attachments/{meta['id']}", headers=auth_headers)
    assert gone.status_code == 204
    assert (await client.get(f"/tasks/{task['id']}/attachments", headers=auth_headers)).json() == []
    assert (await client.get(f"/attachments/{meta['id']}/download", headers=auth_headers)).status_code == 404


async def test_size_limit_and_empty_file(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    task = (await client.post("/tasks", json={"title": "Big"}, headers=auth_headers)).json()
    too_big = await client.post(
        f"/tasks/{task['id']}/attachments",
        files={"file": ("big.bin", b"x" * (MAX_ATTACHMENT_BYTES + 1), "application/octet-stream")},
        headers=auth_headers,
    )
    assert too_big.status_code == 413
    empty = await client.post(
        f"/tasks/{task['id']}/attachments", files={"file": ("empty.txt", b"", "text/plain")}, headers=auth_headers
    )
    assert empty.status_code == 400


async def test_attachments_are_private_to_members(
    client: AsyncClient, auth_headers: dict[str, str], second_auth_headers: dict[str, str]
) -> None:
    task = (await client.post("/tasks", json={"title": "Mine"}, headers=auth_headers)).json()
    meta = (
        await client.post(
            f"/tasks/{task['id']}/attachments",
            files={"file": ("a.txt", b"secret", "text/plain")},
            headers=auth_headers,
        )
    ).json()
    assert (await client.get(f"/attachments/{meta['id']}/download", headers=second_auth_headers)).status_code == 404
    assert (await client.delete(f"/attachments/{meta['id']}", headers=second_auth_headers)).status_code == 404
    assert (
        await client.post(
            f"/tasks/{task['id']}/attachments", files={"file": ("b.txt", b"x", "text/plain")}, headers=second_auth_headers
        )
    ).status_code == 404
