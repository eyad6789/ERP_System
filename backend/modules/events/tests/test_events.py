"""Phase 16 gate: the event calendar excludes over-clearance events SERVER-side
(FILTER pattern), and the detail endpoint is IDOR-safe (an over-clearance id
returns 403 + a DENIED audit row, never the record body)."""

from __future__ import annotations

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from modules.events.infrastructure.models import Event
from modules.iam.infrastructure.models import AuditEvent
from modules.iam.tests.factories import RoleFactory, UserFactory

pytestmark = pytest.mark.django_db

_NOW = timezone.now()


@pytest.fixture
def calendar() -> dict[int, Event]:
    out = {}
    for level in (1, 2, 3, 4):
        out[level] = Event.objects.create(
            title_ar=f"حدث{level}",
            title_en=f"Event L{level}",
            start_at=_NOW,
            end_at=_NOW,
            event_type=Event.EventType.MEETING,
            location="HQ",
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


def test_list_excludes_over_clearance_events(api_client: APIClient, calendar) -> None:
    _login(api_client, modules=["events"], clearance=2)
    rows = api_client.get("/api/events/").json()
    levels = {r["classification"] for r in rows}
    # Only events at or below the viewer's clearance are returned at all.
    assert levels == {1, 2}


def test_detail_over_clearance_denied_and_audited(api_client: APIClient, calendar) -> None:
    _login(api_client, modules=["events"], clearance=2)
    resp = api_client.get(f"/api/events/{calendar[4].id}")
    assert resp.status_code == 403
    assert "title_en" not in resp.json()
    assert AuditEvent.objects.filter(
        action="view_event", target_id=str(calendar[4].id), result="DENIED"
    ).exists()


def test_detail_authorized_returns_event_and_audits(api_client: APIClient, calendar) -> None:
    _login(api_client, modules=["events"], clearance=3)
    resp = api_client.get(f"/api/events/{calendar[3].id}")
    assert resp.status_code == 200
    assert resp.json()["title_en"] == "Event L3"
    assert AuditEvent.objects.filter(
        action="view_event", target_id=str(calendar[3].id), result="GRANTED"
    ).exists()


def test_events_require_module(api_client: APIClient, calendar) -> None:
    assert api_client.get("/api/events/").status_code == 403  # unauthenticated
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'events'
    assert api_client.get("/api/events/").status_code == 403


def _payload(classification: int) -> dict[str, object]:
    return {
        "title_ar": "حدث جديد",
        "title_en": "New Event",
        "start_at": _NOW.isoformat(),
        "end_at": _NOW.isoformat(),
        "event_type": Event.EventType.MEETING,
        "location": "Boardroom",
        "classification": classification,
    }


def test_create_within_clearance_201_and_audited(api_client: APIClient) -> None:
    _login(api_client, modules=["events"], clearance=3)
    resp = api_client.post("/api/events/", _payload(2), format="json")
    assert resp.status_code == 201
    assert resp.json()["title_en"] == "New Event"
    new_id = resp.json()["id"]
    assert AuditEvent.objects.filter(
        action="create_event", target_id=str(new_id), result="GRANTED"
    ).exists()


def test_create_above_clearance_403(api_client: APIClient) -> None:
    _login(api_client, modules=["events"], clearance=2)
    resp = api_client.post("/api/events/", _payload(4), format="json")
    assert resp.status_code == 403
    assert not Event.objects.filter(title_en="New Event").exists()


def test_create_invalid_classification_400(api_client: APIClient) -> None:
    _login(api_client, modules=["events"], clearance=4)
    resp = api_client.post("/api/events/", _payload(7), format="json")
    assert resp.status_code == 400


def test_list_query_filters(api_client: APIClient, calendar) -> None:
    _login(api_client, modules=["events"], clearance=4)
    Event.objects.create(
        title_ar="مؤتمر",
        title_en="Conference",
        start_at=_NOW,
        end_at=_NOW,
        event_type=Event.EventType.MEETING,
        location="Hall C",
        classification=1,
    )
    rows = api_client.get("/api/events/?q=confere").json()
    assert {r["title_en"] for r in rows} == {"Conference"}


def test_list_ordering_whitelist(api_client: APIClient, calendar) -> None:
    _login(api_client, modules=["events"], clearance=4)
    rows = api_client.get("/api/events/?ordering=classification").json()
    assert [r["classification"] for r in rows] == [1, 2, 3, 4]
    # Unknown ordering field is ignored and STILL returns an array.
    rows = api_client.get("/api/events/?ordering=bogus").json()
    assert isinstance(rows, list)


def test_update_over_clearance_object_403_denied(api_client: APIClient, calendar) -> None:
    _login(api_client, modules=["events"], clearance=2)
    resp = api_client.patch(f"/api/events/{calendar[4].id}", {"title_en": "X"}, format="json")
    assert resp.status_code == 403
    assert AuditEvent.objects.filter(
        action="view_event", target_id=str(calendar[4].id), result="DENIED"
    ).exists()


def test_update_raise_classification_above_clearance_403(api_client: APIClient, calendar) -> None:
    _login(api_client, modules=["events"], clearance=2)
    resp = api_client.patch(f"/api/events/{calendar[1].id}", {"classification": 4}, format="json")
    assert resp.status_code == 403
    calendar[1].refresh_from_db()
    assert calendar[1].classification == 1


def test_update_within_clearance_200_and_audited(api_client: APIClient, calendar) -> None:
    _login(api_client, modules=["events"], clearance=3)
    resp = api_client.patch(f"/api/events/{calendar[2].id}", {"title_en": "Renamed"}, format="json")
    assert resp.status_code == 200
    assert resp.json()["title_en"] == "Renamed"
    assert AuditEvent.objects.filter(
        action="update_event", target_id=str(calendar[2].id), result="GRANTED"
    ).exists()


def test_delete_over_clearance_403(api_client: APIClient, calendar) -> None:
    _login(api_client, modules=["events"], clearance=2)
    resp = api_client.delete(f"/api/events/{calendar[4].id}")
    assert resp.status_code == 403
    assert Event.objects.filter(pk=calendar[4].id).exists()


def test_delete_success_204_and_audited(api_client: APIClient, calendar) -> None:
    _login(api_client, modules=["events"], clearance=3)
    target_id = calendar[3].id
    resp = api_client.delete(f"/api/events/{target_id}")
    assert resp.status_code == 204
    assert not Event.objects.filter(pk=target_id).exists()
    assert AuditEvent.objects.filter(
        action="delete_event", target_id=str(target_id), result="GRANTED"
    ).exists()


def test_create_requires_module_and_auth(api_client: APIClient) -> None:
    assert api_client.post("/api/events/", _payload(1), format="json").status_code == 403
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'events'
    assert api_client.post("/api/events/", _payload(1), format="json").status_code == 403
