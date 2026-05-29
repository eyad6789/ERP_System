"""Phase 7 gate: the operations board is clearance-FILTERED server-side; task
detail is IDOR-safe (403 + DENIED for over-clearance) and status changes are
audited GRANTED only after the clearance check passes.
"""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from modules.iam.infrastructure.models import AuditEvent
from modules.iam.tests.factories import RoleFactory, UserFactory
from modules.operations.infrastructure.models import Task

pytestmark = pytest.mark.django_db


@pytest.fixture
def tasks() -> dict[int, Task]:
    out = {}
    for level in (1, 2, 3, 4):
        out[level] = Task.objects.create(
            title_ar=f"مهمة{level}",
            title_en=f"Task L{level}",
            assignee=f"u{level}",
            priority=Task.Priority.MEDIUM,
            status=Task.Status.OPEN,
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


def test_list_excludes_over_clearance(api_client: APIClient, tasks) -> None:
    _login(api_client, modules=["operations"], clearance=2)
    rows = api_client.get("/api/operations/tasks").json()
    levels = {r["classification"] for r in rows}
    # Only tasks at or below clearance 2 are present; 3/4 are excluded server-side.
    assert levels == {1, 2}


def test_detail_over_clearance_denied_and_audited(api_client: APIClient, tasks) -> None:
    _login(api_client, modules=["operations"], clearance=2)
    resp = api_client.get(f"/api/operations/tasks/{tasks[4].id}")
    assert resp.status_code == 403
    assert AuditEvent.objects.filter(
        action="view_task", target_id=str(tasks[4].id), result="DENIED"
    ).exists()


def test_status_update_authorized_audited_and_persists(api_client: APIClient, tasks) -> None:
    _login(api_client, modules=["operations"], clearance=3)
    resp = api_client.post(
        f"/api/operations/tasks/{tasks[3].id}/status",
        {"status": "active"},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "active"
    assert Task.objects.get(pk=tasks[3].id).status == "active"
    assert AuditEvent.objects.filter(
        action="update_task_status", target_id=str(tasks[3].id), result="GRANTED"
    ).exists()


def test_status_update_over_clearance_denied_and_audited(api_client: APIClient, tasks) -> None:
    _login(api_client, modules=["operations"], clearance=2)
    resp = api_client.post(
        f"/api/operations/tasks/{tasks[4].id}/status",
        {"status": "closed"},
        format="json",
    )
    assert resp.status_code == 403
    assert Task.objects.get(pk=tasks[4].id).status == "open"
    assert AuditEvent.objects.filter(
        action="view_task", target_id=str(tasks[4].id), result="DENIED"
    ).exists()


def test_status_update_invalid_status_rejected(api_client: APIClient, tasks) -> None:
    _login(api_client, modules=["operations"], clearance=3)
    resp = api_client.post(
        f"/api/operations/tasks/{tasks[3].id}/status",
        {"status": "bogus"},
        format="json",
    )
    assert resp.status_code == 400
    assert Task.objects.get(pk=tasks[3].id).status == "open"


def test_operations_require_module(api_client: APIClient, tasks) -> None:
    assert api_client.get("/api/operations/tasks").status_code == 403  # unauthenticated
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'operations'
    assert api_client.get("/api/operations/tasks").status_code == 403
