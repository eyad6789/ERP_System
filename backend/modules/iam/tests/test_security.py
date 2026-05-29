"""Account-security suite: password change, MFA enrol, and session listing."""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from modules.iam.application import totp
from modules.iam.infrastructure.models import AuditEvent, User

from .factories import RoleFactory, UserFactory

pytestmark = pytest.mark.django_db


def _login(api_client: APIClient, username: str, password: str = "test-pass-12345") -> None:
    body = {"username": username, "password": password}
    api_client.post("/api/auth/login", body, format="json")


def test_password_change_wrong_old_rejected(api_client: APIClient) -> None:
    UserFactory(username="alice", password="test-pass-12345")
    _login(api_client, "alice")

    resp = api_client.post(
        "/api/auth/password",
        {"old_password": "totally-wrong", "new_password": "brand-new-pass-42"},
        format="json",
    )
    assert resp.status_code == 400
    assert AuditEvent.objects.filter(action="change_password", result="DENIED").exists()


def test_password_change_happy_path(api_client: APIClient) -> None:
    UserFactory(username="alice2", password="test-pass-12345")
    _login(api_client, "alice2")

    resp = api_client.post(
        "/api/auth/password",
        {"old_password": "test-pass-12345", "new_password": "brand-new-pass-42"},
        format="json",
    )
    assert resp.status_code == 204
    user = User.objects.get(username="alice2")
    assert user.check_password("brand-new-pass-42")
    assert AuditEvent.objects.filter(action="change_password", result="GRANTED").exists()


def test_mfa_setup_then_verify_happy_path(api_client: APIClient) -> None:
    UserFactory(username="carol", password="test-pass-12345")
    _login(api_client, "carol")

    setup = api_client.post("/api/auth/mfa/setup", {}, format="json")
    assert setup.status_code == 200
    secret = setup.json()["secret"]
    assert setup.json()["otpauth_uri"].startswith("otpauth://totp/ERP:carol")

    user = User.objects.get(username="carol")
    assert user.mfa_secret == secret
    assert user.mfa_enabled is False  # not enabled until verified

    code = totp.totp_now(secret)
    verify = api_client.post("/api/auth/mfa/verify", {"code": code}, format="json")
    assert verify.status_code == 200
    user.refresh_from_db()
    assert user.mfa_enabled is True
    assert AuditEvent.objects.filter(action="enable_mfa", result="GRANTED").exists()


def test_mfa_verify_wrong_code_rejected(api_client: APIClient) -> None:
    UserFactory(username="dave", password="test-pass-12345")
    _login(api_client, "dave")
    api_client.post("/api/auth/mfa/setup", {}, format="json")

    resp = api_client.post("/api/auth/mfa/verify", {"code": "000000"}, format="json")
    assert resp.status_code == 400
    assert User.objects.get(username="dave").mfa_enabled is False


def test_sessions_list_shape(api_client: APIClient) -> None:
    RoleFactory(code="ops", modules=["dashboard"])
    UserFactory(username="erin", password="test-pass-12345")
    _login(api_client, "erin")

    resp = api_client.get("/api/auth/sessions")
    assert resp.status_code == 200
    rows = resp.json()
    assert len(rows) >= 1
    row = rows[0]
    assert {"key_tail", "expires", "current"} <= set(row)
    assert any(r["current"] for r in rows)
