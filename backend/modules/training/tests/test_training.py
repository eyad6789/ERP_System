"""Phase 7 gate: the course catalog excludes over-clearance courses SERVER-side
(FILTER pattern), and the detail endpoint is IDOR-safe (an over-clearance id
returns 403 + a DENIED audit row, never the record body)."""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from modules.iam.infrastructure.models import AuditEvent
from modules.iam.tests.factories import RoleFactory, UserFactory
from modules.training.infrastructure.models import TrainingCourse

pytestmark = pytest.mark.django_db


@pytest.fixture
def catalog() -> dict[int, TrainingCourse]:
    out = {}
    for level in (1, 2, 3, 4):
        out[level] = TrainingCourse.objects.create(
            title_ar=f"دورة{level}",
            title_en=f"Course L{level}",
            category="Security",
            hours=8,
            status=TrainingCourse.Status.UPCOMING,
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


def test_list_excludes_over_clearance_courses(api_client: APIClient, catalog) -> None:
    _login(api_client, modules=["training"], clearance=2)
    rows = api_client.get("/api/training/").json()
    levels = {r["classification"] for r in rows}
    # Only courses at or below the viewer's clearance are returned at all.
    assert levels == {1, 2}


def test_detail_over_clearance_denied_and_audited(api_client: APIClient, catalog) -> None:
    _login(api_client, modules=["training"], clearance=2)
    resp = api_client.get(f"/api/training/{catalog[4].id}")
    assert resp.status_code == 403
    assert "title_en" not in resp.json()
    assert AuditEvent.objects.filter(
        action="view_course", target_id=str(catalog[4].id), result="DENIED"
    ).exists()


def test_detail_authorized_returns_course_and_audits(api_client: APIClient, catalog) -> None:
    _login(api_client, modules=["training"], clearance=3)
    resp = api_client.get(f"/api/training/{catalog[3].id}")
    assert resp.status_code == 200
    assert resp.json()["title_en"] == "Course L3"
    assert AuditEvent.objects.filter(
        action="view_course", target_id=str(catalog[3].id), result="GRANTED"
    ).exists()


def test_training_require_module(api_client: APIClient, catalog) -> None:
    assert api_client.get("/api/training/").status_code == 403  # unauthenticated
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'training'
    assert api_client.get("/api/training/").status_code == 403


def _payload(classification: int) -> dict[str, object]:
    return {
        "title_ar": "دورة جديدة",
        "title_en": "New Course",
        "category": "Operations",
        "hours": 12,
        "status": TrainingCourse.Status.UPCOMING,
        "classification": classification,
    }


def test_create_within_clearance_201_and_audited(api_client: APIClient) -> None:
    _login(api_client, modules=["training"], clearance=3)
    resp = api_client.post("/api/training/", _payload(2), format="json")
    assert resp.status_code == 201
    assert resp.json()["title_en"] == "New Course"
    new_id = resp.json()["id"]
    assert AuditEvent.objects.filter(
        action="create_course", target_id=str(new_id), result="GRANTED"
    ).exists()


def test_create_above_clearance_403(api_client: APIClient) -> None:
    _login(api_client, modules=["training"], clearance=2)
    resp = api_client.post("/api/training/", _payload(4), format="json")
    assert resp.status_code == 403
    assert not TrainingCourse.objects.filter(title_en="New Course").exists()


def test_create_invalid_classification_400(api_client: APIClient) -> None:
    _login(api_client, modules=["training"], clearance=4)
    resp = api_client.post("/api/training/", _payload(7), format="json")
    assert resp.status_code == 400


def test_list_query_filters(api_client: APIClient, catalog) -> None:
    _login(api_client, modules=["training"], clearance=4)
    TrainingCourse.objects.create(
        title_ar="قيادة",
        title_en="Leadership",
        category="Management",
        hours=20,
        status=TrainingCourse.Status.UPCOMING,
        classification=1,
    )
    rows = api_client.get("/api/training/?q=leaders").json()
    assert {r["title_en"] for r in rows} == {"Leadership"}


def test_list_ordering_whitelist(api_client: APIClient, catalog) -> None:
    _login(api_client, modules=["training"], clearance=4)
    rows = api_client.get("/api/training/?ordering=classification").json()
    assert [r["classification"] for r in rows] == [1, 2, 3, 4]
    # Unknown ordering field is ignored and STILL returns an array.
    rows = api_client.get("/api/training/?ordering=bogus").json()
    assert isinstance(rows, list)


def test_update_over_clearance_object_403_denied(api_client: APIClient, catalog) -> None:
    _login(api_client, modules=["training"], clearance=2)
    resp = api_client.patch(f"/api/training/{catalog[4].id}", {"title_en": "X"}, format="json")
    assert resp.status_code == 403
    assert AuditEvent.objects.filter(
        action="view_course", target_id=str(catalog[4].id), result="DENIED"
    ).exists()


def test_update_raise_classification_above_clearance_403(api_client: APIClient, catalog) -> None:
    _login(api_client, modules=["training"], clearance=2)
    resp = api_client.patch(f"/api/training/{catalog[1].id}", {"classification": 4}, format="json")
    assert resp.status_code == 403
    catalog[1].refresh_from_db()
    assert catalog[1].classification == 1


def test_update_within_clearance_200_and_audited(api_client: APIClient, catalog) -> None:
    _login(api_client, modules=["training"], clearance=3)
    resp = api_client.patch(
        f"/api/training/{catalog[2].id}", {"title_en": "Renamed"}, format="json"
    )
    assert resp.status_code == 200
    assert resp.json()["title_en"] == "Renamed"
    assert AuditEvent.objects.filter(
        action="update_course", target_id=str(catalog[2].id), result="GRANTED"
    ).exists()


def test_delete_over_clearance_403(api_client: APIClient, catalog) -> None:
    _login(api_client, modules=["training"], clearance=2)
    resp = api_client.delete(f"/api/training/{catalog[4].id}")
    assert resp.status_code == 403
    assert TrainingCourse.objects.filter(pk=catalog[4].id).exists()


def test_delete_success_204_and_audited(api_client: APIClient, catalog) -> None:
    _login(api_client, modules=["training"], clearance=3)
    target_id = catalog[3].id
    resp = api_client.delete(f"/api/training/{target_id}")
    assert resp.status_code == 204
    assert not TrainingCourse.objects.filter(pk=target_id).exists()
    assert AuditEvent.objects.filter(
        action="delete_course", target_id=str(target_id), result="GRANTED"
    ).exists()


def test_create_requires_module_and_auth(api_client: APIClient) -> None:
    assert api_client.post("/api/training/", _payload(1), format="json").status_code == 403
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'training'
    assert api_client.post("/api/training/", _payload(1), format="json").status_code == 403
