"""The /me payload must match the contract the React app renders from."""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from .factories import RoleFactory, UserFactory

pytestmark = pytest.mark.django_db


def test_me_payload_matches_frontend_contract(api_client: APIClient) -> None:
    role = RoleFactory(
        code="ops", name_ar="ضابط", name_en="Officer", modules=["dashboard", "finance"]
    )
    UserFactory(username="carol", password="test-pass-12345", role=role, clearance=3)
    api_client.post(
        "/api/auth/login", {"username": "carol", "password": "test-pass-12345"}, format="json"
    )

    body = api_client.get("/api/me").json()
    assert body["username"] == "carol"
    assert body["clearance"] == 3
    assert body["modules"] == ["dashboard", "finance"]
    assert body["role"]["code"] == "ops"
    assert {"code", "name_ar", "name_en"} <= set(body["role"])
