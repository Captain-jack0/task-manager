#!/usr/bin/env python3
"""
Import Expense Tracker feature tasks into the task-manager app.

Reads a JSON file (default: expense-tracker-tasks.json next to this script),
ensures the required tags exist, then creates each task via the task-manager
REST API. Uses only the Python standard library — no pip install needed.

Usage:
    python import_tasks.py --email you@example.com --password "yourpass"
    python import_tasks.py --email you@example.com --password "yourpass" --register
    python import_tasks.py --dry-run            # print what would be created

Options:
    --base-url   API base (default: http://localhost:8000)
    --email      account email (required unless --dry-run)
    --password   account password (required unless --dry-run)
    --register   register the account first if it does not exist
    --file       tasks JSON path (default: ./expense-tracker-tasks.json)
    --dry-run    validate + print, do not call the API

The task-manager backend must be running and reachable at --base-url
(see task-manager/README.md: `uvicorn app.main:app --reload`).
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path


def _request(method: str, url: str, *, token: str | None = None, body: dict | None = None) -> tuple[int, dict | list | None]:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode("utf-8") or "null"
            return resp.status, json.loads(raw)
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        try:
            parsed = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            parsed = {"detail": raw}
        return exc.code, parsed
    except urllib.error.URLError as exc:
        print(f"ERROR: cannot reach {url} — is the task-manager backend running? ({exc.reason})")
        sys.exit(2)


def login(base_url: str, email: str, password: str, *, register: bool) -> str:
    if register:
        status, payload = _request("POST", f"{base_url}/auth/register",
                                    body={"email": email, "password": password})
        if status in (200, 201):
            print(f"  registered new account: {email}")
            return payload["access_token"]
        if status not in (400, 409):  # 400/409 -> already exists, fall through to login
            print(f"ERROR: register failed ({status}): {payload}")
            sys.exit(1)
        print("  account already exists, logging in instead")

    status, payload = _request("POST", f"{base_url}/auth/login",
                               body={"email": email, "password": password})
    if status != 200:
        print(f"ERROR: login failed ({status}): {payload}")
        sys.exit(1)
    return payload["access_token"]


def ensure_tags(base_url: str, token: str, tag_defs: list[dict]) -> dict[str, str]:
    """Return a {tag_name: tag_id} map, creating any missing tags."""
    status, existing = _request("GET", f"{base_url}/tags", token=token)
    if status != 200:
        print(f"ERROR: could not list tags ({status}): {existing}")
        sys.exit(1)
    name_to_id = {t["name"]: t["id"] for t in existing}

    for tag in tag_defs:
        if tag["name"] in name_to_id:
            continue
        status, created = _request("POST", f"{base_url}/tags", token=token,
                                   body={"name": tag["name"], "color": tag.get("color")})
        if status in (200, 201):
            name_to_id[created["name"]] = created["id"]
            print(f"  + tag '{tag['name']}'")
        else:
            print(f"  ! tag '{tag['name']}' not created ({status}): {created}")
    return name_to_id


def create_tasks(base_url: str, token: str, tasks: list[dict], tag_ids: dict[str, str]) -> None:
    created = 0
    for task in tasks:
        body = {
            "title": task["title"],
            "description": task.get("description"),
            "status": task.get("status", "todo"),
            "priority": task.get("priority", "medium"),
            "tag_ids": [tag_ids[name] for name in task.get("tags", []) if name in tag_ids],
        }
        status, payload = _request("POST", f"{base_url}/tasks", token=token, body=body)
        if status in (200, 201):
            created += 1
            print(f"  + {task['title']}")
        else:
            print(f"  ! FAILED {task['title']} ({status}): {payload}")
    print(f"\nDone. Created {created}/{len(tasks)} tasks.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Expense Tracker tasks into task-manager.")
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--email")
    parser.add_argument("--password")
    parser.add_argument("--register", action="store_true")
    parser.add_argument("--file", default=str(Path(__file__).with_name("expense-tracker-tasks.json")))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    doc = json.loads(Path(args.file).read_text(encoding="utf-8"))
    tags, tasks = doc.get("tags", []), doc.get("tasks", [])
    print(f"Loaded {len(tasks)} tasks and {len(tags)} tags from {args.file}")

    if args.dry_run:
        for task in tasks:
            print(f"  [{task['priority']:>6}] {task['title']}  tags={task.get('tags', [])}")
        print("\nDry run — nothing sent.")
        return

    if not args.email or not args.password:
        print("ERROR: --email and --password are required (or use --dry-run).")
        sys.exit(1)

    base_url = args.base_url.rstrip("/")
    print(f"Authenticating against {base_url} ...")
    token = login(base_url, args.email, args.password, register=args.register)
    print("Ensuring tags ...")
    tag_ids = ensure_tags(base_url, token, tags)
    print("Creating tasks ...")
    create_tasks(base_url, token, tasks, tag_ids)


if __name__ == "__main__":
    main()
