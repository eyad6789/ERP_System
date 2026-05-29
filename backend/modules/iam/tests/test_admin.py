"""Administration suite: sysadmin-only access + the create-user clearance ceiling."""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from modules.iam.infrastructure.models import AuditEvent, Role, User

from .factories import RoleFactory, UserFactory

pytestmark = pytest.mark.django_db


def _login(api_client: APIClient, username: str) -> None:
    api_client.post(
        "/api/auth/login",
        {"username": username, "password": "test-pass-12345"},
        format="json",
    )


def test_non_sysadmin_denied_admin_access(api_client: APIClient) -> None:
    role = RoleFactory(code="ops", modules=["dashboard"])
    UserFactory(username="bob", password="test-pass-12345", role=role, clearance=2)
    _login(api_client, "bob")

    assert api_client.get("/api/admin/users").status_code == 403
    assert api_client.get("/api/admin/roles").status_code == 403


def test_sysadmin_can_list_and_create_user(api_client: APIClient) -> None:
    admin_role = RoleFactory(code="sysadmin", modules=["dashboard"], clearance=4)
    UserFactory(username="root", password="test-pass-12345", role=admin_role, clearance=4)
    _login(api_client, "root")

    assert api_client.get("/api/admin/users").status_code == 200

    resp = api_client.post(
        "/api/admin/users",
        {"username": "newbie", "password": "fresh-pass-99887", "clearance": 2},
        format="json",
    )
    assert resp.status_code == 201
    assert User.objects.filter(username="newbie").exists()
    assert AuditEvent.objects.filter(action="create_user", result="GRANTED").exists()


def test_create_user_clearance_ceiling(api_client: APIClient) -> None:
    admin_role = RoleFactory(code="sysadmin", modules=["dashboard"], clearance=4)
    UserFactory(username="root2", password="test-pass-12345", role=admin_role, clearance=2)
    _login(api_client, "root2")

    resp = api_client.post(
        "/api/admin/users",
        {"username": "spy", "password": "fresh-pass-99887", "clearance": 4},
        format="json",
    )
    assert resp.status_code == 403
    assert not User.objects.filter(username="spy").exists()
    assert AuditEvent.objects.filter(action="create_user", result="DENIED").exists()


def test_sysadmin_can_update_role(api_client: APIClient) -> None:
    admin_role = RoleFactory(code="sysadmin", modules=["dashboard"], clearance=4)
    UserFactory(username="root3", password="test-pass-12345", role=admin_role, clearance=4)
    _login(api_client, "root3")
    target = Role.objects.create(code="hr", name_ar="ه", name_en="HR", modules=["dashboard"])

    resp = api_client.patch(
        f"/api/admin/roles/{target.pk}",
        {"modules": ["dashboard", "personnel"]},
        format="json",
    )
    assert resp.status_code == 200
    target.refresh_from_db()
    assert target.modules == ["dashboard", "personnel"]
    assert AuditEvent.objects.filter(action="update_role", result="GRANTED").exists()
