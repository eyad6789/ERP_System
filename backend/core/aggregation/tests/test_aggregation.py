"""Phase 9: the command-center overview, alerts, and federated search compose
module data with BOTH role and clearance gating."""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from modules.iam.tests.factories import RoleFactory, UserFactory
from modules.incidents.infrastructure.models import Incident
from modules.personnel.infrastructure.models import Person

pytestmark = pytest.mark.django_db

ALL = [
    "dashboard",
    "personnel",
    "documents",
    "finance",
    "operations",
    "assets",
    "gis",
    "incidents",
    "audit",
]


def _login(api_client: APIClient, username: str, modules: list[str], clearance: int = 4) -> None:
    role = RoleFactory(code=f"role_{username}", modules=modules)
    UserFactory(username=username, password="test-pass-12345", role=role, clearance=clearance)
    api_client.post(
        "/api/auth/login", {"username": username, "password": "test-pass-12345"}, format="json"
    )


def test_overview_requires_auth(api_client: APIClient) -> None:
    assert api_client.get("/api/dashboard/overview").status_code == 403


def test_overview_composes_only_granted_modules(api_client: APIClient) -> None:
    Person.objects.create(name_ar="ع", name_en="Person", classification=1)
    _login(api_client, "boss", modules=ALL, clearance=4)
    body = api_client.get("/api/dashboard/overview").json()
    assert "kpis" in body and "alerts" in body
    # sysadmin sees every module slice
    assert set(body["modules"]) == {
        "personnel",
        "documents",
        "finance",
        "operations",
        "assets",
        "incidents",
        "gis",
    }
    assert body["modules"]["personnel"]["total"] == 1


def test_overview_excludes_modules_role_lacks(api_client: APIClient) -> None:
    _login(
        api_client,
        "an",
        modules=["dashboard", "documents", "finance", "gis", "incidents"],
        clearance=2,
    )
    mods = api_client.get("/api/dashboard/overview").json()["modules"]
    assert "personnel" not in mods and "operations" not in mods and "assets" not in mods
    assert "documents" in mods and "incidents" in mods


def test_critical_incident_raises_alert(api_client: APIClient) -> None:
    Incident.objects.create(
        title_ar="ح", title_en="Breach", severity="critical", status="open", classification=1
    )
    _login(api_client, "ops", modules=ALL, clearance=4)
    alerts = api_client.get("/api/alerts").json()["alerts"]
    assert any(a["module"] == "incidents" and a["severity"] == "critical" for a in alerts)


def test_search_is_role_and_clearance_scoped(api_client: APIClient) -> None:
    Person.objects.create(name_ar="سمير", name_en="Sameer Khaled", classification=1)
    _login(api_client, "hr", modules=["dashboard", "personnel"], clearance=2)
    body = api_client.get("/api/search", {"q": "Sameer"}).json()
    assert body["count"] >= 1
    assert any(r["kind"] == "personnel" and "Sameer" in r["label_en"] for r in body["results"])
