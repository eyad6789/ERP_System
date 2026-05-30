"""Phase 7 gate: the applicant directory excludes over-clearance applicants
SERVER-side (FILTER pattern), and the detail endpoint is IDOR-safe (an
over-clearance id returns 403 + a DENIED audit row, never the record body)."""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from modules.iam.infrastructure.models import AuditEvent
from modules.iam.tests.factories import RoleFactory, UserFactory
from modules.recruitment.infrastructure.models import Applicant

pytestmark = pytest.mark.django_db


@pytest.fixture
def pool() -> dict[int, Applicant]:
    out = {}
    for level in (1, 2, 3, 4):
        out[level] = Applicant.objects.create(
            name=f"Applicant L{level}",
            position="Officer",
            email=f"a{level}@example.gov",
            stage=Applicant.Stage.APPLIED,
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


def test_list_excludes_over_clearance_applicants(api_client: APIClient, pool) -> None:
    _login(api_client, modules=["recruitment"], clearance=2)
    rows = api_client.get("/api/recruitment/").json()
    levels = {r["classification"] for r in rows}
    # Only applicants at or below the viewer's clearance are returned at all.
    assert levels == {1, 2}


def test_detail_over_clearance_denied_and_audited(api_client: APIClient, pool) -> None:
    _login(api_client, modules=["recruitment"], clearance=2)
    resp = api_client.get(f"/api/recruitment/{pool[4].id}")
    assert resp.status_code == 403
    assert "name" not in resp.json()
    assert AuditEvent.objects.filter(
        action="view_applicant", target_id=str(pool[4].id), result="DENIED"
    ).exists()


def test_detail_authorized_returns_applicant_and_audits(api_client: APIClient, pool) -> None:
    _login(api_client, modules=["recruitment"], clearance=3)
    resp = api_client.get(f"/api/recruitment/{pool[3].id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Applicant L3"
    assert AuditEvent.objects.filter(
        action="view_applicant", target_id=str(pool[3].id), result="GRANTED"
    ).exists()


def test_recruitment_require_module(api_client: APIClient, pool) -> None:
    assert api_client.get("/api/recruitment/").status_code == 403  # unauthenticated
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'recruitment'
    assert api_client.get("/api/recruitment/").status_code == 403


def _payload(classification: int) -> dict[str, object]:
    return {
        "name": "New Applicant",
        "position": "Engineer",
        "email": "new@example.gov",
        "stage": Applicant.Stage.APPLIED,
        "classification": classification,
    }


def test_create_within_clearance_201_and_audited(api_client: APIClient) -> None:
    _login(api_client, modules=["recruitment"], clearance=3)
    resp = api_client.post("/api/recruitment/", _payload(2), format="json")
    assert resp.status_code == 201
    assert resp.json()["name"] == "New Applicant"
    new_id = resp.json()["id"]
    assert AuditEvent.objects.filter(
        action="create_applicant", target_id=str(new_id), result="GRANTED"
    ).exists()


def test_create_above_clearance_403(api_client: APIClient) -> None:
    _login(api_client, modules=["recruitment"], clearance=2)
    resp = api_client.post("/api/recruitment/", _payload(4), format="json")
    assert resp.status_code == 403
    assert not Applicant.objects.filter(name="New Applicant").exists()


def test_create_invalid_classification_400(api_client: APIClient) -> None:
    _login(api_client, modules=["recruitment"], clearance=4)
    resp = api_client.post("/api/recruitment/", _payload(7), format="json")
    assert resp.status_code == 400


def test_list_query_filters(api_client: APIClient, pool) -> None:
    _login(api_client, modules=["recruitment"], clearance=4)
    Applicant.objects.create(
        name="Zarah Khan",
        position="Recruiter",
        email="z@example.gov",
        stage=Applicant.Stage.APPLIED,
        classification=1,
    )
    rows = api_client.get("/api/recruitment/?q=zarah").json()
    assert {r["name"] for r in rows} == {"Zarah Khan"}


def test_list_ordering_whitelist(api_client: APIClient, pool) -> None:
    _login(api_client, modules=["recruitment"], clearance=4)
    rows = api_client.get("/api/recruitment/?ordering=classification").json()
    assert [r["classification"] for r in rows] == [1, 2, 3, 4]
    # Unknown ordering field is ignored and STILL returns an array.
    rows = api_client.get("/api/recruitment/?ordering=bogus").json()
    assert isinstance(rows, list)


def test_update_over_clearance_object_403_denied(api_client: APIClient, pool) -> None:
    _login(api_client, modules=["recruitment"], clearance=2)
    resp = api_client.patch(f"/api/recruitment/{pool[4].id}", {"name": "X"}, format="json")
    assert resp.status_code == 403
    assert AuditEvent.objects.filter(
        action="view_applicant", target_id=str(pool[4].id), result="DENIED"
    ).exists()


def test_update_raise_classification_above_clearance_403(api_client: APIClient, pool) -> None:
    _login(api_client, modules=["recruitment"], clearance=2)
    resp = api_client.patch(f"/api/recruitment/{pool[1].id}", {"classification": 4}, format="json")
    assert resp.status_code == 403
    pool[1].refresh_from_db()
    assert pool[1].classification == 1


def test_update_within_clearance_200_and_audited(api_client: APIClient, pool) -> None:
    _login(api_client, modules=["recruitment"], clearance=3)
    resp = api_client.patch(f"/api/recruitment/{pool[2].id}", {"name": "Renamed"}, format="json")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Renamed"
    assert AuditEvent.objects.filter(
        action="update_applicant", target_id=str(pool[2].id), result="GRANTED"
    ).exists()


def test_delete_over_clearance_403(api_client: APIClient, pool) -> None:
    _login(api_client, modules=["recruitment"], clearance=2)
    resp = api_client.delete(f"/api/recruitment/{pool[4].id}")
    assert resp.status_code == 403
    assert Applicant.objects.filter(pk=pool[4].id).exists()


def test_delete_success_204_and_audited(api_client: APIClient, pool) -> None:
    _login(api_client, modules=["recruitment"], clearance=3)
    target_id = pool[3].id
    resp = api_client.delete(f"/api/recruitment/{target_id}")
    assert resp.status_code == 204
    assert not Applicant.objects.filter(pk=target_id).exists()
    assert AuditEvent.objects.filter(
        action="delete_applicant", target_id=str(target_id), result="GRANTED"
    ).exists()


def test_create_requires_module_and_auth(api_client: APIClient) -> None:
    assert api_client.post("/api/recruitment/", _payload(1), format="json").status_code == 403
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'recruitment'
    assert api_client.post("/api/recruitment/", _payload(1), format="json").status_code == 403


def test_search_visible_only(api_client: APIClient, pool) -> None:
    from modules.recruitment.application import public as recruitment

    role = RoleFactory(code="rs2", modules=["recruitment"])
    user = UserFactory(username="su2", role=role, clearance=2)
    results = recruitment.search(user, "Applicant")
    ids = {r["id"] for r in results}
    assert pool[4].id not in ids
    assert pool[1].id in ids
