"""Phase 4 gate: over-clearance documents are listed but with title/body withheld
server-side; full reads are denied (403) for over-clearance and access-logged
otherwise (never returning the body to an uncleared caller)."""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from modules.documents.infrastructure.models import Document
from modules.iam.infrastructure.models import AuditEvent
from modules.iam.tests.factories import RoleFactory, UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def docs() -> dict[int, Document]:
    out = {}
    for level in (1, 2, 3, 4):
        out[level] = Document.objects.create(
            title_ar=f"وثيقة{level}",
            title_en=f"Doc L{level}",
            body=f"secret-body-{level}",
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


def test_list_withholds_title_for_over_clearance(api_client: APIClient, docs) -> None:
    _login(api_client, modules=["documents"], clearance=2)
    rows = {r["classification"]: r for r in api_client.get("/api/documents/").json()}
    # All four documents are listed (the user knows they exist)...
    assert set(rows) == {1, 2, 3, 4}
    # ...but level 3/4 titles are withheld (locked); no body field is ever present.
    assert rows[2]["locked"] is False and rows[2]["title_en"] == "Doc L2"
    assert rows[3]["locked"] is True and rows[3]["title_en"] is None
    assert rows[4]["locked"] is True and rows[4]["title_en"] is None
    assert all("body" not in r for r in rows.values())


def test_detail_over_clearance_denied_and_audited(api_client: APIClient, docs) -> None:
    _login(api_client, modules=["documents"], clearance=2)
    resp = api_client.get(f"/api/documents/{docs[4].id}")
    assert resp.status_code == 403
    assert "body" not in resp.json()
    assert AuditEvent.objects.filter(
        action="view_document", target_id=str(docs[4].id), result="DENIED"
    ).exists()


def test_detail_authorized_returns_body_and_logs_access(api_client: APIClient, docs) -> None:
    _login(api_client, modules=["documents"], clearance=3)
    before = Document.objects.get(pk=docs[3].id).access_count
    resp = api_client.get(f"/api/documents/{docs[3].id}")
    assert resp.status_code == 200
    assert resp.json()["body"] == "secret-body-3"
    assert Document.objects.get(pk=docs[3].id).access_count == before + 1
    assert AuditEvent.objects.filter(
        action="view_document", target_id=str(docs[3].id), result="GRANTED"
    ).exists()


def test_documents_require_module(api_client: APIClient, docs) -> None:
    assert api_client.get("/api/documents/").status_code == 403  # unauthenticated
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'documents'
    assert api_client.get("/api/documents/").status_code == 403
