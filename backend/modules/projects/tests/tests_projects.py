"""Phase 7 gate: the project directory excludes over-clearance projects SERVER-side
(FILTER pattern), and the detail endpoint is IDOR-safe (an over-clearance id
returns 403 + a DENIED audit row, never the record body)."""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from modules.iam.infrastructure.models import AuditEvent
from modules.iam.tests.factories import RoleFactory, UserFactory
from modules.projects.application import services
from modules.projects.infrastructure.models import Project

pytestmark = pytest.mark.django_db


@pytest.fixture
def portfolio() -> dict[int, Project]:
    out = {}
    for level in (1, 2, 3, 4):
        out[level] = Project.objects.create(
            name_ar=f"مشروع{level}",
            name_en=f"Project L{level}",
            status=Project.Status.ACTIVE,
            progress=50,
            classification=level,
            lead="Lead Officer",
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


def test_list_excludes_over_clearance_projects(api_client: APIClient, portfolio) -> None:
    _login(api_client, modules=["projects"], clearance=2)
    rows = api_client.get("/api/projects/").json()
    levels = {r["classification"] for r in rows}
    # Only projects at or below the viewer's clearance are returned at all.
    assert levels == {1, 2}


def test_detail_over_clearance_denied_and_audited(api_client: APIClient, portfolio) -> None:
    _login(api_client, modules=["projects"], clearance=2)
    resp = api_client.get(f"/api/projects/{portfolio[4].id}")
    assert resp.status_code == 403
    assert "name_en" not in resp.json()
    assert AuditEvent.objects.filter(
        action="view_project", target_id=str(portfolio[4].id), result="DENIED"
    ).exists()


def test_detail_authorized_returns_project_and_audits(api_client: APIClient, portfolio) -> None:
    _login(api_client, modules=["projects"], clearance=3)
    resp = api_client.get(f"/api/projects/{portfolio[3].id}")
    assert resp.status_code == 200
    assert resp.json()["name_en"] == "Project L3"
    assert AuditEvent.objects.filter(
        action="view_project", target_id=str(portfolio[3].id), result="GRANTED"
    ).exists()


def test_projects_require_module(api_client: APIClient, portfolio) -> None:
    assert api_client.get("/api/projects/").status_code == 403  # unauthenticated
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'projects'
    assert api_client.get("/api/projects/").status_code == 403


def _payload(classification: int) -> dict[str, object]:
    return {
        "name_ar": "مشروع جديد",
        "name_en": "New Project",
        "status": Project.Status.PLANNING,
        "progress": 0,
        "classification": classification,
        "lead": "New Lead",
    }


def test_create_within_clearance_201_and_audited(api_client: APIClient) -> None:
    _login(api_client, modules=["projects"], clearance=3)
    resp = api_client.post("/api/projects/", _payload(2), format="json")
    assert resp.status_code == 201
    assert resp.json()["name_en"] == "New Project"
    new_id = resp.json()["id"]
    assert AuditEvent.objects.filter(
        action="create_project", target_id=str(new_id), result="GRANTED"
    ).exists()


def test_create_above_clearance_403(api_client: APIClient) -> None:
    _login(api_client, modules=["projects"], clearance=2)
    resp = api_client.post("/api/projects/", _payload(4), format="json")
    assert resp.status_code == 403
    assert not Project.objects.filter(name_en="New Project").exists()


def test_create_invalid_classification_400(api_client: APIClient) -> None:
    _login(api_client, modules=["projects"], clearance=4)
    resp = api_client.post("/api/projects/", _payload(7), format="json")
    assert resp.status_code == 400


def test_list_query_filters(api_client: APIClient, portfolio) -> None:
    _login(api_client, modules=["projects"], clearance=4)
    Project.objects.create(
        name_ar="بوابة",
        name_en="Gateway",
        status=Project.Status.ACTIVE,
        progress=20,
        classification=1,
        lead="Special Lead",
    )
    rows = api_client.get("/api/projects/?q=gatew").json()
    assert {r["name_en"] for r in rows} == {"Gateway"}


def test_list_ordering_whitelist(api_client: APIClient, portfolio) -> None:
    _login(api_client, modules=["projects"], clearance=4)
    rows = api_client.get("/api/projects/?ordering=classification").json()
    assert [r["classification"] for r in rows] == [1, 2, 3, 4]
    # Unknown ordering field is ignored and STILL returns an array.
    rows = api_client.get("/api/projects/?ordering=bogus").json()
    assert isinstance(rows, list)


def test_update_over_clearance_object_403_denied(api_client: APIClient, portfolio) -> None:
    _login(api_client, modules=["projects"], clearance=2)
    resp = api_client.patch(f"/api/projects/{portfolio[4].id}", {"name_en": "X"}, format="json")
    assert resp.status_code == 403
    assert AuditEvent.objects.filter(
        action="view_project", target_id=str(portfolio[4].id), result="DENIED"
    ).exists()


def test_update_raise_classification_above_clearance_403(api_client: APIClient, portfolio) -> None:
    _login(api_client, modules=["projects"], clearance=2)
    resp = api_client.patch(
        f"/api/projects/{portfolio[1].id}", {"classification": 4}, format="json"
    )
    assert resp.status_code == 403
    portfolio[1].refresh_from_db()
    assert portfolio[1].classification == 1


def test_update_within_clearance_200_and_audited(api_client: APIClient, portfolio) -> None:
    _login(api_client, modules=["projects"], clearance=3)
    resp = api_client.patch(
        f"/api/projects/{portfolio[2].id}", {"name_en": "Renamed"}, format="json"
    )
    assert resp.status_code == 200
    assert resp.json()["name_en"] == "Renamed"
    assert AuditEvent.objects.filter(
        action="update_project", target_id=str(portfolio[2].id), result="GRANTED"
    ).exists()


def test_delete_over_clearance_403(api_client: APIClient, portfolio) -> None:
    _login(api_client, modules=["projects"], clearance=2)
    resp = api_client.delete(f"/api/projects/{portfolio[4].id}")
    assert resp.status_code == 403
    assert Project.objects.filter(pk=portfolio[4].id).exists()


def test_delete_success_204_and_audited(api_client: APIClient, portfolio) -> None:
    _login(api_client, modules=["projects"], clearance=3)
    target_id = portfolio[3].id
    resp = api_client.delete(f"/api/projects/{target_id}")
    assert resp.status_code == 204
    assert not Project.objects.filter(pk=target_id).exists()
    assert AuditEvent.objects.filter(
        action="delete_project", target_id=str(target_id), result="GRANTED"
    ).exists()


def test_create_requires_module_and_auth(api_client: APIClient) -> None:
    assert api_client.post("/api/projects/", _payload(1), format="json").status_code == 403
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'projects'
    assert api_client.post("/api/projects/", _payload(1), format="json").status_code == 403


def test_search_respects_clearance(api_client: APIClient, portfolio) -> None:
    role = RoleFactory(code="rs2", modules=["projects"])
    user = UserFactory(username="searcher", role=role, clearance=2)
    # Over-clearance project matches the query but must never surface.
    results = services.search(user, "Project")
    levels = {r["id"] for r in results}
    assert portfolio[4].id not in levels
    assert all(r["kind"] == "project" for r in results)


def test_module_summary_excludes_over_clearance(api_client: APIClient, portfolio) -> None:
    role = RoleFactory(code="rsum2", modules=["projects"])
    user = UserFactory(username="summer", role=role, clearance=2)
    summary = services.module_summary(user)
    assert summary["key"] == "projects"
    assert summary["total"] == 2  # only L1 + L2 are visible
    assert {row["status"] for row in summary["by_status"]} == set(Project.Status.values)
