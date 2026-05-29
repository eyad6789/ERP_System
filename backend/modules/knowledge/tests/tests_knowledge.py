"""Phase gate: the knowledge base excludes over-clearance articles SERVER-side
(FILTER pattern), and the detail endpoint is IDOR-safe (an over-clearance id
returns 403 + a DENIED audit row, never the record body)."""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from modules.iam.infrastructure.models import AuditEvent
from modules.iam.tests.factories import RoleFactory, UserFactory
from modules.knowledge.application import services
from modules.knowledge.infrastructure.models import Article

pytestmark = pytest.mark.django_db


@pytest.fixture
def library() -> dict[int, Article]:
    out = {}
    for level in (1, 2, 3, 4):
        out[level] = Article.objects.create(
            title_ar=f"مقال{level}",
            title_en=f"Article L{level}",
            body=f"Body for article {level}.",
            category="General",
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


def test_list_excludes_over_clearance_articles(api_client: APIClient, library) -> None:
    _login(api_client, modules=["knowledge"], clearance=2)
    rows = api_client.get("/api/knowledge/").json()
    levels = {r["classification"] for r in rows}
    # Only articles at or below the viewer's clearance are returned at all.
    assert levels == {1, 2}


def test_detail_over_clearance_denied_and_audited(api_client: APIClient, library) -> None:
    _login(api_client, modules=["knowledge"], clearance=2)
    resp = api_client.get(f"/api/knowledge/{library[4].id}")
    assert resp.status_code == 403
    assert "title_en" not in resp.json()
    assert AuditEvent.objects.filter(
        action="view_article", target_id=str(library[4].id), result="DENIED"
    ).exists()


def test_detail_authorized_returns_article_and_audits(api_client: APIClient, library) -> None:
    _login(api_client, modules=["knowledge"], clearance=3)
    resp = api_client.get(f"/api/knowledge/{library[3].id}")
    assert resp.status_code == 200
    assert resp.json()["title_en"] == "Article L3"
    assert AuditEvent.objects.filter(
        action="view_article", target_id=str(library[3].id), result="GRANTED"
    ).exists()


def test_knowledge_require_module(api_client: APIClient, library) -> None:
    assert api_client.get("/api/knowledge/").status_code == 403  # unauthenticated
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'knowledge'
    assert api_client.get("/api/knowledge/").status_code == 403


def _payload(classification: int) -> dict[str, object]:
    return {
        "title_ar": "مقال جديد",
        "title_en": "New Article",
        "body": "Some new knowledge body text.",
        "category": "Security",
        "classification": classification,
    }


def test_create_within_clearance_201_and_audited(api_client: APIClient) -> None:
    _login(api_client, modules=["knowledge"], clearance=3)
    resp = api_client.post("/api/knowledge/", _payload(2), format="json")
    assert resp.status_code == 201
    assert resp.json()["title_en"] == "New Article"
    new_id = resp.json()["id"]
    assert AuditEvent.objects.filter(
        action="create_article", target_id=str(new_id), result="GRANTED"
    ).exists()


def test_create_above_clearance_403(api_client: APIClient) -> None:
    _login(api_client, modules=["knowledge"], clearance=2)
    resp = api_client.post("/api/knowledge/", _payload(4), format="json")
    assert resp.status_code == 403
    assert not Article.objects.filter(title_en="New Article").exists()


def test_create_invalid_classification_400(api_client: APIClient) -> None:
    _login(api_client, modules=["knowledge"], clearance=4)
    resp = api_client.post("/api/knowledge/", _payload(7), format="json")
    assert resp.status_code == 400


def test_list_query_filters(api_client: APIClient, library) -> None:
    _login(api_client, modules=["knowledge"], clearance=4)
    Article.objects.create(
        title_ar="دليل",
        title_en="Handbook",
        body="A searchable handbook entry.",
        category="Reference",
        classification=1,
    )
    rows = api_client.get("/api/knowledge/?q=handb").json()
    assert {r["title_en"] for r in rows} == {"Handbook"}


def test_list_ordering_whitelist(api_client: APIClient, library) -> None:
    _login(api_client, modules=["knowledge"], clearance=4)
    rows = api_client.get("/api/knowledge/?ordering=classification").json()
    assert [r["classification"] for r in rows] == [1, 2, 3, 4]
    # Unknown ordering field is ignored and STILL returns an array.
    rows = api_client.get("/api/knowledge/?ordering=bogus").json()
    assert isinstance(rows, list)


def test_update_over_clearance_object_403_denied(api_client: APIClient, library) -> None:
    _login(api_client, modules=["knowledge"], clearance=2)
    resp = api_client.patch(f"/api/knowledge/{library[4].id}", {"title_en": "X"}, format="json")
    assert resp.status_code == 403
    assert AuditEvent.objects.filter(
        action="view_article", target_id=str(library[4].id), result="DENIED"
    ).exists()


def test_update_raise_classification_above_clearance_403(api_client: APIClient, library) -> None:
    _login(api_client, modules=["knowledge"], clearance=2)
    resp = api_client.patch(f"/api/knowledge/{library[1].id}", {"classification": 4}, format="json")
    assert resp.status_code == 403
    library[1].refresh_from_db()
    assert library[1].classification == 1


def test_update_within_clearance_200_and_audited(api_client: APIClient, library) -> None:
    _login(api_client, modules=["knowledge"], clearance=3)
    resp = api_client.patch(
        f"/api/knowledge/{library[2].id}", {"title_en": "Renamed"}, format="json"
    )
    assert resp.status_code == 200
    assert resp.json()["title_en"] == "Renamed"
    assert AuditEvent.objects.filter(
        action="update_article", target_id=str(library[2].id), result="GRANTED"
    ).exists()


def test_delete_over_clearance_403(api_client: APIClient, library) -> None:
    _login(api_client, modules=["knowledge"], clearance=2)
    resp = api_client.delete(f"/api/knowledge/{library[4].id}")
    assert resp.status_code == 403
    assert Article.objects.filter(pk=library[4].id).exists()


def test_delete_success_204_and_audited(api_client: APIClient, library) -> None:
    _login(api_client, modules=["knowledge"], clearance=3)
    target_id = library[3].id
    resp = api_client.delete(f"/api/knowledge/{target_id}")
    assert resp.status_code == 204
    assert not Article.objects.filter(pk=target_id).exists()
    assert AuditEvent.objects.filter(
        action="delete_article", target_id=str(target_id), result="GRANTED"
    ).exists()


def test_create_requires_module_and_auth(api_client: APIClient) -> None:
    assert api_client.post("/api/knowledge/", _payload(1), format="json").status_code == 403
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'knowledge'
    assert api_client.post("/api/knowledge/", _payload(1), format="json").status_code == 403


def test_module_summary_clearance_respecting(api_client: APIClient, library) -> None:
    role = RoleFactory(code="s2", modules=["knowledge"])
    user = UserFactory(username="s2", role=role, clearance=2)
    summary = services.module_summary(user)
    assert summary["key"] == "knowledge"
    assert summary["total"] == 2  # only L1 + L2 visible
    assert summary["categories"] == 1  # single "General" category among visible rows


def test_search_respects_clearance(api_client: APIClient, library) -> None:
    role = RoleFactory(code="s2b", modules=["knowledge"])
    user = UserFactory(username="s2b", role=role, clearance=2)
    results = services.search(user, "Article")
    ids = {r["id"] for r in results}
    assert library[4].id not in ids
    assert library[1].id in ids
    assert all(r["kind"] == "article" for r in results)
