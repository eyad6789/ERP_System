"""Phase gate: the attendance register excludes over-clearance records SERVER-side
(FILTER pattern), and the detail endpoint is IDOR-safe (an over-clearance id
returns 403 + a DENIED audit row, never the record body)."""

from __future__ import annotations

import datetime

import pytest
from rest_framework.test import APIClient

from modules.attendance.infrastructure.models import AttendanceRecord
from modules.iam.infrastructure.models import AuditEvent
from modules.iam.tests.factories import RoleFactory, UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def register() -> dict[int, AttendanceRecord]:
    out = {}
    for level in (1, 2, 3, 4):
        out[level] = AttendanceRecord.objects.create(
            employee=f"Employee L{level}",
            date=datetime.date(2026, 5, 25),
            status=AttendanceRecord.Status.PRESENT,
            check_in="08:00",
            check_out="16:00",
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


def test_list_excludes_over_clearance_records(api_client: APIClient, register) -> None:
    _login(api_client, modules=["attendance"], clearance=2)
    rows = api_client.get("/api/attendance/").json()
    levels = {r["classification"] for r in rows}
    # Only records at or below the viewer's clearance are returned at all.
    assert levels == {1, 2}


def test_detail_over_clearance_denied_and_audited(api_client: APIClient, register) -> None:
    _login(api_client, modules=["attendance"], clearance=2)
    resp = api_client.get(f"/api/attendance/{register[4].id}")
    assert resp.status_code == 403
    assert "employee" not in resp.json()
    assert AuditEvent.objects.filter(
        action="view_attendance", target_id=str(register[4].id), result="DENIED"
    ).exists()


def test_detail_authorized_returns_record_and_audits(api_client: APIClient, register) -> None:
    _login(api_client, modules=["attendance"], clearance=3)
    resp = api_client.get(f"/api/attendance/{register[3].id}")
    assert resp.status_code == 200
    assert resp.json()["employee"] == "Employee L3"
    assert AuditEvent.objects.filter(
        action="view_attendance", target_id=str(register[3].id), result="GRANTED"
    ).exists()


def test_attendance_require_module(api_client: APIClient, register) -> None:
    assert api_client.get("/api/attendance/").status_code == 403  # unauthenticated
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'attendance'
    assert api_client.get("/api/attendance/").status_code == 403


def _payload(classification: int) -> dict[str, object]:
    return {
        "employee": "New Employee",
        "date": "2026-05-26",
        "status": AttendanceRecord.Status.PRESENT,
        "check_in": "08:05",
        "check_out": "16:05",
        "classification": classification,
    }


def test_create_within_clearance_201_and_audited(api_client: APIClient) -> None:
    _login(api_client, modules=["attendance"], clearance=3)
    resp = api_client.post("/api/attendance/", _payload(2), format="json")
    assert resp.status_code == 201
    assert resp.json()["employee"] == "New Employee"
    new_id = resp.json()["id"]
    assert AuditEvent.objects.filter(
        action="create_attendance", target_id=str(new_id), result="GRANTED"
    ).exists()


def test_create_above_clearance_403(api_client: APIClient) -> None:
    _login(api_client, modules=["attendance"], clearance=2)
    resp = api_client.post("/api/attendance/", _payload(4), format="json")
    assert resp.status_code == 403
    assert not AttendanceRecord.objects.filter(employee="New Employee").exists()


def test_create_invalid_classification_400(api_client: APIClient) -> None:
    _login(api_client, modules=["attendance"], clearance=4)
    resp = api_client.post("/api/attendance/", _payload(7), format="json")
    assert resp.status_code == 400


def test_list_query_filters(api_client: APIClient, register) -> None:
    _login(api_client, modules=["attendance"], clearance=4)
    AttendanceRecord.objects.create(
        employee="Unique Recruit",
        date=datetime.date(2026, 5, 25),
        status=AttendanceRecord.Status.ABSENT,
        check_in="",
        check_out="",
        classification=1,
    )
    rows = api_client.get("/api/attendance/?q=recruit").json()
    assert {r["employee"] for r in rows} == {"Unique Recruit"}


def test_list_ordering_whitelist(api_client: APIClient, register) -> None:
    _login(api_client, modules=["attendance"], clearance=4)
    rows = api_client.get("/api/attendance/?ordering=classification").json()
    assert [r["classification"] for r in rows] == [1, 2, 3, 4]
    # Unknown ordering field is ignored and STILL returns an array.
    rows = api_client.get("/api/attendance/?ordering=bogus").json()
    assert isinstance(rows, list)


def test_update_over_clearance_object_403_denied(api_client: APIClient, register) -> None:
    _login(api_client, modules=["attendance"], clearance=2)
    resp = api_client.patch(f"/api/attendance/{register[4].id}", {"employee": "X"}, format="json")
    assert resp.status_code == 403
    assert AuditEvent.objects.filter(
        action="view_attendance", target_id=str(register[4].id), result="DENIED"
    ).exists()


def test_update_raise_classification_above_clearance_403(api_client: APIClient, register) -> None:
    _login(api_client, modules=["attendance"], clearance=2)
    resp = api_client.patch(
        f"/api/attendance/{register[1].id}", {"classification": 4}, format="json"
    )
    assert resp.status_code == 403
    register[1].refresh_from_db()
    assert register[1].classification == 1


def test_update_within_clearance_200_and_audited(api_client: APIClient, register) -> None:
    _login(api_client, modules=["attendance"], clearance=3)
    resp = api_client.patch(
        f"/api/attendance/{register[2].id}", {"employee": "Renamed"}, format="json"
    )
    assert resp.status_code == 200
    assert resp.json()["employee"] == "Renamed"
    assert AuditEvent.objects.filter(
        action="update_attendance", target_id=str(register[2].id), result="GRANTED"
    ).exists()


def test_delete_over_clearance_403(api_client: APIClient, register) -> None:
    _login(api_client, modules=["attendance"], clearance=2)
    resp = api_client.delete(f"/api/attendance/{register[4].id}")
    assert resp.status_code == 403
    assert AttendanceRecord.objects.filter(pk=register[4].id).exists()


def test_delete_success_204_and_audited(api_client: APIClient, register) -> None:
    _login(api_client, modules=["attendance"], clearance=3)
    target_id = register[3].id
    resp = api_client.delete(f"/api/attendance/{target_id}")
    assert resp.status_code == 204
    assert not AttendanceRecord.objects.filter(pk=target_id).exists()
    assert AuditEvent.objects.filter(
        action="delete_attendance", target_id=str(target_id), result="GRANTED"
    ).exists()


def test_create_requires_module_and_auth(api_client: APIClient) -> None:
    assert api_client.post("/api/attendance/", _payload(1), format="json").status_code == 403
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'attendance'
    assert api_client.post("/api/attendance/", _payload(1), format="json").status_code == 403
