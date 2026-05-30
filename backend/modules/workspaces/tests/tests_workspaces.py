"""Department Workspace ownership gate: a user may EDIT only their own department's
workspace. The `can_edit` flag is computed server-side and re-enforced on PATCH;
a non-owner's PATCH is refused (403 + DENIED audit) and the row is left untouched."""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from modules.iam.infrastructure.models import AuditEvent
from modules.iam.tests.factories import RoleFactory, UserFactory
from modules.workspaces.infrastructure.models import Workspace

pytestmark = pytest.mark.django_db


WS_SEED = [
    ("command", "Operations", "Command Center", "مركز القيادة"),
    ("hr", "HR", "Human Resources", "الموارد البشرية"),
    ("finance", "Finance", "Finance & Procurement", "المالية والمشتريات"),
    ("operations", "Operations", "Operations & Field", "العمليات والميدان"),
    ("records", "Records", "Records & Knowledge", "السجلات والمعرفة"),
    ("service", "Service", "Service & Engagement", "الخدمة والتواصل"),
    ("governance", "Intelligence", "Governance & Security", "الحوكمة والأمن"),
    ("platform", "IT", "Platform & Admin", "المنصة والإدارة"),
]


@pytest.fixture
def workspaces() -> dict[str, Workspace]:
    out = {}
    for key, owner, name_en, name_ar in WS_SEED:
        out[key] = Workspace.objects.create(
            key=key,
            owner_department=owner,
            name_en=name_en,
            name_ar=name_ar,
            accent_color="#c9a227",
        )
    return out


def _login(
    api_client: APIClient,
    *,
    username: str,
    department: str = "",
    role_code: str = "officer",
) -> None:
    role = RoleFactory(code=role_code, modules=["workspaces"])
    UserFactory(
        username=username,
        password="test-pass-12345",
        role=role,
        department=department,
    )
    api_client.post(
        "/api/auth/login",
        {"username": username, "password": "test-pass-12345"},
        format="json",
    )


def test_list_requires_auth(api_client: APIClient, workspaces) -> None:
    assert api_client.get("/api/workspaces/").status_code in (401, 403)


def test_list_returns_eight_rows(api_client: APIClient, workspaces) -> None:
    _login(api_client, username="viewer", department="HR")
    resp = api_client.get("/api/workspaces/")
    assert resp.status_code == 200
    rows = resp.json()
    assert len(rows) == 8
    assert {r["key"] for r in rows} == {key for key, *_ in WS_SEED}


def test_owner_can_patch_own_workspace(api_client: APIClient, workspaces) -> None:
    _login(api_client, username="hr_officer", department="HR", role_code="officer")
    resp = api_client.patch(
        "/api/workspaces/hr",
        {"name_en": "People & Talent", "head_name": "Ms. Huda"},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.json()["name_en"] == "People & Talent"
    workspaces["hr"].refresh_from_db()
    assert workspaces["hr"].name_en == "People & Talent"
    assert workspaces["hr"].head_name == "Ms. Huda"
    assert workspaces["hr"].updated_by == "hr_officer"
    assert AuditEvent.objects.filter(
        action="edit_workspace", target_id="hr", result="GRANTED"
    ).exists()


def test_non_owner_refused(api_client: APIClient, workspaces) -> None:
    _login(api_client, username="hr_officer", department="HR", role_code="officer")
    resp = api_client.patch("/api/workspaces/finance", {"name_en": "Hacked"}, format="json")
    assert resp.status_code == 403
    assert resp.json()["detail"] == "You may only edit your own department workspace."
    workspaces["finance"].refresh_from_db()
    assert workspaces["finance"].name_en == "Finance & Procurement"
    assert AuditEvent.objects.filter(
        action="edit_workspace", target_id="finance", result="DENIED"
    ).exists()


def test_sysadmin_can_patch_any_workspace(api_client: APIClient, workspaces) -> None:
    _login(api_client, username="root", department="IT", role_code="sysadmin")
    resp = api_client.patch("/api/workspaces/finance", {"name_en": "Treasury"}, format="json")
    assert resp.status_code == 200
    assert resp.json()["name_en"] == "Treasury"
    workspaces["finance"].refresh_from_db()
    assert workspaces["finance"].name_en == "Treasury"
    assert AuditEvent.objects.filter(
        action="edit_workspace", target_id="finance", result="GRANTED"
    ).exists()


def test_can_edit_flag_reflects_ownership(api_client: APIClient, workspaces) -> None:
    _login(api_client, username="hr_officer", department="HR", role_code="officer")
    rows = {r["key"]: r for r in api_client.get("/api/workspaces/").json()}
    assert rows["hr"]["can_edit"] is True
    assert rows["finance"]["can_edit"] is False
