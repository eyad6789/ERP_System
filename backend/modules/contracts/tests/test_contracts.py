"""Phase gate: the contract register excludes over-clearance contracts SERVER-side
(FILTER pattern), and the detail endpoint is IDOR-safe (an over-clearance id
returns 403 + a DENIED audit row, never the record body)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from modules.contracts.infrastructure.models import ContractRecord
from modules.iam.infrastructure.models import AuditEvent
from modules.iam.tests.factories import RoleFactory, UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def register() -> dict[int, ContractRecord]:
    out = {}
    for level in (1, 2, 3, 4):
        out[level] = ContractRecord.objects.create(
            title_ar=f"عقد{level}",
            title_en=f"Contract L{level}",
            party="Acme Corp",
            value=Decimal("100000.00"),
            start_date=date(2025, 1, 1),
            end_date=date(2026, 1, 1),
            status=ContractRecord.Status.ACTIVE,
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


def test_list_excludes_over_clearance_contracts(api_client: APIClient, register) -> None:
    _login(api_client, modules=["contracts"], clearance=2)
    rows = api_client.get("/api/contracts/").json()
    levels = {r["classification"] for r in rows}
    # Only contracts at or below the viewer's clearance are returned at all.
    assert levels == {1, 2}


def test_detail_over_clearance_denied_and_audited(api_client: APIClient, register) -> None:
    _login(api_client, modules=["contracts"], clearance=2)
    resp = api_client.get(f"/api/contracts/{register[4].id}")
    assert resp.status_code == 403
    assert "title_en" not in resp.json()
    assert AuditEvent.objects.filter(
        action="view_contract", target_id=str(register[4].id), result="DENIED"
    ).exists()


def test_detail_authorized_returns_contract_and_audits(api_client: APIClient, register) -> None:
    _login(api_client, modules=["contracts"], clearance=3)
    resp = api_client.get(f"/api/contracts/{register[3].id}")
    assert resp.status_code == 200
    assert resp.json()["title_en"] == "Contract L3"
    assert AuditEvent.objects.filter(
        action="view_contract", target_id=str(register[3].id), result="GRANTED"
    ).exists()


def test_contracts_require_module(api_client: APIClient, register) -> None:
    assert api_client.get("/api/contracts/").status_code == 403  # unauthenticated
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'contracts'
    assert api_client.get("/api/contracts/").status_code == 403


def _payload(classification: int) -> dict[str, object]:
    return {
        "title_ar": "عقد جديد",
        "title_en": "New Contract",
        "party": "Globex",
        "value": "250000.00",
        "start_date": "2025-03-01",
        "end_date": "2026-03-01",
        "status": ContractRecord.Status.ACTIVE,
        "classification": classification,
    }


def test_create_within_clearance_201_and_audited(api_client: APIClient) -> None:
    _login(api_client, modules=["contracts"], clearance=3)
    resp = api_client.post("/api/contracts/", _payload(2), format="json")
    assert resp.status_code == 201
    assert resp.json()["title_en"] == "New Contract"
    new_id = resp.json()["id"]
    assert AuditEvent.objects.filter(
        action="create_contract", target_id=str(new_id), result="GRANTED"
    ).exists()


def test_create_above_clearance_403(api_client: APIClient) -> None:
    _login(api_client, modules=["contracts"], clearance=2)
    resp = api_client.post("/api/contracts/", _payload(4), format="json")
    assert resp.status_code == 403
    assert not ContractRecord.objects.filter(title_en="New Contract").exists()


def test_create_invalid_classification_400(api_client: APIClient) -> None:
    _login(api_client, modules=["contracts"], clearance=4)
    resp = api_client.post("/api/contracts/", _payload(7), format="json")
    assert resp.status_code == 400


def test_list_query_filters(api_client: APIClient, register) -> None:
    _login(api_client, modules=["contracts"], clearance=4)
    ContractRecord.objects.create(
        title_ar="عقد التأمين",
        title_en="Insurance Coverage",
        party="ShieldCo",
        value=Decimal("50000.00"),
        start_date=date(2025, 1, 1),
        end_date=date(2026, 1, 1),
        status=ContractRecord.Status.ACTIVE,
        classification=1,
    )
    rows = api_client.get("/api/contracts/?q=insuran").json()
    assert {r["title_en"] for r in rows} == {"Insurance Coverage"}


def test_list_ordering_whitelist(api_client: APIClient, register) -> None:
    _login(api_client, modules=["contracts"], clearance=4)
    rows = api_client.get("/api/contracts/?ordering=classification").json()
    assert [r["classification"] for r in rows] == [1, 2, 3, 4]
    # Unknown ordering field is ignored and STILL returns an array.
    rows = api_client.get("/api/contracts/?ordering=bogus").json()
    assert isinstance(rows, list)


def test_update_over_clearance_object_403_denied(api_client: APIClient, register) -> None:
    _login(api_client, modules=["contracts"], clearance=2)
    resp = api_client.patch(f"/api/contracts/{register[4].id}", {"title_en": "X"}, format="json")
    assert resp.status_code == 403
    assert AuditEvent.objects.filter(
        action="view_contract", target_id=str(register[4].id), result="DENIED"
    ).exists()


def test_update_raise_classification_above_clearance_403(api_client: APIClient, register) -> None:
    _login(api_client, modules=["contracts"], clearance=2)
    resp = api_client.patch(
        f"/api/contracts/{register[1].id}", {"classification": 4}, format="json"
    )
    assert resp.status_code == 403
    register[1].refresh_from_db()
    assert register[1].classification == 1


def test_update_within_clearance_200_and_audited(api_client: APIClient, register) -> None:
    _login(api_client, modules=["contracts"], clearance=3)
    resp = api_client.patch(
        f"/api/contracts/{register[2].id}", {"title_en": "Renamed"}, format="json"
    )
    assert resp.status_code == 200
    assert resp.json()["title_en"] == "Renamed"
    assert AuditEvent.objects.filter(
        action="update_contract", target_id=str(register[2].id), result="GRANTED"
    ).exists()


def test_delete_over_clearance_403(api_client: APIClient, register) -> None:
    _login(api_client, modules=["contracts"], clearance=2)
    resp = api_client.delete(f"/api/contracts/{register[4].id}")
    assert resp.status_code == 403
    assert ContractRecord.objects.filter(pk=register[4].id).exists()


def test_delete_success_204_and_audited(api_client: APIClient, register) -> None:
    _login(api_client, modules=["contracts"], clearance=3)
    target_id = register[3].id
    resp = api_client.delete(f"/api/contracts/{target_id}")
    assert resp.status_code == 204
    assert not ContractRecord.objects.filter(pk=target_id).exists()
    assert AuditEvent.objects.filter(
        action="delete_contract", target_id=str(target_id), result="GRANTED"
    ).exists()


def test_create_requires_module_and_auth(api_client: APIClient) -> None:
    assert api_client.post("/api/contracts/", _payload(1), format="json").status_code == 403
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'contracts'
    assert api_client.post("/api/contracts/", _payload(1), format="json").status_code == 403


def test_search_visible_only(api_client: APIClient, register) -> None:
    role = RoleFactory(code="r2", modules=["contracts"])
    user = UserFactory(username="searcher", password="test-pass-12345", role=role, clearance=2)
    from modules.contracts.application import public as contracts

    results = contracts.search(user, "Contract")
    levels = {int(r["label_en"].split("L")[-1]) for r in results}
    assert levels <= {1, 2}
