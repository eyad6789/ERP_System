"""Phase 6 gate: the GIS map is clearance-filtered server-side — sites above the
viewer's clearance are excluded from the list entirely, and a direct detail
fetch of an over-clearance site is denied (403) and audited DENIED.
"""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from modules.gis.infrastructure.models import Site
from modules.iam.infrastructure.models import AuditEvent
from modules.iam.tests.factories import RoleFactory, UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def sites() -> dict[int, Site]:
    out = {}
    for level in (1, 2, 3, 4):
        out[level] = Site.objects.create(
            name_ar=f"موقع{level}",
            name_en=f"Site L{level}",
            site_type=Site.SiteType.FACILITY,
            lat=33.0 + level,
            lng=44.0 + level,
            classification=level,
            info_ar=f"معلومات{level}",
            info_en=f"info-{level}",
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


def test_list_excludes_over_clearance_sites(api_client: APIClient, sites) -> None:
    _login(api_client, modules=["gis"], clearance=2)
    rows = api_client.get("/api/gis/sites").json()
    levels = {r["classification"] for r in rows}
    # Only sites at or below clearance 2 are returned; 3/4 are excluded entirely.
    assert levels == {1, 2}
    assert all(r["classification"] <= 2 for r in rows)


def test_detail_over_clearance_denied_and_audited(api_client: APIClient, sites) -> None:
    _login(api_client, modules=["gis"], clearance=2)
    resp = api_client.get(f"/api/gis/sites/{sites[4].id}")
    assert resp.status_code == 403
    assert AuditEvent.objects.filter(
        action="view_site", target_id=str(sites[4].id), result="DENIED"
    ).exists()


def test_detail_authorized_returns_site_and_audits_granted(api_client: APIClient, sites) -> None:
    _login(api_client, modules=["gis"], clearance=3)
    resp = api_client.get(f"/api/gis/sites/{sites[3].id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["name_en"] == "Site L3"
    assert body["lat"] == sites[3].lat and body["lng"] == sites[3].lng
    assert AuditEvent.objects.filter(
        action="view_site", target_id=str(sites[3].id), result="GRANTED"
    ).exists()


def test_gis_requires_module(api_client: APIClient, sites) -> None:
    assert api_client.get("/api/gis/sites").status_code == 403  # unauthenticated
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'gis'
    assert api_client.get("/api/gis/sites").status_code == 403


def _payload(classification: int, name_en: str = "New Site") -> dict[str, object]:
    return {
        "name_ar": "موقع جديد",
        "name_en": name_en,
        "site_type": Site.SiteType.UNIT,
        "lat": 30.5,
        "lng": 31.5,
        "info_ar": "معلومات",
        "info_en": "info",
        "classification": classification,
    }


def test_list_is_top_level_array(api_client: APIClient, sites) -> None:
    _login(api_client, modules=["gis"], clearance=4)
    body = api_client.get("/api/gis/sites").json()
    assert isinstance(body, list)


def test_create_within_clearance_returns_201_and_audits(api_client: APIClient) -> None:
    _login(api_client, modules=["gis"], clearance=3)
    resp = api_client.post("/api/gis/sites", _payload(classification=2), format="json")
    assert resp.status_code == 201
    body = resp.json()
    assert body["name_en"] == "New Site"
    assert Site.objects.filter(pk=body["id"]).exists()
    assert AuditEvent.objects.filter(
        action="create_site", target_id=str(body["id"]), result="GRANTED"
    ).exists()


def test_create_above_clearance_returns_403(api_client: APIClient) -> None:
    _login(api_client, modules=["gis"], clearance=2)
    resp = api_client.post("/api/gis/sites", _payload(classification=4), format="json")
    assert resp.status_code == 403
    assert not Site.objects.filter(name_en="New Site").exists()


def test_create_invalid_classification_returns_400(api_client: APIClient) -> None:
    _login(api_client, modules=["gis"], clearance=4)
    resp = api_client.post("/api/gis/sites", _payload(classification=9), format="json")
    assert resp.status_code == 400


def test_list_q_filters(api_client: APIClient, sites) -> None:
    _login(api_client, modules=["gis"], clearance=4)
    rows = api_client.get("/api/gis/sites", {"q": "Site L3"}).json()
    assert isinstance(rows, list)
    assert {r["name_en"] for r in rows} == {"Site L3"}


def test_list_ordering_whitelist_and_unknown_ignored(api_client: APIClient, sites) -> None:
    _login(api_client, modules=["gis"], clearance=4)
    rows = api_client.get("/api/gis/sites", {"ordering": "name_en"}).json()
    names = [r["name_en"] for r in rows]
    assert names == sorted(names)
    # Unknown ordering keys are ignored and still yield a valid array.
    rows2 = api_client.get("/api/gis/sites", {"ordering": "lat"}).json()
    assert isinstance(rows2, list)
    assert len(rows2) == len(rows)


def test_update_over_clearance_object_denied(api_client: APIClient, sites) -> None:
    _login(api_client, modules=["gis"], clearance=2)
    resp = api_client.patch(f"/api/gis/sites/{sites[4].id}", {"name_en": "Hacked"}, format="json")
    assert resp.status_code == 403
    assert AuditEvent.objects.filter(
        action="view_site", target_id=str(sites[4].id), result="DENIED"
    ).exists()
    sites[4].refresh_from_db()
    assert sites[4].name_en == "Site L4"


def test_update_raising_classification_above_clearance_returns_403(
    api_client: APIClient, sites
) -> None:
    _login(api_client, modules=["gis"], clearance=2)
    resp = api_client.patch(f"/api/gis/sites/{sites[1].id}", {"classification": 4}, format="json")
    assert resp.status_code == 403
    assert AuditEvent.objects.filter(
        action="update_site", target_id=str(sites[1].id), result="DENIED"
    ).exists()
    sites[1].refresh_from_db()
    assert sites[1].classification == 1


def test_update_within_clearance_succeeds_and_audits(api_client: APIClient, sites) -> None:
    _login(api_client, modules=["gis"], clearance=3)
    resp = api_client.patch(f"/api/gis/sites/{sites[2].id}", {"name_en": "Renamed"}, format="json")
    assert resp.status_code == 200
    assert resp.json()["name_en"] == "Renamed"
    assert AuditEvent.objects.filter(
        action="update_site", target_id=str(sites[2].id), result="GRANTED"
    ).exists()


def test_delete_over_clearance_denied(api_client: APIClient, sites) -> None:
    _login(api_client, modules=["gis"], clearance=2)
    resp = api_client.delete(f"/api/gis/sites/{sites[4].id}")
    assert resp.status_code == 403
    assert Site.objects.filter(pk=sites[4].id).exists()
    assert AuditEvent.objects.filter(
        action="view_site", target_id=str(sites[4].id), result="DENIED"
    ).exists()


def test_delete_within_clearance_returns_204_and_audits(api_client: APIClient, sites) -> None:
    _login(api_client, modules=["gis"], clearance=3)
    deleted_id = sites[2].id
    resp = api_client.delete(f"/api/gis/sites/{deleted_id}")
    assert resp.status_code == 204
    assert not Site.objects.filter(pk=deleted_id).exists()
    assert AuditEvent.objects.filter(
        action="delete_site", target_id=str(deleted_id), result="GRANTED"
    ).exists()


def test_mutations_require_module_and_auth(api_client: APIClient, sites) -> None:
    detail = f"/api/gis/sites/{sites[1].id}"
    # Unauthenticated create/patch/delete are blocked.
    assert api_client.post("/api/gis/sites", _payload(1), format="json").status_code == 403
    assert api_client.patch(detail, {"name_en": "x"}, format="json").status_code == 403
    assert api_client.delete(detail).status_code == 403
    # Authenticated but lacking the gis module is also blocked.
    _login(api_client, modules=["dashboard"], clearance=4)
    assert api_client.post("/api/gis/sites", _payload(1), format="json").status_code == 403
