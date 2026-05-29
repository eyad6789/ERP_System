"""Gate clause (a): unauthenticated requests are rejected (deny-by-default)."""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from modules.iam.infrastructure.models import AuditEvent

from .factories import RoleFactory, UserFactory

pytestmark = pytest.mark.django_db


# DRF's SessionAuthentication sends no WWW-Authenticate header, so unauthenticated
# requests are rejected with 403 (not 401). Returning 403 for both "not
# authenticated" and "forbidden" is intentional here: it avoids leaking whether a
# resource exists or whether the caller merely lacks a session. Either way the
# request is denied by default.
def test_me_requires_authentication(api_client: APIClient) -> None:
    assert api_client.get("/api/me").status_code == 403


def test_audit_requires_authentication(api_client: APIClient) -> None:
    assert api_client.get("/api/audit").status_code == 403


def test_valid_login_succeeds_and_audits_grant(api_client: APIClient) -> None:
    role = RoleFactory(code="ops", modules=["dashboard", "audit"])
    UserFactory(username="alice", password="test-pass-12345", role=role, clearance=3)

    resp = api_client.post(
        "/api/auth/login", {"username": "alice", "password": "test-pass-12345"}, format="json"
    )
    assert resp.status_code == 200
    assert resp.json()["username"] == "alice"
    grants = AuditEvent.objects.filter(action="login", result="GRANTED", actor_label="alice")
    assert grants.count() == 1


def test_invalid_login_rejected_and_audits_deny(api_client: APIClient) -> None:
    UserFactory(username="bob", password="test-pass-12345")
    resp = api_client.post(
        "/api/auth/login", {"username": "bob", "password": "wrong-password"}, format="json"
    )
    assert resp.status_code == 401
    assert AuditEvent.objects.filter(action="login", result="DENIED").count() == 1
