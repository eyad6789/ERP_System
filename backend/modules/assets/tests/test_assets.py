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
