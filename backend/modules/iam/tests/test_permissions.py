"""Gate clause (b): low-clearance users are denied high-clearance objects (IDOR),
and roles without a module are denied that module — both server-side, both audited.
"""

from __future__ import annotations

import pytest
from rest_framework.exceptions import PermissionDenied
from rest_framework.test import APIClient, APIRequestFactory

from core.permissions import enforce_object_clearance
from modules.iam.infrastructure.models import AuditEvent

from .factories import RoleFactory, UserFactory

pytestmark = pytest.mark.django_db


class _ClassifiedStub:
    """Stand-in for any future classified object (document, contract, site...)."""

    def __init__(self, pk: int, classification: int) -> None:
        self.pk = pk
        self.classification = classification


def test_low_clearance_denied_high_clearance_object() -> None:
    """An analyst (clearance 2) requesting a clearance-4 object by its exact id
    is denied server-side and the denial is audited (the IDOR defense)."""
    user = UserFactory(username="analyst1", clearance=2)
    request = APIRequestFactory().get("/api/documents/42")
    request.user = user

    high_secret_obj = _ClassifiedStub(pk=42, classification=4)
    with pytest.raises(PermissionDenied):
        enforce_object_clearance(request, high_secret_obj, action="view_document")

    denied = AuditEvent.objects.filter(action="view_document", result="DENIED")
    assert denied.count() == 1
    assert denied.first().target_id == "42"


def test_sufficient_clearance_granted_and_audited() -> None:
    user = UserFactory(username="ops1", clearance=4)
    request = APIRequestFactory().get("/api/documents/42")
    request.user = user

    enforce_object_clearance(
        request, _ClassifiedStub(pk=42, classification=4), action="view_document"
    )
    assert AuditEvent.objects.filter(action="view_document", result="GRANTED").count() == 1


def test_role_without_module_denied(api_client: APIClient) -> None:
    """An HR user (no `audit` module) hitting /api/audit gets 403 + a DENIED row."""
    hr_role = RoleFactory(code="hr", modules=["dashboard", "personnel"])
    UserFactory(username="hr1", password="test-pass-12345", role=hr_role, clearance=2)
    api_client.post(
        "/api/auth/login", {"username": "hr1", "password": "test-pass-12345"}, format="json"
    )

    resp = api_client.get("/api/audit")
    assert resp.status_code == 403
    assert (
        AuditEvent.objects.filter(
            action="open_module", target_type="audit", result="DENIED"
        ).count()
        == 1
    )
