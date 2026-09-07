from urllib.parse import parse_qs, urlparse

import pytest
from httpx import AsyncClient

from app.services import mailer


async def test_register_creates_user(client: AsyncClient) -> None:
    resp = await client.post(
        "/auth/register",
        json={"email": "new@example.com", "password": "password123"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert "access_token" in body
    assert body["user"]["email"] == "new@example.com"


async def test_register_duplicate_email_rejected(client: AsyncClient) -> None:
    await client.post(
        "/auth/register",
        json={"email": "dup@example.com", "password": "password123"},
    )
    resp = await client.post(
        "/auth/register",
        json={"email": "dup@example.com", "password": "password123"},
    )
    assert resp.status_code == 409


async def test_register_short_password_rejected(client: AsyncClient) -> None:
    resp = await client.post(
        "/auth/register",
        json={"email": "x@example.com", "password": "short"},
    )
    assert resp.status_code == 422


async def test_login_with_valid_credentials(client: AsyncClient) -> None:
    await client.post(
        "/auth/register",
        json={"email": "login@example.com", "password": "password123"},
    )
    resp = await client.post(
        "/auth/login",
        json={"email": "login@example.com", "password": "password123"},
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()


async def test_login_with_wrong_password_rejected(client: AsyncClient) -> None:
    await client.post(
        "/auth/register",
        json={"email": "wrong@example.com", "password": "password123"},
    )
    resp = await client.post(
        "/auth/login",
        json={"email": "wrong@example.com", "password": "different"},
    )
    assert resp.status_code == 401


async def test_login_nonexistent_user_rejected(client: AsyncClient) -> None:
    resp = await client.post(
        "/auth/login",
        json={"email": "nobody@example.com", "password": "password123"},
    )
    assert resp.status_code == 401


async def test_me_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/auth/me")
    assert resp.status_code == 401


async def test_me_returns_current_user(
    client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    resp = await client.get("/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == "alice@example.com"


async def test_me_with_invalid_token(client: AsyncClient) -> None:
    resp = await client.get(
        "/auth/me", headers={"Authorization": "Bearer invalid.token.here"}
    )
    assert resp.status_code == 401


@pytest.fixture
def sent_links(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, str]]:
    """Capture reset emails instead of sending them."""
    links: list[tuple[str, str]] = []
    monkeypatch.setattr(mailer, "send_password_reset", lambda to, link: links.append((to, link)))
    return links


async def _request_reset_token(
    client: AsyncClient, sent_links: list[tuple[str, str]], email: str
) -> str:
    resp = await client.post("/auth/forgot-password", json={"email": email})
    assert resp.status_code == 202
    ((to, link),) = sent_links
    assert to == email
    assert "/reset-password?token=" in link
    return parse_qs(urlparse(link).query)["token"][0]


async def test_forgot_password_unknown_email_is_silent(
    client: AsyncClient, sent_links: list[tuple[str, str]]
) -> None:
    resp = await client.post("/auth/forgot-password", json={"email": "ghost@example.com"})
    assert resp.status_code == 202
    assert sent_links == []


async def test_reset_password_flow(
    client: AsyncClient, sent_links: list[tuple[str, str]]
) -> None:
    await client.post(
        "/auth/register", json={"email": "reset@example.com", "password": "oldpassword1"}
    )
    token = await _request_reset_token(client, sent_links, "reset@example.com")

    resp = await client.post(
        "/auth/reset-password", json={"token": token, "password": "newpassword2"}
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()

    old = await client.post(
        "/auth/login", json={"email": "reset@example.com", "password": "oldpassword1"}
    )
    assert old.status_code == 401
    new = await client.post(
        "/auth/login", json={"email": "reset@example.com", "password": "newpassword2"}
    )
    assert new.status_code == 200

    # Bound to the old hash, so the same link can't be replayed.
    again = await client.post(
        "/auth/reset-password", json={"token": token, "password": "another123"}
    )
    assert again.status_code == 400


async def test_reset_and_access_tokens_are_not_interchangeable(
    client: AsyncClient, sent_links: list[tuple[str, str]]
) -> None:
    reg = await client.post(
        "/auth/register", json={"email": "sneaky@example.com", "password": "password123"}
    )
    access_token = reg.json()["access_token"]
    reset_token = await _request_reset_token(client, sent_links, "sneaky@example.com")

    me = await client.get("/auth/me", headers={"Authorization": f"Bearer {reset_token}"})
    assert me.status_code == 401

    resp = await client.post(
        "/auth/reset-password", json={"token": access_token, "password": "password456"}
    )
    assert resp.status_code == 400


async def test_reset_with_garbage_token_rejected(client: AsyncClient) -> None:
    resp = await client.post(
        "/auth/reset-password", json={"token": "nope", "password": "password123"}
    )
    assert resp.status_code == 400


async def test_reset_short_password_rejected(client: AsyncClient) -> None:
    resp = await client.post("/auth/reset-password", json={"token": "x", "password": "short"})
    assert resp.status_code == 422
