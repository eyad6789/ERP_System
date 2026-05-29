"""Phase 3 gate: the directory excludes over-clearance records SERVER-side, and
the profile endpoint is IDOR-safe (an over-clearance id returns 403 + a DENIED
audit row, never the record body)."""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from modules.iam.infrastructure.models import AuditEvent
from modules.iam.tests.factories import RoleFactory, UserFactory
from modules.personnel.infrastructure.models import Person

pytestmark = pytest.mark.django_db


@pytest.fixture
def roster() -> dict[int, Person]:
    people = {}
    for level in (1, 2, 3, 4):
        people[level] = Person.objects.create(
            name_ar=f"شخص{level}", name_en=f"Person L{level}", classification=level
        )
    return people


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


def test_directory_excludes_over_clearance_people(api_client: APIClient, roster) -> None:
    _login(api_client, modules=["personnel"], clearance=2)
    body = api_client.get("/api/personnel/").json()
    returned = {row["classification"] for row in body}
    assert returned <= {1, 2}  # clearance-3 and -4 people are absent
    assert 3 not in returned and 4 not in returned
    assert len(body) == 2


def test_directory_requires_authentication(api_client: APIClient) -> None:
    assert api_client.get("/api/personnel/").status_code == 403


def test_directory_requires_personnel_module(api_client: APIClient, roster) -> None:
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'personnel'
    assert api_client.get("/api/personnel/").status_code == 403


def test_profile_idor_denied_and_audited(api_client: APIClient, roster) -> None:
    _login(api_client, modules=["personnel"], clearance=2)
    high = roster[4]  # Top Secret person
    resp = api_client.get(f"/api/personnel/{high.id}")
    assert resp.status_code == 403
    assert "name_en" not in resp.json()  # body withheld
    assert AuditEvent.objects.filter(
        action="view_personnel", target_id=str(high.id), result="DENIED"
    ).exists()


def test_profile_visible_is_audited_granted(api_client: APIClient, roster) -> None:
    _login(api_client, modules=["personnel"], clearance=3)
    ok = roster[2]
    resp = api_client.get(f"/api/personnel/{ok.id}")
    assert resp.status_code == 200
    assert resp.json()["name_en"] == "Person L2"
    assert AuditEvent.objects.filter(
        action="view_personnel", target_id=str(ok.id), result="GRANTED"
    ).exists()


def test_create_within_clearance_returns_201_and_audits(api_client: APIClient) -> None:
    _login(api_client, modules=["personnel"], clearance=3)
    resp = api_client.post(
        "/api/personnel/",
        {"name_ar": "جديد", "name_en": "New Hire", "classification": 2},
        format="json",
    )
    assert resp.status_code == 201
    created = resp.json()
    assert created["name_en"] == "New Hire"
    assert Person.objects.filter(name_en="New Hire").exists()
    assert AuditEvent.objects.filter(
        action="create_person", target_id=str(created["id"]), result="GRANTED"
    ).exists()


def test_create_above_clearance_returns_403(api_client: APIClient) -> None:
    _login(api_client, modules=["personnel"], clearance=2)
    resp = api_client.post(
        "/api/personnel/",
        {"name_ar": "سري", "name_en": "Too Secret", "classification": 4},
        format="json",
    )
    assert resp.status_code == 403
    assert not Person.objects.filter(name_en="Too Secret").exists()


def test_create_rejects_invalid_classification(api_client: APIClient) -> None:
    _login(api_client, modules=["personnel"], clearance=4)
    resp = api_client.post(
        "/api/personnel/",
        {"name_ar": "خطأ", "name_en": "Bad", "classification": 9},
        format="json",
    )
    assert resp.status_code == 400
    assert not Person.objects.filter(name_en="Bad").exists()


def test_update_over_clearance_object_denied_and_audited(api_client: APIClient, roster) -> None:
    _login(api_client, modules=["personnel"], clearance=2)
    high = roster[4]
    resp = api_client.patch(f"/api/personnel/{high.id}", {"name_en": "Hacked"}, format="json")
    assert resp.status_code == 403
    high.refresh_from_db()
    assert high.name_en == "Person L4"
    assert AuditEvent.objects.filter(
        action="view_person", target_id=str(high.id), result="DENIED"
    ).exists()


def test_update_raising_classification_above_clearance_returns_403(
    api_client: APIClient, roster
) -> None:
    _login(api_client, modules=["personnel"], clearance=2)
    low = roster[1]
    resp = api_client.patch(f"/api/personnel/{low.id}", {"classification": 4}, format="json")
    assert resp.status_code == 403
    low.refresh_from_db()
    assert low.classification == 1


def test_update_within_clearance_returns_200_and_audits(api_client: APIClient, roster) -> None:
    _login(api_client, modules=["personnel"], clearance=3)
    person = roster[2]
    resp = api_client.patch(f"/api/personnel/{person.id}", {"name_en": "Renamed"}, format="json")
    assert resp.status_code == 200
    assert resp.json()["name_en"] == "Renamed"
    assert AuditEvent.objects.filter(
        action="update_person", target_id=str(person.id), result="GRANTED"
    ).exists()


def test_delete_over_clearance_returns_403(api_client: APIClient, roster) -> None:
    _login(api_client, modules=["personnel"], clearance=2)
    high = roster[4]
    resp = api_client.delete(f"/api/personnel/{high.id}")
    assert resp.status_code == 403
    assert Person.objects.filter(pk=high.id).exists()


def test_delete_within_clearance_returns_204_and_audits(api_client: APIClient, roster) -> None:
    _login(api_client, modules=["personnel"], clearance=3)
    person = roster[2]
    person_id = person.id
    resp = api_client.delete(f"/api/personnel/{person_id}")
    assert resp.status_code == 204
    assert not Person.objects.filter(pk=person_id).exists()
    assert AuditEvent.objects.filter(
        action="delete_person", target_id=str(person_id), result="GRANTED"
    ).exists()


def test_list_q_filters_results(api_client: APIClient, roster) -> None:
    _login(api_client, modules=["personnel"], clearance=4)
    Person.objects.create(name_ar="فريد", name_en="Unique Name", classification=1)
    body = api_client.get("/api/personnel/?q=Unique").json()
    assert isinstance(body, list)
    assert [row["name_en"] for row in body] == ["Unique Name"]


def test_list_ordering_whitelist_applies_and_ignores_unknown(api_client: APIClient, roster) -> None:
    _login(api_client, modules=["personnel"], clearance=4)
    ascending = api_client.get("/api/personnel/?ordering=classification").json()
    assert [row["classification"] for row in ascending] == [1, 2, 3, 4]
    # Unknown ordering field is ignored, still a top-level array.
    ignored = api_client.get("/api/personnel/?ordering=bogus").json()
    assert isinstance(ignored, list)
    assert len(ignored) == 4


def test_create_requires_personnel_module(api_client: APIClient) -> None:
    _login(api_client, modules=["dashboard"], clearance=4)
    resp = api_client.post(
        "/api/personnel/",
        {"name_ar": "س", "name_en": "X", "classification": 1},
        format="json",
    )
    assert resp.status_code == 403


def test_mutations_require_authentication(api_client: APIClient, roster) -> None:
    assert (
        api_client.post(
            "/api/personnel/",
            {"name_ar": "س", "name_en": "X", "classification": 1},
            format="json",
        ).status_code
        == 403
    )
    assert api_client.delete(f"/api/personnel/{roster[1].id}").status_code == 403
