"""Phase 7 gate: the asset inventory excludes over-clearance assets SERVER-side
(FILTER pattern), and the detail endpoint is IDOR-safe (an over-clearance id
returns 403 + a DENIED audit row, never the record body)."""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from modules.assets.infrastructure.models import Asset
from modules.iam.infrastructure.models import AuditEvent
from modules.iam.tests.factories import RoleFactory, UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def fleet() -> dict[int, Asset]:
    out = {}
    for level in (1, 2, 3, 4):
        out[level] = Asset.objects.create(
            name_ar=f"أصل{level}",
            name_en=f"Asset L{level}",
            asset_type="Equipment",
            location="Depot",
            condition=Asset.Condition.OPERATIONAL,
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


def test_list_excludes_over_clearance_assets(api_client: APIClient, fleet) -> None:
    _login(api_client, modules=["assets"], clearance=2)
    rows = api_client.get("/api/assets/").json()
    levels = {r["classification"] for r in rows}
    # Only assets at or below the viewer's clearance are returned at all.
    assert levels == {1, 2}


def test_detail_over_clearance_denied_and_audited(api_client: APIClient, fleet) -> None:
    _login(api_client, modules=["assets"], clearance=2)
    resp = api_client.get(f"/api/assets/{fleet[4].id}")
    assert resp.status_code == 403
    assert "name_en" not in resp.json()
    assert AuditEvent.objects.filter(
        action="view_asset", target_id=str(fleet[4].id), result="DENIED"
    ).exists()


def test_detail_authorized_returns_asset_and_audits(api_client: APIClient, fleet) -> None:
    _login(api_client, modules=["assets"], clearance=3)
    resp = api_client.get(f"/api/assets/{fleet[3].id}")
    assert resp.status_code == 200
    assert resp.json()["name_en"] == "Asset L3"
    assert AuditEvent.objects.filter(
        action="view_asset", target_id=str(fleet[3].id), result="GRANTED"
    ).exists()


def test_assets_require_module(api_client: APIClient, fleet) -> None:
    assert api_client.get("/api/assets/").status_code == 403  # unauthenticated
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'assets'
    assert api_client.get("/api/assets/").status_code == 403


def _payload(classification: int) -> dict[str, object]:
    return {
        "name_ar": "أصل جديد",
        "name_en": "New Asset",
        "asset_type": "Vehicle",
        "location": "Garage",
        "condition": Asset.Condition.OPERATIONAL,
        "classification": classification,
    }


def test_create_within_clearance_201_and_audited(api_client: APIClient) -> None:
    _login(api_client, modules=["assets"], clearance=3)
    resp = api_client.post("/api/assets/", _payload(2), format="json")
    assert resp.status_code == 201
    assert resp.json()["name_en"] == "New Asset"
    new_id = resp.json()["id"]
    assert AuditEvent.objects.filter(
        action="create_asset", target_id=str(new_id), result="GRANTED"
    ).exists()


def test_create_above_clearance_403(api_client: APIClient) -> None:
    _login(api_client, modules=["assets"], clearance=2)
    resp = api_client.post("/api/assets/", _payload(4), format="json")
    assert resp.status_code == 403
    assert not Asset.objects.filter(name_en="New Asset").exists()


def test_create_invalid_classification_400(api_client: APIClient) -> None:
    _login(api_client, modules=["assets"], clearance=4)
    resp = api_client.post("/api/assets/", _payload(7), format="json")
    assert resp.status_code == 400


def test_list_query_filters(api_client: APIClient, fleet) -> None:
    _login(api_client, modules=["assets"], clearance=4)
    Asset.objects.create(
        name_ar="مولد",
        name_en="Generator",
        asset_type="Power",
        location="Site B",
        condition=Asset.Condition.OPERATIONAL,
        classification=1,
    )
    rows = api_client.get("/api/assets/?q=generat").json()
    assert {r["name_en"] for r in rows} == {"Generator"}


def test_list_ordering_whitelist(api_client: APIClient, fleet) -> None:
    _login(api_client, modules=["assets"], clearance=4)
    rows = api_client.get("/api/assets/?ordering=classification").json()
    assert [r["classification"] for r in rows] == [1, 2, 3, 4]
    # Unknown ordering field is ignored and STILL returns an array.
    rows = api_client.get("/api/assets/?ordering=bogus").json()
    assert isinstance(rows, list)


def test_update_over_clearance_object_403_denied(api_client: APIClient, fleet) -> None:
    _login(api_client, modules=["assets"], clearance=2)
    resp = api_client.patch(f"/api/assets/{fleet[4].id}", {"name_en": "X"}, format="json")
    assert resp.status_code == 403
    assert AuditEvent.objects.filter(
        action="view_asset", target_id=str(fleet[4].id), result="DENIED"
    ).exists()


def test_update_raise_classification_above_clearance_403(api_client: APIClient, fleet) -> None:
    _login(api_client, modules=["assets"], clearance=2)
    resp = api_client.patch(f"/api/assets/{fleet[1].id}", {"classification": 4}, format="json")
    assert resp.status_code == 403
    fleet[1].refresh_from_db()
    assert fleet[1].classification == 1


def test_update_within_clearance_200_and_audited(api_client: APIClient, fleet) -> None:
    _login(api_client, modules=["assets"], clearance=3)
    resp = api_client.patch(f"/api/assets/{fleet[2].id}", {"name_en": "Renamed"}, format="json")
    assert resp.status_code == 200
    assert resp.json()["name_en"] == "Renamed"
    assert AuditEvent.objects.filter(
        action="update_asset", target_id=str(fleet[2].id), result="GRANTED"
    ).exists()


def test_delete_over_clearance_403(api_client: APIClient, fleet) -> None:
    _login(api_client, modules=["assets"], clearance=2)
    resp = api_client.delete(f"/api/assets/{fleet[4].id}")
    assert resp.status_code == 403
    assert Asset.objects.filter(pk=fleet[4].id).exists()


def test_delete_success_204_and_audited(api_client: APIClient, fleet) -> None:
    _login(api_client, modules=["assets"], clearance=3)
    target_id = fleet[3].id
    resp = api_client.delete(f"/api/assets/{target_id}")
    assert resp.status_code == 204
    assert not Asset.objects.filter(pk=target_id).exists()
    assert AuditEvent.objects.filter(
        action="delete_asset", target_id=str(target_id), result="GRANTED"
    ).exists()


def test_create_requires_module_and_auth(api_client: APIClient) -> None:
    assert api_client.post("/api/assets/", _payload(1), format="json").status_code == 403
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'assets'
    assert api_client.post("/api/assets/", _payload(1), format="json").status_code == 403
