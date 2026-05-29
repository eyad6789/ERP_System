"""Activity endpoint: returns the audit rows scoped to one target."""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from modules.iam.infrastructure.models import AuditEvent

from .factories import RoleFactory, UserFactory

pytestmark = pytest.mark.django_db


def _login(api_client: APIClient, username: str) -> None:
    api_client.post(
        "/api/auth/login",
        {"username": username, "password": "test-pass-12345"},
        format="json",
    )


def test_activity_returns_rows_for_target(api_client: APIClient) -> None:
    role = RoleFactory(code="auditor", modules=["dashboard", "audit"])
    actor = UserFactory(username="frank", password="test-pass-12345", role=role, clearance=4)
    AuditEvent.objects.create(
        actor=actor,
        actor_label="frank",
        action="view_object",
        target_type="Document",
        target_id="7",
        result="GRANTED",
    )
    AuditEvent.objects.create(
        actor=actor,
        actor_label="frank",
        action="edit_object",
        target_type="Document",
        target_id="9",
        result="GRANTED",
    )
    _login(api_client, "frank")

    resp = api_client.get("/api/activity?target_type=Document&target_id=7")
    assert resp.status_code == 200
    rows = resp.json()
    assert len(rows) == 1
    assert rows[0]["target_type"] == "Document"
    assert rows[0]["target_id"] == "7"


def test_activity_requires_audit_module(api_client: APIClient) -> None:
    role = RoleFactory(code="hr", modules=["dashboard", "personnel"])
    UserFactory(username="gina", password="test-pass-12345", role=role, clearance=2)
    _login(api_client, "gina")

    assert api_client.get("/api/activity?target_type=Document&target_id=7").status_code == 403
