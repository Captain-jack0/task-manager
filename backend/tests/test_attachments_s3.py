"""Attachments with object storage on: bytes go to the bucket, rows keep only the key.

The S3 client is faked in memory; the real one is boto3 against R2/S3."""

from typing import Any
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.repositories import attachment_repo
from app.services import storage


class _Body:
    def __init__(self, data: bytes) -> None:
        self.data = data

    def iter_chunks(self, chunk_size: int = 1024) -> Any:
        for i in range(0, len(self.data), chunk_size):
            yield self.data[i : i + chunk_size]


class FakeS3:
    def __init__(self) -> None:
        self.objects: dict[str, tuple[bytes, str]] = {}

    def put_object(self, *, Bucket: str, Key: str, Body: bytes, ContentType: str) -> None:  # noqa: N803
        assert Bucket == "test-bucket"
        self.objects[Key] = (Body, ContentType)

    def get_object(self, *, Bucket: str, Key: str) -> dict[str, Any]:  # noqa: N803
        return {"Body": _Body(self.objects[Key][0])}

    def delete_object(self, *, Bucket: str, Key: str) -> None:  # noqa: N803
        self.objects.pop(Key, None)


@pytest.fixture
def s3(monkeypatch: pytest.MonkeyPatch) -> FakeS3:
    fake = FakeS3()
    monkeypatch.setattr(get_settings(), "s3_bucket", "test-bucket")
    monkeypatch.setattr(storage, "_client", lambda: fake)
    return fake


async def _task(client: AsyncClient, headers: dict[str, str], title: str) -> str:
    r = await client.post("/tasks", json={"title": title}, headers=headers)
    assert r.status_code == 201, r.text
    return str(r.json()["id"])


async def _upload(
    client: AsyncClient, headers: dict[str, str], task_id: str, name: str, data: bytes
) -> dict[str, Any]:
    r = await client.post(
        f"/tasks/{task_id}/attachments", files={"file": (name, data, "image/png")}, headers=headers
    )
    assert r.status_code == 201, r.text
    return dict(r.json())


async def test_bytes_live_in_the_bucket(
    client: AsyncClient, auth_headers: dict[str, str], session: AsyncSession, s3: FakeS3
) -> None:
    cfg = (await client.get("/attachments/config", headers=auth_headers)).json()
    assert cfg["max_bytes"] == 25 * 1024 * 1024

    task_id = await _task(client, auth_headers, "With a photo")
    payload = b"\x89PNG" + bytes(range(256)) * 10
    meta = await _upload(client, auth_headers, task_id, "shot.png", payload)
    assert meta["size"] == len(payload)

    ((key, (stored, ctype)),) = s3.objects.items()
    assert key.startswith(f"attachments/{task_id}/") and stored == payload and ctype == "image/png"
    row = await attachment_repo.get(session, attachment_id=UUID(meta["id"]), with_data=True)
    assert row is not None and row.storage_key == key and row.data is None

    down = await client.get(f"/attachments/{meta['id']}/download", headers=auth_headers)
    assert down.status_code == 200 and down.content == payload
    assert down.headers["content-type"].startswith("image/png")
    assert down.headers["content-length"] == str(len(payload))
    assert "attachment" in down.headers["content-disposition"]

    assert (
        await client.delete(f"/attachments/{meta['id']}", headers=auth_headers)
    ).status_code == 204
    assert s3.objects == {}


async def test_deleting_tasks_removes_their_objects(
    client: AsyncClient, auth_headers: dict[str, str], s3: FakeS3
) -> None:
    single = await _task(client, auth_headers, "single")
    bulk = await _task(client, auth_headers, "bulk")
    for tid in (single, bulk):
        await _upload(client, auth_headers, tid, "a.png", b"a")
        await _upload(client, auth_headers, tid, "b.png", b"b")
    assert len(s3.objects) == 4

    assert (await client.delete(f"/tasks/{single}", headers=auth_headers)).status_code == 204
    assert len(s3.objects) == 2
    r = await client.post("/tasks/bulk-delete", json={"task_ids": [bulk]}, headers=auth_headers)
    assert r.status_code == 200, r.text
    assert s3.objects == {}
