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
