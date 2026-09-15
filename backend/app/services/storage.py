"""Attachment bytes on S3-compatible object storage (Cloudflare R2, AWS S3, MinIO).

Off unless S3_BUCKET is set — then the attachments API keeps bytes in Postgres
with the small legacy cap. Uploads and downloads are proxied through the API,
so the bucket needs no CORS rules and never has to be public.
"""

import asyncio
import logging
from collections.abc import Iterator
from functools import lru_cache
from typing import Any, cast
from uuid import UUID, uuid4

from app.config import get_settings

log = logging.getLogger(__name__)

_DELETE_BATCH = 1000  # S3 DeleteObjects hard limit


def enabled() -> bool:
    return bool(get_settings().s3_bucket)


def new_key(task_id: UUID) -> str:
    """Object key for a fresh upload. Never derived from the user's filename."""
    return f"attachments/{task_id}/{uuid4()}"


@lru_cache
def _client() -> Any:
    import boto3  # imported lazily: not needed when storage is off
    from botocore.config import Config

    s = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=s.s3_endpoint_url or None,
        region_name=s.s3_region,
        aws_access_key_id=s.s3_access_key_id or None,
        aws_secret_access_key=s.s3_secret_access_key or None,
        config=Config(signature_version="s3v4", retries={"max_attempts": 3}),
    )


async def put(key: str, data: bytes, content_type: str) -> None:
    # ponytail: whole body in memory (capped by ATTACHMENT_MAX_MB); switch to
    # upload_fileobj multipart if the cap grows past ~100 MB.
    await asyncio.to_thread(
        _client().put_object,
        Bucket=get_settings().s3_bucket,
        Key=key,
        Body=data,
        ContentType=content_type,
    )


async def open_stream(key: str) -> Iterator[bytes]:
    """Chunks of one object; hand it to a StreamingResponse (Starlette iterates sync
    iterators in a worker thread)."""
    obj = await asyncio.to_thread(_client().get_object, Bucket=get_settings().s3_bucket, Key=key)
    return cast(Iterator[bytes], obj["Body"].iter_chunks())


async def delete_many(keys: list[str]) -> None:
    """Best effort, after the DB commit: a failure leaves an orphan object behind,
    never a failed request."""
    bucket = get_settings().s3_bucket
    for i in range(0, len(keys), _DELETE_BATCH):
        batch = [{"Key": k} for k in keys[i : i + _DELETE_BATCH]]
        try:
            await asyncio.to_thread(
                _client().delete_objects, Bucket=bucket, Delete={"Objects": batch, "Quiet": True}
            )
        except Exception:
            log.exception("could not delete %d attachment object(s) from %s", len(batch), bucket)
