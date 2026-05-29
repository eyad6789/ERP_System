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


def _new_incident_body(classification: int) -> dict[str, object]:
    return {
        "title_ar": "حادث جديد",
        "title_en": "New Incident",
        "severity": "high",
        "status": "open",
        "reported_date": "2026-05-10",
        "classification": classification,
    }


def test_create_within_clearance_returns_201_and_audited(api_client: APIClient) -> None:
    _login(api_client, modules=["incidents"], clearance=3)
    resp = api_client.post("/api/incidents/", _new_incident_body(2), format="json")
    assert resp.status_code == 201
    assert resp.json()["title_en"] == "New Incident"
    new_id = resp.json()["id"]
    assert Incident.objects.filter(pk=new_id).exists()
    assert AuditEvent.objects.filter(
        action="create_incident", target_id=str(new_id), result="GRANTED"
    ).exists()


def test_create_above_clearance_denied(api_client: APIClient) -> None:
    _login(api_client, modules=["incidents"], clearance=2)
    resp = api_client.post("/api/incidents/", _new_incident_body(4), format="json")
    assert resp.status_code == 403
    assert not Incident.objects.filter(title_en="New Incident").exists()


def test_create_invalid_classification_rejected(api_client: APIClient) -> None:
    _login(api_client, modules=["incidents"], clearance=4)
    resp = api_client.post("/api/incidents/", _new_incident_body(5), format="json")
    assert resp.status_code == 400


def test_list_returns_top_level_array(api_client: APIClient, incidents) -> None:
    _login(api_client, modules=["incidents"], clearance=4)
    body = api_client.get("/api/incidents/").json()
    assert isinstance(body, list)


def test_list_q_filters(api_client: APIClient, incidents) -> None:
    _login(api_client, modules=["incidents"], clearance=4)
    rows = api_client.get("/api/incidents/?q=Incident L3").json()
    assert isinstance(rows, list)
    titles = {r["title_en"] for r in rows}
    assert titles == {"Incident L3"}


def test_list_ordering_whitelisted(api_client: APIClient, incidents) -> None:
    _login(api_client, modules=["incidents"], clearance=4)
    rows = api_client.get("/api/incidents/?ordering=title_en").json()
    titles = [r["title_en"] for r in rows]
    assert titles == sorted(titles)


def test_list_ordering_unknown_ignored(api_client: APIClient, incidents) -> None:
    _login(api_client, modules=["incidents"], clearance=4)
    resp = api_client.get("/api/incidents/?ordering=classification")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_update_over_clearance_object_denied_and_audited(api_client: APIClient, incidents) -> None:
    _login(api_client, modules=["incidents"], clearance=2)
    resp = api_client.patch(
        f"/api/incidents/{incidents[4].id}",
        {"title_en": "Hacked"},
        format="json",
    )
    assert resp.status_code == 403
    assert Incident.objects.get(pk=incidents[4].id).title_en == "Incident L4"
    assert AuditEvent.objects.filter(
        action="view_incident", target_id=str(incidents[4].id), result="DENIED"
    ).exists()


def test_update_raise_classification_above_clearance_denied(
    api_client: APIClient, incidents
) -> None:
    _login(api_client, modules=["incidents"], clearance=2)
    resp = api_client.patch(
        f"/api/incidents/{incidents[2].id}",
        {"classification": 4},
        format="json",
    )
    assert resp.status_code == 403
    assert Incident.objects.get(pk=incidents[2].id).classification == 2


def test_update_within_clearance_audited(api_client: APIClient, incidents) -> None:
    _login(api_client, modules=["incidents"], clearance=3)
    resp = api_client.patch(
        f"/api/incidents/{incidents[3].id}",
        {"title_en": "Renamed L3"},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.json()["title_en"] == "Renamed L3"
    assert Incident.objects.get(pk=incidents[3].id).title_en == "Renamed L3"
    assert AuditEvent.objects.filter(
        action="update_incident", target_id=str(incidents[3].id), result="GRANTED"
    ).exists()


def test_delete_over_clearance_denied(api_client: APIClient, incidents) -> None:
    _login(api_client, modules=["incidents"], clearance=2)
    resp = api_client.delete(f"/api/incidents/{incidents[4].id}")
    assert resp.status_code == 403
    assert Incident.objects.filter(pk=incidents[4].id).exists()
    assert AuditEvent.objects.filter(
        action="view_incident", target_id=str(incidents[4].id), result="DENIED"
    ).exists()


def test_delete_success_returns_204_and_audited(api_client: APIClient, incidents) -> None:
    _login(api_client, modules=["incidents"], clearance=3)
    target_id = incidents[3].id
    resp = api_client.delete(f"/api/incidents/{target_id}")
    assert resp.status_code == 204
    assert not Incident.objects.filter(pk=target_id).exists()
    assert AuditEvent.objects.filter(
        action="delete_incident", target_id=str(target_id), result="GRANTED"
    ).exists()


def test_mutations_require_module(api_client: APIClient, incidents) -> None:
    # Unauthenticated mutation is rejected.
    anon = api_client.post("/api/incidents/", _new_incident_body(1), format="json")
    assert anon.status_code == 403
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'incidents'
    create = api_client.post("/api/incidents/", _new_incident_body(1), format="json")
    assert create.status_code == 403
    assert api_client.delete(f"/api/incidents/{incidents[1].id}").status_code == 403
