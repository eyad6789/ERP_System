"""Phase 15 gate: the meeting directory excludes over-clearance meetings SERVER-side
(FILTER pattern), and the detail endpoint is IDOR-safe (an over-clearance id returns
403 + a DENIED audit row, never the record body)."""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from modules.iam.infrastructure.models import AuditEvent
from modules.iam.tests.factories import RoleFactory, UserFactory
from modules.meetings.infrastructure.models import Meeting

pytestmark = pytest.mark.django_db

_START = timezone.now().replace(microsecond=0)


@pytest.fixture
def agenda() -> dict[int, Meeting]:
    out = {}
    for level in (1, 2, 3, 4):
        out[level] = Meeting.objects.create(
            title_ar=f"اجتماع{level}",
            title_en=f"Meeting L{level}",
            start_at=_START,
            end_at=_START + timedelta(hours=1),
            location="Room A",
            status=Meeting.Status.SCHEDULED,
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


def test_list_excludes_over_clearance_meetings(api_client: APIClient, agenda) -> None:
    _login(api_client, modules=["meetings"], clearance=2)
    rows = api_client.get("/api/meetings/").json()
    levels = {r["classification"] for r in rows}
    # Only meetings at or below the viewer's clearance are returned at all.
    assert levels == {1, 2}


def test_detail_over_clearance_denied_and_audited(api_client: APIClient, agenda) -> None:
    _login(api_client, modules=["meetings"], clearance=2)
    resp = api_client.get(f"/api/meetings/{agenda[4].id}")
    assert resp.status_code == 403
    assert "title_en" not in resp.json()
    assert AuditEvent.objects.filter(
        action="view_meeting", target_id=str(agenda[4].id), result="DENIED"
    ).exists()


def test_detail_authorized_returns_meeting_and_audits(api_client: APIClient, agenda) -> None:
    _login(api_client, modules=["meetings"], clearance=3)
    resp = api_client.get(f"/api/meetings/{agenda[3].id}")
    assert resp.status_code == 200
    assert resp.json()["title_en"] == "Meeting L3"
    assert AuditEvent.objects.filter(
        action="view_meeting", target_id=str(agenda[3].id), result="GRANTED"
    ).exists()


def test_meetings_require_module(api_client: APIClient, agenda) -> None:
    assert api_client.get("/api/meetings/").status_code == 403  # unauthenticated
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'meetings'
    assert api_client.get("/api/meetings/").status_code == 403


def _payload(classification: int) -> dict[str, object]:
    return {
        "title_ar": "اجتماع جديد",
        "title_en": "New Meeting",
        "start_at": _START.isoformat(),
        "end_at": (_START + timedelta(hours=1)).isoformat(),
        "location": "Room B",
        "status": Meeting.Status.SCHEDULED,
        "classification": classification,
    }


def test_create_within_clearance_201_and_audited(api_client: APIClient) -> None:
    _login(api_client, modules=["meetings"], clearance=3)
    resp = api_client.post("/api/meetings/", _payload(2), format="json")
    assert resp.status_code == 201
    assert resp.json()["title_en"] == "New Meeting"
    new_id = resp.json()["id"]
    assert AuditEvent.objects.filter(
        action="create_meeting", target_id=str(new_id), result="GRANTED"
    ).exists()


def test_create_above_clearance_403(api_client: APIClient) -> None:
    _login(api_client, modules=["meetings"], clearance=2)
    resp = api_client.post("/api/meetings/", _payload(4), format="json")
    assert resp.status_code == 403
    assert not Meeting.objects.filter(title_en="New Meeting").exists()


def test_create_invalid_classification_400(api_client: APIClient) -> None:
    _login(api_client, modules=["meetings"], clearance=4)
    resp = api_client.post("/api/meetings/", _payload(7), format="json")
    assert resp.status_code == 400


def test_list_query_filters(api_client: APIClient, agenda) -> None:
    _login(api_client, modules=["meetings"], clearance=4)
    Meeting.objects.create(
        title_ar="إحاطة",
        title_en="Standup",
        start_at=_START,
        end_at=_START + timedelta(hours=1),
        location="Atrium",
        status=Meeting.Status.SCHEDULED,
        classification=1,
    )
    rows = api_client.get("/api/meetings/?q=standu").json()
    assert {r["title_en"] for r in rows} == {"Standup"}


def test_list_ordering_whitelist(api_client: APIClient, agenda) -> None:
    _login(api_client, modules=["meetings"], clearance=4)
    rows = api_client.get("/api/meetings/?ordering=classification").json()
    assert [r["classification"] for r in rows] == [1, 2, 3, 4]
    # Unknown ordering field is ignored and STILL returns an array.
    rows = api_client.get("/api/meetings/?ordering=bogus").json()
    assert isinstance(rows, list)


def test_update_over_clearance_object_403_denied(api_client: APIClient, agenda) -> None:
    _login(api_client, modules=["meetings"], clearance=2)
    resp = api_client.patch(f"/api/meetings/{agenda[4].id}", {"title_en": "X"}, format="json")
    assert resp.status_code == 403
    assert AuditEvent.objects.filter(
        action="view_meeting", target_id=str(agenda[4].id), result="DENIED"
    ).exists()


def test_update_raise_classification_above_clearance_403(api_client: APIClient, agenda) -> None:
    _login(api_client, modules=["meetings"], clearance=2)
    resp = api_client.patch(f"/api/meetings/{agenda[1].id}", {"classification": 4}, format="json")
    assert resp.status_code == 403
    agenda[1].refresh_from_db()
    assert agenda[1].classification == 1


def test_update_within_clearance_200_and_audited(api_client: APIClient, agenda) -> None:
    _login(api_client, modules=["meetings"], clearance=3)
    resp = api_client.patch(f"/api/meetings/{agenda[2].id}", {"title_en": "Renamed"}, format="json")
    assert resp.status_code == 200
    assert resp.json()["title_en"] == "Renamed"
    assert AuditEvent.objects.filter(
        action="update_meeting", target_id=str(agenda[2].id), result="GRANTED"
    ).exists()


def test_delete_over_clearance_403(api_client: APIClient, agenda) -> None:
    _login(api_client, modules=["meetings"], clearance=2)
    resp = api_client.delete(f"/api/meetings/{agenda[4].id}")
    assert resp.status_code == 403
    assert Meeting.objects.filter(pk=agenda[4].id).exists()


def test_delete_success_204_and_audited(api_client: APIClient, agenda) -> None:
    _login(api_client, modules=["meetings"], clearance=3)
    target_id = agenda[3].id
    resp = api_client.delete(f"/api/meetings/{target_id}")
    assert resp.status_code == 204
    assert not Meeting.objects.filter(pk=target_id).exists()
    assert AuditEvent.objects.filter(
        action="delete_meeting", target_id=str(target_id), result="GRANTED"
    ).exists()


def test_create_requires_module_and_auth(api_client: APIClient) -> None:
    assert api_client.post("/api/meetings/", _payload(1), format="json").status_code == 403
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'meetings'
    assert api_client.post("/api/meetings/", _payload(1), format="json").status_code == 403
