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


def test_create_within_clearance_returns_201_and_audits(api_client: APIClient) -> None:
    _login(api_client, modules=["documents"], clearance=3)
    resp = api_client.post(
        "/api/documents/",
        {"title_ar": "جديد", "title_en": "New Doc", "body": "hello", "classification": 2},
        format="json",
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["title_en"] == "New Doc"
    assert body["classification"] == 2
    assert body["version"] == 1
    assert AuditEvent.objects.filter(
        action="create_document", target_id=str(body["id"]), result="GRANTED"
    ).exists()
    created = Document.objects.get(pk=body["id"])
    assert created.versions.filter(number=1).exists()


def test_create_above_clearance_returns_403(api_client: APIClient) -> None:
    _login(api_client, modules=["documents"], clearance=2)
    resp = api_client.post(
        "/api/documents/",
        {"title_ar": "سري", "title_en": "Top", "body": "x", "classification": 4},
        format="json",
    )
    assert resp.status_code == 403
    assert not Document.objects.filter(title_en="Top").exists()


def test_create_rejects_invalid_classification(api_client: APIClient) -> None:
    _login(api_client, modules=["documents"], clearance=4)
    resp = api_client.post(
        "/api/documents/",
        {"title_ar": "س", "title_en": "Bad", "body": "x", "classification": 9},
        format="json",
    )
    assert resp.status_code == 400


def test_update_over_clearance_object_returns_403_and_denied(api_client: APIClient, docs) -> None:
    _login(api_client, modules=["documents"], clearance=2)
    resp = api_client.patch(f"/api/documents/{docs[4].id}", {"title_en": "hacked"}, format="json")
    assert resp.status_code == 403
    assert Document.objects.get(pk=docs[4].id).title_en == "Doc L4"
    assert AuditEvent.objects.filter(
        action="view_document", target_id=str(docs[4].id), result="DENIED"
    ).exists()


def test_update_to_above_clearance_returns_403(api_client: APIClient, docs) -> None:
    _login(api_client, modules=["documents"], clearance=2)
    resp = api_client.patch(f"/api/documents/{docs[2].id}", {"classification": 4}, format="json")
    assert resp.status_code == 403
    assert Document.objects.get(pk=docs[2].id).classification == 2


def test_update_within_clearance_returns_200_and_audits(api_client: APIClient, docs) -> None:
    _login(api_client, modules=["documents"], clearance=3)
    resp = api_client.patch(f"/api/documents/{docs[2].id}", {"title_en": "Renamed"}, format="json")
    assert resp.status_code == 200
    assert resp.json()["title_en"] == "Renamed"
    assert AuditEvent.objects.filter(
        action="update_document", target_id=str(docs[2].id), result="GRANTED"
    ).exists()


def test_delete_over_clearance_returns_403(api_client: APIClient, docs) -> None:
    _login(api_client, modules=["documents"], clearance=2)
    resp = api_client.delete(f"/api/documents/{docs[4].id}")
    assert resp.status_code == 403
    assert Document.objects.filter(pk=docs[4].id).exists()
    assert AuditEvent.objects.filter(
        action="view_document", target_id=str(docs[4].id), result="DENIED"
    ).exists()


def test_delete_within_clearance_returns_204_and_audits(api_client: APIClient, docs) -> None:
    _login(api_client, modules=["documents"], clearance=3)
    doc_id = docs[2].id
    resp = api_client.delete(f"/api/documents/{doc_id}")
    assert resp.status_code == 204
    assert not Document.objects.filter(pk=doc_id).exists()
    assert AuditEvent.objects.filter(
        action="delete_document", target_id=str(doc_id), result="GRANTED"
    ).exists()


def test_add_version_bumps_and_audits(api_client: APIClient, docs) -> None:
    _login(api_client, modules=["documents"], clearance=3)
    resp = api_client.post(f"/api/documents/{docs[2].id}/version", {}, format="json")
    assert resp.status_code == 201
    assert resp.json()["version"] == 2
    doc = Document.objects.get(pk=docs[2].id)
    assert doc.version == 2
    assert doc.versions.filter(number=2).exists()
    assert AuditEvent.objects.filter(
        action="add_document_version", target_id=str(docs[2].id), result="GRANTED"
    ).exists()


def test_add_version_over_clearance_returns_403(api_client: APIClient, docs) -> None:
    _login(api_client, modules=["documents"], clearance=2)
    resp = api_client.post(f"/api/documents/{docs[4].id}/version", {}, format="json")
    assert resp.status_code == 403
    assert Document.objects.get(pk=docs[4].id).version == 1


def test_list_q_filters_and_returns_array(api_client: APIClient, docs) -> None:
    _login(api_client, modules=["documents"], clearance=4)
    payload = api_client.get("/api/documents/?q=Doc L2").json()
    assert isinstance(payload, list)
    assert {r["classification"] for r in payload} == {2}


def test_list_ordering_whitelisted(api_client: APIClient, docs) -> None:
    _login(api_client, modules=["documents"], clearance=4)
    payload = api_client.get("/api/documents/?ordering=classification").json()
    assert [r["classification"] for r in payload] == [1, 2, 3, 4]
    # Unknown ordering fields are ignored (still a top-level array).
    other = api_client.get("/api/documents/?ordering=secret_field").json()
    assert isinstance(other, list) and len(other) == 4


def test_create_requires_module(api_client: APIClient) -> None:
    assert (
        api_client.post("/api/documents/", {}, format="json").status_code == 403
    )  # unauthenticated
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'documents'
    resp = api_client.post(
        "/api/documents/",
        {"title_ar": "a", "title_en": "b", "body": "c", "classification": 1},
        format="json",
    )
    assert resp.status_code == 403
