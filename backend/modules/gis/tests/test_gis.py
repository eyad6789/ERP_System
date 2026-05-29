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
