"""Phase 7 gate: the announcement board excludes over-clearance announcements
SERVER-side (FILTER pattern), and the detail endpoint is IDOR-safe (an
over-clearance id returns 403 + a DENIED audit row, never the record body)."""

from __future__ import annotations

from datetime import date

import pytest
from rest_framework.test import APIClient

from modules.announcements.infrastructure.models import Announcement
from modules.iam.infrastructure.models import AuditEvent
from modules.iam.tests.factories import RoleFactory, UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def board() -> dict[int, Announcement]:
    out = {}
    for level in (1, 2, 3, 4):
        out[level] = Announcement.objects.create(
            title_ar=f"إعلان{level}",
            title_en=f"Announcement L{level}",
            body=f"Body for level {level}",
            audience="All Staff",
            published_date=date(2026, 1, level),
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


def test_list_excludes_over_clearance_announcements(api_client: APIClient, board) -> None:
    _login(api_client, modules=["announcements"], clearance=2)
    rows = api_client.get("/api/announcements/").json()
    levels = {r["classification"] for r in rows}
    # Only announcements at or below the viewer's clearance are returned at all.
    assert levels == {1, 2}


def test_detail_over_clearance_denied_and_audited(api_client: APIClient, board) -> None:
    _login(api_client, modules=["announcements"], clearance=2)
    resp = api_client.get(f"/api/announcements/{board[4].id}")
    assert resp.status_code == 403
    assert "title_en" not in resp.json()
    assert AuditEvent.objects.filter(
        action="view_announcement", target_id=str(board[4].id), result="DENIED"
    ).exists()


def test_detail_authorized_returns_announcement_and_audits(api_client: APIClient, board) -> None:
    _login(api_client, modules=["announcements"], clearance=3)
    resp = api_client.get(f"/api/announcements/{board[3].id}")
    assert resp.status_code == 200
    assert resp.json()["title_en"] == "Announcement L3"
    assert AuditEvent.objects.filter(
        action="view_announcement", target_id=str(board[3].id), result="GRANTED"
    ).exists()


def test_announcements_require_module(api_client: APIClient, board) -> None:
    assert api_client.get("/api/announcements/").status_code == 403  # unauthenticated
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'announcements'
    assert api_client.get("/api/announcements/").status_code == 403


def _payload(classification: int) -> dict[str, object]:
    return {
        "title_ar": "إعلان جديد",
        "title_en": "New Announcement",
        "body": "A fresh notice for the board.",
        "audience": "All Staff",
        "published_date": "2026-05-01",
        "classification": classification,
    }


def test_create_within_clearance_201_and_audited(api_client: APIClient) -> None:
    _login(api_client, modules=["announcements"], clearance=3)
    resp = api_client.post("/api/announcements/", _payload(2), format="json")
    assert resp.status_code == 201
    assert resp.json()["title_en"] == "New Announcement"
    new_id = resp.json()["id"]
    assert AuditEvent.objects.filter(
        action="create_announcement", target_id=str(new_id), result="GRANTED"
    ).exists()


def test_create_above_clearance_403(api_client: APIClient) -> None:
    _login(api_client, modules=["announcements"], clearance=2)
    resp = api_client.post("/api/announcements/", _payload(4), format="json")
    assert resp.status_code == 403
    assert not Announcement.objects.filter(title_en="New Announcement").exists()


def test_create_invalid_classification_400(api_client: APIClient) -> None:
    _login(api_client, modules=["announcements"], clearance=4)
    resp = api_client.post("/api/announcements/", _payload(7), format="json")
    assert resp.status_code == 400


def test_list_query_filters(api_client: APIClient, board) -> None:
    _login(api_client, modules=["announcements"], clearance=4)
    Announcement.objects.create(
        title_ar="صيانة",
        title_en="Maintenance Notice",
        body="Generator downtime details.",
        audience="Facilities",
        published_date=date(2026, 5, 9),
        classification=1,
    )
    rows = api_client.get("/api/announcements/?q=maintenance").json()
    assert {r["title_en"] for r in rows} == {"Maintenance Notice"}


def test_list_ordering_whitelist(api_client: APIClient, board) -> None:
    _login(api_client, modules=["announcements"], clearance=4)
    rows = api_client.get("/api/announcements/?ordering=classification").json()
    assert [r["classification"] for r in rows] == [1, 2, 3, 4]
    # Unknown ordering field is ignored and STILL returns an array.
    rows = api_client.get("/api/announcements/?ordering=bogus").json()
    assert isinstance(rows, list)


def test_update_over_clearance_object_403_denied(api_client: APIClient, board) -> None:
    _login(api_client, modules=["announcements"], clearance=2)
    resp = api_client.patch(f"/api/announcements/{board[4].id}", {"title_en": "X"}, format="json")
    assert resp.status_code == 403
    assert AuditEvent.objects.filter(
        action="view_announcement", target_id=str(board[4].id), result="DENIED"
    ).exists()


def test_update_raise_classification_above_clearance_403(api_client: APIClient, board) -> None:
    _login(api_client, modules=["announcements"], clearance=2)
    resp = api_client.patch(
        f"/api/announcements/{board[1].id}", {"classification": 4}, format="json"
    )
    assert resp.status_code == 403
    board[1].refresh_from_db()
    assert board[1].classification == 1


def test_update_within_clearance_200_and_audited(api_client: APIClient, board) -> None:
    _login(api_client, modules=["announcements"], clearance=3)
    resp = api_client.patch(
        f"/api/announcements/{board[2].id}", {"title_en": "Renamed"}, format="json"
    )
    assert resp.status_code == 200
    assert resp.json()["title_en"] == "Renamed"
    assert AuditEvent.objects.filter(
        action="update_announcement", target_id=str(board[2].id), result="GRANTED"
    ).exists()


def test_delete_over_clearance_403(api_client: APIClient, board) -> None:
    _login(api_client, modules=["announcements"], clearance=2)
    resp = api_client.delete(f"/api/announcements/{board[4].id}")
    assert resp.status_code == 403
    assert Announcement.objects.filter(pk=board[4].id).exists()


def test_delete_success_204_and_audited(api_client: APIClient, board) -> None:
    _login(api_client, modules=["announcements"], clearance=3)
    target_id = board[3].id
    resp = api_client.delete(f"/api/announcements/{target_id}")
    assert resp.status_code == 204
    assert not Announcement.objects.filter(pk=target_id).exists()
    assert AuditEvent.objects.filter(
        action="delete_announcement", target_id=str(target_id), result="GRANTED"
    ).exists()


def test_create_requires_module_and_auth(api_client: APIClient) -> None:
    assert api_client.post("/api/announcements/", _payload(1), format="json").status_code == 403
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'announcements'
    assert api_client.post("/api/announcements/", _payload(1), format="json").status_code == 403
