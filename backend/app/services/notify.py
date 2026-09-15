"""Who gets told about what.

- assigned: the new assignee (never the actor themselves) — in-app + email.
- mention:  every workspace member whose @email appears in a comment — in-app + email.
- comment:  the task's assignee and creator (unless they wrote it or were
            mentioned) — in-app only, to keep inboxes quiet.

Rows are queued in the caller's transaction; emails go out as background
tasks after the response.
"""
import re
from uuid import UUID

from fastapi import BackgroundTasks
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.notification import NotificationKind
from app.models.task import Task
from app.models.user import User
from app.repositories import notification_repo, workspace_repo
from app.services import mailer

MENTION_RE = re.compile(r"@([^\s@<>()]+@[^\s@<>()]+)")


def _name(user: User) -> str:
    return user.full_name or user.email


def _task_link(task: Task) -> str:
    return f"{get_settings().public_app_url}/tasks/{task.id}"


async def task_assigned(
    session: AsyncSession, background: BackgroundTasks, *, task: Task, actor: User
) -> None:
    """Call after a task's assignee changed to `task.assignee_id`."""
    if task.assignee_id is None or task.assignee_id == actor.id:
        return
    recipient = await session.get(User, task.assignee_id)
    if recipient is None:
        return
    message = f"{_name(actor)} assigned you: {task.title}"
    await notification_repo.add(
        session,
        user_id=recipient.id,
        kind=NotificationKind.ASSIGNED,
        message=message,
        task_id=task.id,
        actor_id=actor.id,
    )
    background.add_task(
        mailer.send_notification,
        recipient.email,
        f"Assigned to you: {task.title}",
        f"{message}\n\n{_task_link(task)}",
    )


async def comment_posted(
    session: AsyncSession, background: BackgroundTasks, *, task: Task, author: User, body: str
) -> None:
    recipients: dict[UUID, NotificationKind] = {}

    mentioned = {m.lower() for m in MENTION_RE.findall(body)}
    if mentioned:
        users = (
            (await session.execute(select(User).where(func.lower(User.email).in_(mentioned))))
            .scalars()
            .all()
        )
        for user in users:
            if user.id != author.id and await workspace_repo.is_member(
                session, workspace_id=task.workspace_id, user_id=user.id
            ):
                recipients[user.id] = NotificationKind.MENTION

    for uid in (task.assignee_id, task.user_id):
        if uid is not None and uid != author.id and uid not in recipients:
            recipients[uid] = NotificationKind.COMMENT

    for uid, kind in recipients.items():
        verb = "mentioned you in" if kind == NotificationKind.MENTION else "commented on"
        message = f"{_name(author)} {verb}: {task.title}"
        await notification_repo.add(
            session, user_id=uid, kind=kind, message=message, task_id=task.id, actor_id=author.id
        )
        if kind == NotificationKind.MENTION:
            recipient = await session.get(User, uid)
            if recipient is not None:
                background.add_task(
                    mailer.send_notification,
                    recipient.email,
                    f"You were mentioned: {task.title}",
                    f"{message}\n\n{body}\n\n{_task_link(task)}",
                )
