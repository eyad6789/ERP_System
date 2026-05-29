"""Phase 13 gate: the risk register excludes over-clearance risks SERVER-side
(FILTER pattern), and the detail endpoint is IDOR-safe (an over-clearance id
returns 403 + a DENIED audit row, never the record body)."""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from modules.iam.infrastructure.models import AuditEvent
from modules.iam.tests.factories import RoleFactory, UserFactory
from modules.risk.application import services
from modules.risk.infrastructure.models import Risk

pytestmark = pytest.mark.django_db


@pytest.fixture
def register() -> dict[int, Risk]:
    out = {}
    for level in (1, 2, 3, 4):
        out[level] = Risk.objects.create(
            title_ar=f"خطر{level}",
            title_en=f"Risk L{level}",
            likelihood=level,
            impact=level,
            status=Risk.Status.OPEN,
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


def test_list_excludes_over_clearance_risks(api_client: APIClient, register) -> None:
    _login(api_client, modules=["risk"], clearance=2)
    rows = api_client.get("/api/risk/").json()
    levels = {r["classification"] for r in rows}
    # Only risks at or below the viewer's clearance are returned at all.
    assert levels == {1, 2}


def test_detail_over_clearance_denied_and_audited(api_client: APIClient, register) -> None:
    _login(api_client, modules=["risk"], clearance=2)
    resp = api_client.get(f"/api/risk/{register[4].id}")
    assert resp.status_code == 403
    assert "title_en" not in resp.json()
    assert AuditEvent.objects.filter(
        action="view_risk", target_id=str(register[4].id), result="DENIED"
    ).exists()


def test_detail_authorized_returns_risk_and_audits(api_client: APIClient, register) -> None:
    _login(api_client, modules=["risk"], clearance=3)
    resp = api_client.get(f"/api/risk/{register[3].id}")
    assert resp.status_code == 200
    assert resp.json()["title_en"] == "Risk L3"
    assert AuditEvent.objects.filter(
        action="view_risk", target_id=str(register[3].id), result="GRANTED"
    ).exists()


def test_risk_requires_module(api_client: APIClient, register) -> None:
    assert api_client.get("/api/risk/").status_code == 403  # unauthenticated
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'risk'
    assert api_client.get("/api/risk/").status_code == 403


def _payload(classification: int) -> dict[str, object]:
    return {
        "title_ar": "خطر جديد",
        "title_en": "New Risk",
        "likelihood": 3,
        "impact": 4,
        "status": Risk.Status.OPEN,
        "mitigation": "Draft a response plan.",
        "classification": classification,
    }


def test_create_within_clearance_201_and_audited(api_client: APIClient) -> None:
    _login(api_client, modules=["risk"], clearance=3)
    resp = api_client.post("/api/risk/", _payload(2), format="json")
    assert resp.status_code == 201
    assert resp.json()["title_en"] == "New Risk"
    # score is derived (likelihood * impact) on save.
    assert resp.json()["score"] == 12
    new_id = resp.json()["id"]
    assert AuditEvent.objects.filter(
        action="create_risk", target_id=str(new_id), result="GRANTED"
    ).exists()


def test_create_above_clearance_403(api_client: APIClient) -> None:
    _login(api_client, modules=["risk"], clearance=2)
    resp = api_client.post("/api/risk/", _payload(4), format="json")
    assert resp.status_code == 403
    assert not Risk.objects.filter(title_en="New Risk").exists()


def test_create_invalid_classification_400(api_client: APIClient) -> None:
    _login(api_client, modules=["risk"], clearance=4)
    payload = _payload(7)
    resp = api_client.post("/api/risk/", payload, format="json")
    assert resp.status_code == 400


def test_create_invalid_likelihood_400(api_client: APIClient) -> None:
    _login(api_client, modules=["risk"], clearance=4)
    payload = _payload(1)
    payload["likelihood"] = 9
    resp = api_client.post("/api/risk/", payload, format="json")
    assert resp.status_code == 400


def test_list_query_filters(api_client: APIClient, register) -> None:
    _login(api_client, modules=["risk"], clearance=4)
    Risk.objects.create(
        title_ar="فيضان",
        title_en="Flooding",
        likelihood=2,
        impact=3,
        status=Risk.Status.OPEN,
        classification=1,
    )
    rows = api_client.get("/api/risk/?q=flood").json()
    assert {r["title_en"] for r in rows} == {"Flooding"}


def test_list_ordering_whitelist(api_client: APIClient, register) -> None:
    _login(api_client, modules=["risk"], clearance=4)
    rows = api_client.get("/api/risk/?ordering=classification").json()
    assert [r["classification"] for r in rows] == [1, 2, 3, 4]
    # Unknown ordering field is ignored and STILL returns an array.
    rows = api_client.get("/api/risk/?ordering=bogus").json()
    assert isinstance(rows, list)


def test_update_over_clearance_object_403_denied(api_client: APIClient, register) -> None:
    _login(api_client, modules=["risk"], clearance=2)
    resp = api_client.patch(f"/api/risk/{register[4].id}", {"title_en": "X"}, format="json")
    assert resp.status_code == 403
    assert AuditEvent.objects.filter(
        action="view_risk", target_id=str(register[4].id), result="DENIED"
    ).exists()


def test_update_raise_classification_above_clearance_403(api_client: APIClient, register) -> None:
    _login(api_client, modules=["risk"], clearance=2)
    resp = api_client.patch(f"/api/risk/{register[1].id}", {"classification": 4}, format="json")
    assert resp.status_code == 403
    register[1].refresh_from_db()
    assert register[1].classification == 1


def test_update_within_clearance_200_and_audited(api_client: APIClient, register) -> None:
    _login(api_client, modules=["risk"], clearance=3)
    resp = api_client.patch(f"/api/risk/{register[2].id}", {"title_en": "Renamed"}, format="json")
    assert resp.status_code == 200
    assert resp.json()["title_en"] == "Renamed"
    assert AuditEvent.objects.filter(
        action="update_risk", target_id=str(register[2].id), result="GRANTED"
    ).exists()


def test_update_recomputes_score(api_client: APIClient, register) -> None:
    _login(api_client, modules=["risk"], clearance=4)
    resp = api_client.patch(
        f"/api/risk/{register[1].id}", {"likelihood": 5, "impact": 4}, format="json"
    )
    assert resp.status_code == 200
    assert resp.json()["score"] == 20


def test_delete_over_clearance_403(api_client: APIClient, register) -> None:
    _login(api_client, modules=["risk"], clearance=2)
    resp = api_client.delete(f"/api/risk/{register[4].id}")
    assert resp.status_code == 403
    assert Risk.objects.filter(pk=register[4].id).exists()


def test_delete_success_204_and_audited(api_client: APIClient, register) -> None:
    _login(api_client, modules=["risk"], clearance=3)
    target_id = register[3].id
    resp = api_client.delete(f"/api/risk/{target_id}")
    assert resp.status_code == 204
    assert not Risk.objects.filter(pk=target_id).exists()
    assert AuditEvent.objects.filter(
        action="delete_risk", target_id=str(target_id), result="GRANTED"
    ).exists()


def test_create_requires_module_and_auth(api_client: APIClient) -> None:
    assert api_client.post("/api/risk/", _payload(1), format="json").status_code == 403
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'risk'
    assert api_client.post("/api/risk/", _payload(1), format="json").status_code == 403


def test_module_summary_clearance_respecting(api_client: APIClient, register) -> None:
    role = RoleFactory(code="rsum", modules=["risk"])
    user = UserFactory(username="usum", role=role, clearance=2)
    # register: L1 score 1, L2 score 4, L3 score 9, L4 score 16. Add a high open one.
    Risk.objects.create(
        title_ar="خطر حرج",
        title_en="Critical Risk",
        likelihood=5,
        impact=4,
        status=Risk.Status.OPEN,
        classification=2,
    )
    summary = services.module_summary(user)
    assert summary["key"] == "risk"
    assert summary["total"] == 3  # L1, L2, and the new clearance-2 risk
    assert summary["open"] == 3
    assert summary["high"] == 1  # only the score-20 risk clears the >=15 threshold


def test_search_clearance_respecting(api_client: APIClient, register) -> None:
    role = RoleFactory(code="rsrch", modules=["risk"])
    user = UserFactory(username="usrch", role=role, clearance=2)
    # "Risk L4" is over clearance and must never surface in search results.
    hits = services.search(user, "risk")
    labels = {h["label_en"] for h in hits}
    assert labels == {"Risk L1", "Risk L2"}
    assert all(h["kind"] == "risk" for h in hits)
    # Empty query short-circuits to an empty list.
    assert services.search(user, "   ") == []
