"""Phase gate: the performance directory excludes over-clearance reviews SERVER-side
(FILTER pattern), and the detail endpoint is IDOR-safe (an over-clearance id returns
403 + a DENIED audit row, never the record body)."""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from modules.iam.infrastructure.models import AuditEvent
from modules.iam.tests.factories import RoleFactory, UserFactory
from modules.performance.infrastructure.models import PerformanceReview

pytestmark = pytest.mark.django_db


@pytest.fixture
def reviews() -> dict[int, PerformanceReview]:
    out = {}
    for level in (1, 2, 3, 4):
        out[level] = PerformanceReview.objects.create(
            employee=f"Employee L{level}",
            period="2025-H2",
            score=70 + level,
            rating=PerformanceReview.Rating.GOOD,
            notes="",
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


def test_list_excludes_over_clearance_reviews(api_client: APIClient, reviews) -> None:
    _login(api_client, modules=["performance"], clearance=2)
    rows = api_client.get("/api/performance/").json()
    levels = {r["classification"] for r in rows}
    # Only reviews at or below the viewer's clearance are returned at all.
    assert levels == {1, 2}


def test_detail_over_clearance_denied_and_audited(api_client: APIClient, reviews) -> None:
    _login(api_client, modules=["performance"], clearance=2)
    resp = api_client.get(f"/api/performance/{reviews[4].id}")
    assert resp.status_code == 403
    assert "employee" not in resp.json()
    assert AuditEvent.objects.filter(
        action="view_review", target_id=str(reviews[4].id), result="DENIED"
    ).exists()


def test_detail_authorized_returns_review_and_audits(api_client: APIClient, reviews) -> None:
    _login(api_client, modules=["performance"], clearance=3)
    resp = api_client.get(f"/api/performance/{reviews[3].id}")
    assert resp.status_code == 200
    assert resp.json()["employee"] == "Employee L3"
    assert AuditEvent.objects.filter(
        action="view_review", target_id=str(reviews[3].id), result="GRANTED"
    ).exists()


def test_performance_require_module(api_client: APIClient, reviews) -> None:
    assert api_client.get("/api/performance/").status_code == 403  # unauthenticated
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'performance'
    assert api_client.get("/api/performance/").status_code == 403


def _payload(classification: int) -> dict[str, object]:
    return {
        "employee": "New Reviewee",
        "period": "2026-H1",
        "score": 85,
        "rating": PerformanceReview.Rating.OUTSTANDING,
        "notes": "Strong quarter.",
        "classification": classification,
    }


def test_create_within_clearance_201_and_audited(api_client: APIClient) -> None:
    _login(api_client, modules=["performance"], clearance=3)
    resp = api_client.post("/api/performance/", _payload(2), format="json")
    assert resp.status_code == 201
    assert resp.json()["employee"] == "New Reviewee"
    new_id = resp.json()["id"]
    assert AuditEvent.objects.filter(
        action="create_review", target_id=str(new_id), result="GRANTED"
    ).exists()


def test_create_above_clearance_403(api_client: APIClient) -> None:
    _login(api_client, modules=["performance"], clearance=2)
    resp = api_client.post("/api/performance/", _payload(4), format="json")
    assert resp.status_code == 403
    assert not PerformanceReview.objects.filter(employee="New Reviewee").exists()


def test_create_invalid_classification_400(api_client: APIClient) -> None:
    _login(api_client, modules=["performance"], clearance=4)
    resp = api_client.post("/api/performance/", _payload(7), format="json")
    assert resp.status_code == 400


def test_create_invalid_score_400(api_client: APIClient) -> None:
    _login(api_client, modules=["performance"], clearance=4)
    payload = _payload(1)
    payload["score"] = 150
    resp = api_client.post("/api/performance/", payload, format="json")
    assert resp.status_code == 400


def test_list_query_filters(api_client: APIClient, reviews) -> None:
    _login(api_client, modules=["performance"], clearance=4)
    PerformanceReview.objects.create(
        employee="Distinct Employee",
        period="2023-H2",
        score=90,
        rating=PerformanceReview.Rating.OUTSTANDING,
        notes="",
        classification=1,
    )
    rows = api_client.get("/api/performance/?q=distinct").json()
    assert {r["employee"] for r in rows} == {"Distinct Employee"}


def test_list_ordering_whitelist(api_client: APIClient, reviews) -> None:
    _login(api_client, modules=["performance"], clearance=4)
    rows = api_client.get("/api/performance/?ordering=classification").json()
    assert [r["classification"] for r in rows] == [1, 2, 3, 4]
    # Unknown ordering field is ignored and STILL returns an array.
    rows = api_client.get("/api/performance/?ordering=bogus").json()
    assert isinstance(rows, list)


def test_update_over_clearance_object_403_denied(api_client: APIClient, reviews) -> None:
    _login(api_client, modules=["performance"], clearance=2)
    resp = api_client.patch(f"/api/performance/{reviews[4].id}", {"employee": "X"}, format="json")
    assert resp.status_code == 403
    assert AuditEvent.objects.filter(
        action="view_review", target_id=str(reviews[4].id), result="DENIED"
    ).exists()


def test_update_raise_classification_above_clearance_403(api_client: APIClient, reviews) -> None:
    _login(api_client, modules=["performance"], clearance=2)
    resp = api_client.patch(
        f"/api/performance/{reviews[1].id}", {"classification": 4}, format="json"
    )
    assert resp.status_code == 403
    reviews[1].refresh_from_db()
    assert reviews[1].classification == 1


def test_update_within_clearance_200_and_audited(api_client: APIClient, reviews) -> None:
    _login(api_client, modules=["performance"], clearance=3)
    resp = api_client.patch(
        f"/api/performance/{reviews[2].id}", {"employee": "Renamed"}, format="json"
    )
    assert resp.status_code == 200
    assert resp.json()["employee"] == "Renamed"
    assert AuditEvent.objects.filter(
        action="update_review", target_id=str(reviews[2].id), result="GRANTED"
    ).exists()


def test_delete_over_clearance_403(api_client: APIClient, reviews) -> None:
    _login(api_client, modules=["performance"], clearance=2)
    resp = api_client.delete(f"/api/performance/{reviews[4].id}")
    assert resp.status_code == 403
    assert PerformanceReview.objects.filter(pk=reviews[4].id).exists()


def test_delete_success_204_and_audited(api_client: APIClient, reviews) -> None:
    _login(api_client, modules=["performance"], clearance=3)
    target_id = reviews[3].id
    resp = api_client.delete(f"/api/performance/{target_id}")
    assert resp.status_code == 204
    assert not PerformanceReview.objects.filter(pk=target_id).exists()
    assert AuditEvent.objects.filter(
        action="delete_review", target_id=str(target_id), result="GRANTED"
    ).exists()


def test_create_requires_module_and_auth(api_client: APIClient) -> None:
    assert api_client.post("/api/performance/", _payload(1), format="json").status_code == 403
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'performance'
    assert api_client.post("/api/performance/", _payload(1), format="json").status_code == 403


def test_search_returns_visible_matches(api_client: APIClient, reviews) -> None:
    from modules.performance.application import public as performance

    role = RoleFactory(code="rs2", modules=["performance"])
    user = UserFactory(username="searcher", role=role, clearance=2)
    results = performance.search(user, "Employee")
    kinds = {r["kind"] for r in results}
    levels = {int(r["label_en"].rsplit("L", 1)[1]) for r in results}
    assert kinds == {"performance_review"}
    # Search never surfaces an over-clearance review.
    assert max(levels) <= 2
