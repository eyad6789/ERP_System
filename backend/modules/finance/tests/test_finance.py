"""Phase 5 gate: budget totals reconcile and stay clearance-filtered; over-clearance
contracts are listed but with title/vendor/value withheld server-side; full reads are
denied (403) + audited for over-clearance; the export is permission-checked, audited,
and only emits contracts the caller is cleared for."""

from __future__ import annotations

from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from modules.finance.infrastructure.models import Budget, Contract, Expenditure
from modules.iam.infrastructure.models import AuditEvent
from modules.iam.tests.factories import RoleFactory, UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def budget() -> Budget:
    return Budget.objects.create(
        fiscal_year=2026, total_amount=Decimal("480000000000"), currency="IQD"
    )


@pytest.fixture
def expenditures() -> dict[str, Expenditure]:
    out = {}
    out["OPS"] = Expenditure.objects.create(
        department_code="OPS", category="Operations", amount=Decimal("100"), classification=2
    )
    out["INT"] = Expenditure.objects.create(
        department_code="INT", category="Intelligence", amount=Decimal("400"), classification=4
    )
    return out


@pytest.fixture
def contracts() -> dict[int, Contract]:
    out = {}
    for level in (1, 2, 3, 4):
        out[level] = Contract.objects.create(
            title_ar=f"عقد{level}",
            title_en=f"Contract L{level}",
            vendor=f"Vendor {level}",
            value=Decimal(f"{level}000"),
            progress=10 * level,
            status=Contract.Status.SIGNED,
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


def test_summary_totals_reconcile_and_filter(
    api_client: APIClient, budget: Budget, expenditures: dict[str, Expenditure]
) -> None:
    _login(api_client, modules=["finance"], clearance=2)
    data = api_client.get("/api/finance/summary").json()
    # The clearance-2 viewer only sees the OPS (level 2) spend, not INT (level 4).
    by_dept = {row["department_code"]: Decimal(row["amount"]) for row in data["by_department"]}
    assert by_dept == {"OPS": Decimal("100")}
    # Totals reconcile: headline spent == sum of returned by_department amounts.
    assert Decimal(data["spent"]) == sum(by_dept.values())
    assert Decimal(data["remaining"]) == Decimal(data["total_amount"]) - Decimal(data["spent"])


def test_list_withholds_value_and_title_for_over_clearance(
    api_client: APIClient, contracts: dict[int, Contract]
) -> None:
    _login(api_client, modules=["finance"], clearance=2)
    rows = {r["classification"]: r for r in api_client.get("/api/finance/contracts").json()}
    assert set(rows) == {1, 2, 3, 4}
    assert rows[2]["locked"] is False and rows[2]["title_en"] == "Contract L2"
    assert rows[2]["value"] == "2000.00"
    # Over-clearance rows are listed but title/vendor/value are withheld.
    assert rows[4]["locked"] is True
    assert rows[4]["title_en"] is None
    assert rows[4]["vendor"] is None
    assert rows[4]["value"] is None


def test_detail_over_clearance_denied_and_audited(
    api_client: APIClient, contracts: dict[int, Contract]
) -> None:
    _login(api_client, modules=["finance"], clearance=2)
    resp = api_client.get(f"/api/finance/contracts/{contracts[4].id}")
    assert resp.status_code == 403
    assert "vendor" not in resp.json()
    assert AuditEvent.objects.filter(
        action="view_contract", target_id=str(contracts[4].id), result="DENIED"
    ).exists()


def test_detail_authorized_returns_full_and_audited(
    api_client: APIClient, contracts: dict[int, Contract]
) -> None:
    _login(api_client, modules=["finance"], clearance=3)
    resp = api_client.get(f"/api/finance/contracts/{contracts[3].id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["vendor"] == "Vendor 3"
    assert body["value"] == "3000.00"
    assert AuditEvent.objects.filter(
        action="view_contract", target_id=str(contracts[3].id), result="GRANTED"
    ).exists()


def test_export_audited_and_clearance_filtered(
    api_client: APIClient, contracts: dict[int, Contract]
) -> None:
    _login(api_client, modules=["finance"], clearance=2)
    resp = api_client.get("/api/finance/export")
    assert resp.status_code == 200
    data = resp.json()
    assert data["format"] == "csv"
    # Only contracts at or below clearance 2 are emitted.
    levels = {row["classification"] for row in data["rows"]}
    assert levels == {1, 2}
    assert AuditEvent.objects.filter(
        action="export_finance", target_type="contracts", result="GRANTED"
    ).exists()


def test_finance_requires_module(api_client: APIClient, contracts: dict[int, Contract]) -> None:
    assert api_client.get("/api/finance/contracts").status_code == 403  # unauthenticated
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'finance'
    assert api_client.get("/api/finance/contracts").status_code == 403
    assert api_client.get("/api/finance/summary").status_code == 403


def _new_contract_payload(classification: int) -> dict[str, object]:
    return {
        "title_ar": "عقد جديد",
        "title_en": "New Contract",
        "vendor": "Acme",
        "value": "5000",
        "progress": 0,
        "status": Contract.Status.SIGNED,
        "classification": classification,
    }


def test_create_within_clearance_returns_201_and_audits(api_client: APIClient) -> None:
    _login(api_client, modules=["finance"], clearance=3)
    resp = api_client.post("/api/finance/contracts", _new_contract_payload(2), format="json")
    assert resp.status_code == 201
    body = resp.json()
    assert body["title_en"] == "New Contract"
    assert body["classification"] == 2
    assert body["owner"] == "u3"
    assert AuditEvent.objects.filter(
        action="create_contract", target_id=str(body["id"]), result="GRANTED"
    ).exists()
    assert Contract.objects.filter(pk=body["id"]).exists()


def test_create_above_clearance_rejected_403(api_client: APIClient) -> None:
    _login(api_client, modules=["finance"], clearance=2)
    resp = api_client.post("/api/finance/contracts", _new_contract_payload(4), format="json")
    assert resp.status_code == 403
    assert Contract.objects.filter(title_en="New Contract").count() == 0


def test_create_rejects_classification_out_of_range(api_client: APIClient) -> None:
    _login(api_client, modules=["finance"], clearance=4)
    resp = api_client.post("/api/finance/contracts", _new_contract_payload(5), format="json")
    assert resp.status_code == 400


def test_update_over_clearance_object_denied_and_audited(
    api_client: APIClient, contracts: dict[int, Contract]
) -> None:
    _login(api_client, modules=["finance"], clearance=2)
    resp = api_client.patch(
        f"/api/finance/contracts/{contracts[4].id}", {"progress": 99}, format="json"
    )
    assert resp.status_code == 403
    contracts[4].refresh_from_db()
    assert contracts[4].progress == 40
    assert AuditEvent.objects.filter(
        action="view_contract", target_id=str(contracts[4].id), result="DENIED"
    ).exists()


def test_update_within_clearance_succeeds_and_audits(
    api_client: APIClient, contracts: dict[int, Contract]
) -> None:
    _login(api_client, modules=["finance"], clearance=3)
    resp = api_client.patch(
        f"/api/finance/contracts/{contracts[3].id}", {"progress": 77}, format="json"
    )
    assert resp.status_code == 200
    assert resp.json()["progress"] == 77
    assert AuditEvent.objects.filter(
        action="update_contract", target_id=str(contracts[3].id), result="GRANTED"
    ).exists()


def test_update_raising_classification_above_clearance_rejected(
    api_client: APIClient, contracts: dict[int, Contract]
) -> None:
    _login(api_client, modules=["finance"], clearance=3)
    resp = api_client.patch(
        f"/api/finance/contracts/{contracts[3].id}",
        {"classification": 4},
        format="json",
    )
    assert resp.status_code == 403
    contracts[3].refresh_from_db()
    assert contracts[3].classification == 3


def test_delete_over_clearance_denied(
    api_client: APIClient, contracts: dict[int, Contract]
) -> None:
    _login(api_client, modules=["finance"], clearance=2)
    resp = api_client.delete(f"/api/finance/contracts/{contracts[4].id}")
    assert resp.status_code == 403
    assert Contract.objects.filter(pk=contracts[4].id).exists()


def test_delete_within_clearance_returns_204_and_audits(
    api_client: APIClient, contracts: dict[int, Contract]
) -> None:
    _login(api_client, modules=["finance"], clearance=3)
    target_id = contracts[3].id
    resp = api_client.delete(f"/api/finance/contracts/{target_id}")
    assert resp.status_code == 204
    assert not Contract.objects.filter(pk=target_id).exists()
    assert AuditEvent.objects.filter(
        action="delete_contract", target_id=str(target_id), result="GRANTED"
    ).exists()


def test_list_supports_query_filter_and_returns_array(
    api_client: APIClient, contracts: dict[int, Contract]
) -> None:
    _login(api_client, modules=["finance"], clearance=4)
    resp = api_client.get("/api/finance/contracts?q=Contract L2")
    assert resp.status_code == 200
    rows = resp.json()
    assert isinstance(rows, list)
    assert {r["classification"] for r in rows} == {2}


def test_list_supports_ordering_whitelist(
    api_client: APIClient, contracts: dict[int, Contract]
) -> None:
    _login(api_client, modules=["finance"], clearance=4)
    rows = api_client.get("/api/finance/contracts?ordering=value").json()
    values = [r["value"] for r in rows]
    assert values == sorted(values, key=lambda v: float(v))
    # Unknown ordering field is ignored (default ordering, still an array).
    rows = api_client.get("/api/finance/contracts?ordering=nope").json()
    assert isinstance(rows, list) and len(rows) == 4


def test_status_workflow_advances_and_audits(
    api_client: APIClient, contracts: dict[int, Contract]
) -> None:
    _login(api_client, modules=["finance"], clearance=3)
    resp = api_client.post(
        f"/api/finance/contracts/{contracts[3].id}/status",
        {"status": Contract.Status.COMPLETED},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == Contract.Status.COMPLETED
    assert AuditEvent.objects.filter(
        action="advance_contract", target_id=str(contracts[3].id), result="GRANTED"
    ).exists()


def test_status_workflow_rejects_invalid_status(
    api_client: APIClient, contracts: dict[int, Contract]
) -> None:
    _login(api_client, modules=["finance"], clearance=3)
    resp = api_client.post(
        f"/api/finance/contracts/{contracts[3].id}/status",
        {"status": "bogus"},
        format="json",
    )
    assert resp.status_code == 400


def test_mutations_require_module(api_client: APIClient, contracts: dict[int, Contract]) -> None:
    # Unauthenticated create is rejected.
    assert (
        api_client.post(
            "/api/finance/contracts", _new_contract_payload(1), format="json"
        ).status_code
        == 403
    )
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'finance'
    assert (
        api_client.post(
            "/api/finance/contracts", _new_contract_payload(1), format="json"
        ).status_code
        == 403
    )
    assert api_client.delete(f"/api/finance/contracts/{contracts[1].id}").status_code == 403
