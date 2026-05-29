"""Phase 7 gate: incidents above the viewer's clearance are excluded from the
list server-side; detail reads are denied (403) + audited for over-clearance;
status changes are clearance-checked and audited."""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from modules.iam.infrastructure.models import AuditEvent
from modules.iam.tests.factories import RoleFactory, UserFactory
from modules.incidents.infrastructure.models import Incident

pytestmark = pytest.mark.django_db


@pytest.fixture
def incidents() -> dict[int, Incident]:
    out = {}
    severities = {1: "medium", 2: "high", 3: "high", 4: "critical"}
    for level in (1, 2, 3, 4):
        out[level] = Incident.objects.create(
            title_ar=f"حادث{level}",
            title_en=f"Incident L{level}",
            severity=severities[level],
            status="open",
            reported_date="2026-05-01",
            classification=level,
        )
    return out


def _login(api_client: APIClient, modules: list[str], clearance: int) -> None:
    role = RoleFactory(code=f"r{clearance}", modules=modules)
    UserFactory(
        username=f"u{clearance}", password="test-pass-12345", role=role, clearance=clearance
    )
    api_client.post(
        "/api/auth/login",
        {"username": f"u{clearance}", "password": "test-pass-12345"},
        format="json",
    )


def test_list_excludes_over_clearance(api_client: APIClient, incidents) -> None:
    _login(api_client, modules=["incidents"], clearance=2)
    rows = api_client.get("/api/incidents/").json()
    levels = {r["classification"] for r in rows}
    # Only level 1 and 2 are returned; 3 and 4 are filtered out server-side.
    assert levels == {1, 2}


def test_detail_over_clearance_denied_and_audited(api_client: APIClient, incidents) -> None:
    _login(api_client, modules=["incidents"], clearance=2)
    resp = api_client.get(f"/api/incidents/{incidents[4].id}")
    assert resp.status_code == 403
    assert AuditEvent.objects.filter(
        action="view_incident", target_id=str(incidents[4].id), result="DENIED"
    ).exists()


def test_detail_authorized(api_client: APIClient, incidents) -> None:
    _login(api_client, modules=["incidents"], clearance=3)
    resp = api_client.get(f"/api/incidents/{incidents[3].id}")
    assert resp.status_code == 200
    assert resp.json()["title_en"] == "Incident L3"
    assert AuditEvent.objects.filter(
        action="view_incident", target_id=str(incidents[3].id), result="GRANTED"
    ).exists()


def test_status_update_audited_and_persists(api_client: APIClient, incidents) -> None:
    _login(api_client, modules=["incidents"], clearance=3)
    resp = api_client.post(
        f"/api/incidents/{incidents[3].id}/status",
        {"status": "closed"},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "closed"
    assert Incident.objects.get(pk=incidents[3].id).status == "closed"
    assert AuditEvent.objects.filter(
        action="update_incident_status", target_id=str(incidents[3].id), result="GRANTED"
    ).exists()


def test_status_update_over_clearance_denied_and_audited(api_client: APIClient, incidents) -> None:
    _login(api_client, modules=["incidents"], clearance=2)
    resp = api_client.post(
        f"/api/incidents/{incidents[4].id}/status",
        {"status": "closed"},
        format="json",
    )
    assert resp.status_code == 403
    assert Incident.objects.get(pk=incidents[4].id).status == "open"
    assert AuditEvent.objects.filter(
        action="view_incident", target_id=str(incidents[4].id), result="DENIED"
    ).exists()


def test_status_update_invalid_status_rejected(api_client: APIClient, incidents) -> None:
    _login(api_client, modules=["incidents"], clearance=2)
    resp = api_client.post(
        f"/api/incidents/{incidents[1].id}/status",
        {"status": "bogus"},
        format="json",
    )
    assert resp.status_code == 400
    assert Incident.objects.get(pk=incidents[1].id).status == "open"


def test_incidents_require_module(api_client: APIClient, incidents) -> None:
    assert api_client.get("/api/incidents/").status_code == 403  # unauthenticated
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'incidents'
    assert api_client.get("/api/incidents/").status_code == 403
