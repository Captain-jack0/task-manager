"""Move attachment bytes that still live in Postgres into the configured bucket.

Every download of an inline attachment is a full copy out of the database, which
counts against the database provider's network-transfer quota. Once S3_* is set,
new uploads go to the bucket; this command moves the old rows too.

Idempotent and resumable: rows that already have a `storage_key` are skipped and
each file is committed on its own, so an interrupted run can simply be rerun.

    cd backend
    DATABASE_URL=... S3_BUCKET=... S3_ENDPOINT_URL=... S3_REGION=auto \\
    S3_ACCESS_KEY_ID=... S3_SECRET_ACCESS_KEY=... \\
    python -m app.scripts.move_attachments_to_storage

Afterwards run `VACUUM FULL attachments;` on the database to give the space back.
"""

import asyncio
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import undefer

from app.models.attachment import Attachment
from app.services import storage

log = logging.getLogger("move_attachments")

BATCH = 20


async def move_all(session: AsyncSession) -> tuple[int, int]:
    """Move every inline attachment to the bucket. Returns (files, bytes)."""
    if not storage.enabled():
        raise RuntimeError("S3_BUCKET is not set — nothing to move the files into")
    files = total = 0
    while True:
        rows = (
            (
                await session.execute(
                    select(Attachment)
                    .options(undefer(Attachment.data))
                    .where(Attachment.storage_key.is_(None), Attachment.data.is_not(None))
                    .order_by(Attachment.created_at)
                    .limit(BATCH)
                )
            )
            .scalars()
            .all()
        )
        if not rows:
            return files, total
        for att in rows:
            key = storage.new_key(att.task_id)
            await storage.put(key, att.data or b"", att.content_type)
            att.storage_key = key
            att.data = None
            await session.commit()  # one file per commit: a crash loses nothing, rerun resumes
            files += 1
            total += att.size
            log.info("moved %s (%d bytes) -> %s", att.filename, att.size, key)


async def _run() -> None:
    from app.db.session import SessionLocal  # engine is built at import: keep it out of tests

    async with SessionLocal() as session:
        files, total = await move_all(session)
    log.info(
        "done: %d file(s), %.1f MB moved. Now run: VACUUM FULL attachments;",
        files,
        total / 1024 / 1024,
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    asyncio.run(_run())
