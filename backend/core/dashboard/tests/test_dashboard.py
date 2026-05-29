"""Phase 2 gate: dashboard endpoint enforces permissions and leaks no data the
caller can't see (the recent-audit feed is gated by the `audit` module)."""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from modules.iam.infrastructure.models import AuditEvent
from modules.iam.tests.factories import RoleFactory, UserFactory

pytestmark = pytest.mark.django_db


def _login(api_client: APIClient, username: str, modules: list[str], clearance: int = 2) -> None:
    role = RoleFactory(code=f"role_{username}", modules=modules)
    UserFactory(username=username, password="test-pass-12345", role=role, clearance=clearance)
    api_client.post(
        "/api/auth/login", {"username": username, "password": "test-pass-12345"}, format="json"
    )


def test_dashboard_requires_authentication(api_client: APIClient) -> None:
    assert api_client.get("/api/dashboard/summary").status_code == 403


def test_dashboard_requires_dashboard_module(api_client: APIClient) -> None:
    _login(api_client, "nodash", modules=["personnel"])  # no 'dashboard'
    resp = api_client.get("/api/dashboard/summary")
    assert resp.status_code == 403
    assert AuditEvent.objects.filter(
        action="open_module", target_type="dashboard", result="DENIED"
    ).exists()


def test_dashboard_returns_real_aggregates(api_client: APIClient) -> None:
    _login(api_client, "viewer", modules=["dashboard"], clearance=2)
    body = api_client.get("/api/dashboard/summary").json()

    assert set(body["kpis"]) == {"total_users", "total_roles", "audit_events_7d", "denied_7d"}
    # Clearance distribution always lists all 4 levels; counts reflect real users.
    assert [d["level"] for d in body["clearance_distribution"]] == [1, 2, 3, 4]
    total = sum(d["count"] for d in body["clearance_distribution"])
    assert total == body["kpis"]["total_users"]
    # 7-day activity series has exactly 7 day-buckets.
    assert len(body["audit_activity"]) == 7


def test_recent_audit_feed_gated_by_audit_module(api_client: APIClient) -> None:
    # User WITHOUT the 'audit' module must not receive the recent-audit feed.
    _login(api_client, "plain", modules=["dashboard"])
    assert "recent_audit" not in api_client.get("/api/dashboard/summary").json()


def test_recent_audit_feed_present_with_audit_module(api_client: APIClient) -> None:
    _login(api_client, "auditor", modules=["dashboard", "audit"], clearance=3)
    body = api_client.get("/api/dashboard/summary").json()
    assert "recent_audit" in body
    assert isinstance(body["recent_audit"], list)
