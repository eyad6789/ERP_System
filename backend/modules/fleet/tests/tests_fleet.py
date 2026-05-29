"""Phase 13 gate: the vehicle fleet excludes over-clearance vehicles SERVER-side
(FILTER pattern), and the detail endpoint is IDOR-safe (an over-clearance id
returns 403 + a DENIED audit row, never the record body)."""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from modules.fleet.application import services
from modules.fleet.infrastructure.models import Vehicle
from modules.iam.infrastructure.models import AuditEvent
from modules.iam.tests.factories import RoleFactory, UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def fleet() -> dict[int, Vehicle]:
    out = {}
    for level in (1, 2, 3, 4):
        out[level] = Vehicle.objects.create(
            plate=f"VEH-{level}",
            vtype="Truck",
            make="Volvo",
            status=Vehicle.Status.ACTIVE,
            odometer=1000 * level,
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


def test_list_excludes_over_clearance_vehicles(api_client: APIClient, fleet) -> None:
    _login(api_client, modules=["fleet"], clearance=2)
    rows = api_client.get("/api/fleet/").json()
    levels = {r["classification"] for r in rows}
    # Only vehicles at or below the viewer's clearance are returned at all.
    assert levels == {1, 2}


def test_detail_over_clearance_denied_and_audited(api_client: APIClient, fleet) -> None:
    _login(api_client, modules=["fleet"], clearance=2)
    resp = api_client.get(f"/api/fleet/{fleet[4].id}")
    assert resp.status_code == 403
    assert "plate" not in resp.json()
    assert AuditEvent.objects.filter(
        action="view_vehicle", target_id=str(fleet[4].id), result="DENIED"
    ).exists()


def test_detail_authorized_returns_vehicle_and_audits(api_client: APIClient, fleet) -> None:
    _login(api_client, modules=["fleet"], clearance=3)
    resp = api_client.get(f"/api/fleet/{fleet[3].id}")
    assert resp.status_code == 200
    assert resp.json()["plate"] == "VEH-3"
    assert AuditEvent.objects.filter(
        action="view_vehicle", target_id=str(fleet[3].id), result="GRANTED"
    ).exists()


def test_fleet_require_module(api_client: APIClient, fleet) -> None:
    assert api_client.get("/api/fleet/").status_code == 403  # unauthenticated
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'fleet'
    assert api_client.get("/api/fleet/").status_code == 403


def _payload(classification: int) -> dict[str, object]:
    return {
        "plate": "NEW-001",
        "vtype": "Sedan",
        "make": "Toyota",
        "status": Vehicle.Status.ACTIVE,
        "odometer": 0,
        "classification": classification,
    }


def test_create_within_clearance_201_and_audited(api_client: APIClient) -> None:
    _login(api_client, modules=["fleet"], clearance=3)
    resp = api_client.post("/api/fleet/", _payload(2), format="json")
    assert resp.status_code == 201
    assert resp.json()["plate"] == "NEW-001"
    new_id = resp.json()["id"]
    assert AuditEvent.objects.filter(
        action="create_vehicle", target_id=str(new_id), result="GRANTED"
    ).exists()


def test_create_above_clearance_403(api_client: APIClient) -> None:
    _login(api_client, modules=["fleet"], clearance=2)
    resp = api_client.post("/api/fleet/", _payload(4), format="json")
    assert resp.status_code == 403
    assert not Vehicle.objects.filter(plate="NEW-001").exists()


def test_create_invalid_classification_400(api_client: APIClient) -> None:
    _login(api_client, modules=["fleet"], clearance=4)
    resp = api_client.post("/api/fleet/", _payload(7), format="json")
    assert resp.status_code == 400


def test_list_query_filters(api_client: APIClient, fleet) -> None:
    _login(api_client, modules=["fleet"], clearance=4)
    Vehicle.objects.create(
        plate="GEN-900",
        vtype="Generator Truck",
        make="Scania",
        status=Vehicle.Status.ACTIVE,
        odometer=5,
        classification=1,
    )
    rows = api_client.get("/api/fleet/?q=scania").json()
    assert {r["plate"] for r in rows} == {"GEN-900"}


def test_list_ordering_whitelist(api_client: APIClient, fleet) -> None:
    _login(api_client, modules=["fleet"], clearance=4)
    rows = api_client.get("/api/fleet/?ordering=classification").json()
    assert [r["classification"] for r in rows] == [1, 2, 3, 4]
    # Unknown ordering field is ignored and STILL returns an array.
    rows = api_client.get("/api/fleet/?ordering=bogus").json()
    assert isinstance(rows, list)


def test_update_over_clearance_object_403_denied(api_client: APIClient, fleet) -> None:
    _login(api_client, modules=["fleet"], clearance=2)
    resp = api_client.patch(f"/api/fleet/{fleet[4].id}", {"make": "X"}, format="json")
    assert resp.status_code == 403
    assert AuditEvent.objects.filter(
        action="view_vehicle", target_id=str(fleet[4].id), result="DENIED"
    ).exists()


def test_update_raise_classification_above_clearance_403(api_client: APIClient, fleet) -> None:
    _login(api_client, modules=["fleet"], clearance=2)
    resp = api_client.patch(f"/api/fleet/{fleet[1].id}", {"classification": 4}, format="json")
    assert resp.status_code == 403
    fleet[1].refresh_from_db()
    assert fleet[1].classification == 1


def test_update_within_clearance_200_and_audited(api_client: APIClient, fleet) -> None:
    _login(api_client, modules=["fleet"], clearance=3)
    resp = api_client.patch(f"/api/fleet/{fleet[2].id}", {"make": "Renamed"}, format="json")
    assert resp.status_code == 200
    assert resp.json()["make"] == "Renamed"
    assert AuditEvent.objects.filter(
        action="update_vehicle", target_id=str(fleet[2].id), result="GRANTED"
    ).exists()


def test_delete_over_clearance_403(api_client: APIClient, fleet) -> None:
    _login(api_client, modules=["fleet"], clearance=2)
    resp = api_client.delete(f"/api/fleet/{fleet[4].id}")
    assert resp.status_code == 403
    assert Vehicle.objects.filter(pk=fleet[4].id).exists()


def test_delete_success_204_and_audited(api_client: APIClient, fleet) -> None:
    _login(api_client, modules=["fleet"], clearance=3)
    target_id = fleet[3].id
    resp = api_client.delete(f"/api/fleet/{target_id}")
    assert resp.status_code == 204
    assert not Vehicle.objects.filter(pk=target_id).exists()
    assert AuditEvent.objects.filter(
        action="delete_vehicle", target_id=str(target_id), result="GRANTED"
    ).exists()


def test_create_requires_module_and_auth(api_client: APIClient) -> None:
    assert api_client.post("/api/fleet/", _payload(1), format="json").status_code == 403
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'fleet'
    assert api_client.post("/api/fleet/", _payload(1), format="json").status_code == 403


def test_module_summary_respects_clearance(api_client: APIClient, fleet) -> None:
    role = RoleFactory(code="rs2", modules=["fleet"])
    user = UserFactory(username="us2", role=role, clearance=2)
    summary = services.module_summary(user)
    assert summary["key"] == "fleet"
    assert summary["total"] == 2  # only classifications 1 and 2 are visible
    by_status = {row["status"]: row["count"] for row in summary["by_status"]}
    assert by_status[Vehicle.Status.ACTIVE] == 2


def test_search_respects_clearance(api_client: APIClient, fleet) -> None:
    role = RoleFactory(code="rs3", modules=["fleet"])
    user = UserFactory(username="us3", role=role, clearance=2)
    results = services.search(user, "volvo")
    # Over-clearance vehicles (3, 4) never surface in search.
    ids = {r["id"] for r in results}
    assert ids == {fleet[1].id, fleet[2].id}
    assert all(r["kind"] == "vehicle" for r in results)
    assert services.search(user, "") == []
