"""Phase 15 gate: the leave directory excludes over-clearance requests SERVER-side
(FILTER pattern), and the detail endpoint is IDOR-safe (an over-clearance id returns
403 + a DENIED audit row, never the record body). Plus the approve/reject workflow."""

from __future__ import annotations

from datetime import date

import pytest
from rest_framework.test import APIClient

from modules.iam.infrastructure.models import AuditEvent
from modules.iam.tests.factories import RoleFactory, UserFactory
from modules.leave.infrastructure.models import LeaveRequest

pytestmark = pytest.mark.django_db


@pytest.fixture
def requests() -> dict[int, LeaveRequest]:
    out = {}
    for level in (1, 2, 3, 4):
        out[level] = LeaveRequest.objects.create(
            employee=f"Employee L{level}",
            leave_type=LeaveRequest.LeaveType.ANNUAL,
            start_date=date(2026, 6, 1),
            end_date=date(2026, 6, 5),
            status=LeaveRequest.Status.PENDING,
            reason="",
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


def test_list_excludes_over_clearance_requests(api_client: APIClient, requests) -> None:
    _login(api_client, modules=["leave"], clearance=2)
    rows = api_client.get("/api/leave/").json()
    levels = {r["classification"] for r in rows}
    # Only requests at or below the viewer's clearance are returned at all.
    assert levels == {1, 2}


def test_detail_over_clearance_denied_and_audited(api_client: APIClient, requests) -> None:
    _login(api_client, modules=["leave"], clearance=2)
    resp = api_client.get(f"/api/leave/{requests[4].id}")
    assert resp.status_code == 403
    assert "employee" not in resp.json()
    assert AuditEvent.objects.filter(
        action="view_leave", target_id=str(requests[4].id), result="DENIED"
    ).exists()


def test_detail_authorized_returns_request_and_audits(api_client: APIClient, requests) -> None:
    _login(api_client, modules=["leave"], clearance=3)
    resp = api_client.get(f"/api/leave/{requests[3].id}")
    assert resp.status_code == 200
    assert resp.json()["employee"] == "Employee L3"
    assert AuditEvent.objects.filter(
        action="view_leave", target_id=str(requests[3].id), result="GRANTED"
    ).exists()


def test_leave_require_module(api_client: APIClient, requests) -> None:
    assert api_client.get("/api/leave/").status_code == 403  # unauthenticated
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'leave'
    assert api_client.get("/api/leave/").status_code == 403


def _payload(classification: int) -> dict[str, object]:
    return {
        "employee": "New Employee",
        "leave_type": LeaveRequest.LeaveType.SICK,
        "start_date": "2026-08-01",
        "end_date": "2026-08-03",
        "status": LeaveRequest.Status.PENDING,
        "reason": "Flu",
        "classification": classification,
    }


def test_create_within_clearance_201_and_audited(api_client: APIClient) -> None:
    _login(api_client, modules=["leave"], clearance=3)
    resp = api_client.post("/api/leave/", _payload(2), format="json")
    assert resp.status_code == 201
    assert resp.json()["employee"] == "New Employee"
    new_id = resp.json()["id"]
    assert AuditEvent.objects.filter(
        action="create_leave", target_id=str(new_id), result="GRANTED"
    ).exists()


def test_create_above_clearance_403(api_client: APIClient) -> None:
    _login(api_client, modules=["leave"], clearance=2)
    resp = api_client.post("/api/leave/", _payload(4), format="json")
    assert resp.status_code == 403
    assert not LeaveRequest.objects.filter(employee="New Employee").exists()


def test_create_invalid_classification_400(api_client: APIClient) -> None:
    _login(api_client, modules=["leave"], clearance=4)
    resp = api_client.post("/api/leave/", _payload(7), format="json")
    assert resp.status_code == 400


def test_list_query_filters(api_client: APIClient, requests) -> None:
    _login(api_client, modules=["leave"], clearance=4)
    LeaveRequest.objects.create(
        employee="Distinct Officer",
        leave_type=LeaveRequest.LeaveType.SICK,
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 2),
        status=LeaveRequest.Status.PENDING,
        reason="",
        classification=1,
    )
    rows = api_client.get("/api/leave/?q=distinct").json()
    assert {r["employee"] for r in rows} == {"Distinct Officer"}


def test_list_ordering_whitelist(api_client: APIClient, requests) -> None:
    _login(api_client, modules=["leave"], clearance=4)
    rows = api_client.get("/api/leave/?ordering=classification").json()
    assert [r["classification"] for r in rows] == [1, 2, 3, 4]
    # Unknown ordering field is ignored and STILL returns an array.
    rows = api_client.get("/api/leave/?ordering=bogus").json()
    assert isinstance(rows, list)


def test_update_over_clearance_object_403_denied(api_client: APIClient, requests) -> None:
    _login(api_client, modules=["leave"], clearance=2)
    resp = api_client.patch(f"/api/leave/{requests[4].id}", {"reason": "X"}, format="json")
    assert resp.status_code == 403
    assert AuditEvent.objects.filter(
        action="view_leave", target_id=str(requests[4].id), result="DENIED"
    ).exists()


def test_update_raise_classification_above_clearance_403(api_client: APIClient, requests) -> None:
    _login(api_client, modules=["leave"], clearance=2)
    resp = api_client.patch(f"/api/leave/{requests[1].id}", {"classification": 4}, format="json")
    assert resp.status_code == 403
    requests[1].refresh_from_db()
    assert requests[1].classification == 1


def test_update_within_clearance_200_and_audited(api_client: APIClient, requests) -> None:
    _login(api_client, modules=["leave"], clearance=3)
    resp = api_client.patch(f"/api/leave/{requests[2].id}", {"reason": "Updated"}, format="json")
    assert resp.status_code == 200
    assert resp.json()["reason"] == "Updated"
    assert AuditEvent.objects.filter(
        action="update_leave", target_id=str(requests[2].id), result="GRANTED"
    ).exists()


def test_delete_over_clearance_403(api_client: APIClient, requests) -> None:
    _login(api_client, modules=["leave"], clearance=2)
    resp = api_client.delete(f"/api/leave/{requests[4].id}")
    assert resp.status_code == 403
    assert LeaveRequest.objects.filter(pk=requests[4].id).exists()


def test_delete_success_204_and_audited(api_client: APIClient, requests) -> None:
    _login(api_client, modules=["leave"], clearance=3)
    target_id = requests[3].id
    resp = api_client.delete(f"/api/leave/{target_id}")
    assert resp.status_code == 204
    assert not LeaveRequest.objects.filter(pk=target_id).exists()
    assert AuditEvent.objects.filter(
        action="delete_leave", target_id=str(target_id), result="GRANTED"
    ).exists()


def test_create_requires_module_and_auth(api_client: APIClient) -> None:
    assert api_client.post("/api/leave/", _payload(1), format="json").status_code == 403
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'leave'
    assert api_client.post("/api/leave/", _payload(1), format="json").status_code == 403


def test_status_approve_within_clearance_and_audited(api_client: APIClient, requests) -> None:
    _login(api_client, modules=["leave"], clearance=3)
    resp = api_client.post(
        f"/api/leave/{requests[2].id}/status", {"status": "approved"}, format="json"
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"
    requests[2].refresh_from_db()
    assert requests[2].status == LeaveRequest.Status.APPROVED
    assert AuditEvent.objects.filter(
        action="status_leave", target_id=str(requests[2].id), result="GRANTED"
    ).exists()


def test_status_reject_invalid_value_400(api_client: APIClient, requests) -> None:
    _login(api_client, modules=["leave"], clearance=3)
    resp = api_client.post(
        f"/api/leave/{requests[2].id}/status", {"status": "pending"}, format="json"
    )
    assert resp.status_code == 400


def test_status_over_clearance_object_403_denied(api_client: APIClient, requests) -> None:
    _login(api_client, modules=["leave"], clearance=2)
    resp = api_client.post(
        f"/api/leave/{requests[4].id}/status", {"status": "approved"}, format="json"
    )
    assert resp.status_code == 403
    requests[4].refresh_from_db()
    assert requests[4].status == LeaveRequest.Status.PENDING
    assert AuditEvent.objects.filter(
        action="view_leave", target_id=str(requests[4].id), result="DENIED"
    ).exists()


def test_search_excludes_over_clearance(api_client: APIClient, requests) -> None:
    from modules.iam.infrastructure.models import User
    from modules.leave.application import public as leave

    role = RoleFactory(code="rs2", modules=["leave"])
    user = UserFactory(username="searcher", role=role, clearance=2)
    results = leave.search(user, "Employee")
    kinds = {r["kind"] for r in results}
    classifications = {LeaveRequest.objects.get(id=r["id"]).classification for r in results}
    assert kinds == {"leave"}
    assert classifications <= {1, 2}
    assert isinstance(User.objects.get(username="searcher"), User)
