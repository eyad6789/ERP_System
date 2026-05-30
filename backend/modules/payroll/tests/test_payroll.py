"""Phase 15 gate: the payslip register excludes over-clearance rows SERVER-side
(FILTER pattern), and the detail endpoint is IDOR-safe (an over-clearance id
returns 403 + a DENIED audit row, never the record body). `net` is derived."""

from __future__ import annotations

from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from modules.iam.infrastructure.models import AuditEvent
from modules.iam.tests.factories import RoleFactory, UserFactory
from modules.payroll.infrastructure.models import Payslip

pytestmark = pytest.mark.django_db


@pytest.fixture
def register() -> dict[int, Payslip]:
    out = {}
    for level in (1, 2, 3, 4):
        out[level] = Payslip.objects.create(
            employee=f"Employee L{level}",
            period="2026-05",
            base=Decimal("1000.00"),
            allowances=Decimal("100.00"),
            deductions=Decimal("50.00"),
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


def test_list_excludes_over_clearance_payslips(api_client: APIClient, register) -> None:
    _login(api_client, modules=["payroll"], clearance=2)
    rows = api_client.get("/api/payroll/").json()
    levels = {r["classification"] for r in rows}
    # Only payslips at or below the viewer's clearance are returned at all.
    assert levels == {1, 2}


def test_net_is_derived_on_save(api_client: APIClient, register) -> None:
    # base + allowances - deductions = 1000 + 100 - 50 = 1050.
    assert register[1].net == Decimal("1050.00")


def test_detail_over_clearance_denied_and_audited(api_client: APIClient, register) -> None:
    _login(api_client, modules=["payroll"], clearance=2)
    resp = api_client.get(f"/api/payroll/{register[4].id}")
    assert resp.status_code == 403
    assert "employee" not in resp.json()
    assert AuditEvent.objects.filter(
        action="view_payslip", target_id=str(register[4].id), result="DENIED"
    ).exists()


def test_detail_authorized_returns_payslip_and_audits(api_client: APIClient, register) -> None:
    _login(api_client, modules=["payroll"], clearance=3)
    resp = api_client.get(f"/api/payroll/{register[3].id}")
    assert resp.status_code == 200
    assert resp.json()["employee"] == "Employee L3"
    assert AuditEvent.objects.filter(
        action="view_payslip", target_id=str(register[3].id), result="GRANTED"
    ).exists()


def test_payroll_require_module(api_client: APIClient, register) -> None:
    assert api_client.get("/api/payroll/").status_code == 403  # unauthenticated
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'payroll'
    assert api_client.get("/api/payroll/").status_code == 403


def _payload(classification: int) -> dict[str, object]:
    return {
        "employee": "New Hire",
        "period": "2026-06",
        "base": "9000.00",
        "allowances": "1000.00",
        "deductions": "500.00",
        "classification": classification,
    }


def test_create_within_clearance_201_and_audited(api_client: APIClient) -> None:
    _login(api_client, modules=["payroll"], clearance=3)
    resp = api_client.post("/api/payroll/", _payload(2), format="json")
    assert resp.status_code == 201
    assert resp.json()["employee"] == "New Hire"
    # net derived: 9000 + 1000 - 500 = 9500.
    assert resp.json()["net"] == "9500.00"
    new_id = resp.json()["id"]
    assert AuditEvent.objects.filter(
        action="create_payslip", target_id=str(new_id), result="GRANTED"
    ).exists()


def test_create_above_clearance_403(api_client: APIClient) -> None:
    _login(api_client, modules=["payroll"], clearance=2)
    resp = api_client.post("/api/payroll/", _payload(4), format="json")
    assert resp.status_code == 403
    assert not Payslip.objects.filter(employee="New Hire").exists()


def test_create_invalid_classification_400(api_client: APIClient) -> None:
    _login(api_client, modules=["payroll"], clearance=4)
    resp = api_client.post("/api/payroll/", _payload(7), format="json")
    assert resp.status_code == 400


def test_list_query_filters(api_client: APIClient, register) -> None:
    _login(api_client, modules=["payroll"], clearance=4)
    Payslip.objects.create(
        employee="Quartermaster",
        period="2026-05",
        base=Decimal("8000.00"),
        allowances=Decimal("0"),
        deductions=Decimal("0"),
        classification=1,
    )
    rows = api_client.get("/api/payroll/?q=quarter").json()
    assert {r["employee"] for r in rows} == {"Quartermaster"}


def test_list_ordering_whitelist(api_client: APIClient, register) -> None:
    _login(api_client, modules=["payroll"], clearance=4)
    rows = api_client.get("/api/payroll/?ordering=classification").json()
    assert [r["classification"] for r in rows] == [1, 2, 3, 4]
    # Unknown ordering field is ignored and STILL returns an array.
    rows = api_client.get("/api/payroll/?ordering=bogus").json()
    assert isinstance(rows, list)


def test_update_over_clearance_object_403_denied(api_client: APIClient, register) -> None:
    _login(api_client, modules=["payroll"], clearance=2)
    resp = api_client.patch(f"/api/payroll/{register[4].id}", {"employee": "X"}, format="json")
    assert resp.status_code == 403
    assert AuditEvent.objects.filter(
        action="view_payslip", target_id=str(register[4].id), result="DENIED"
    ).exists()


def test_update_raise_classification_above_clearance_403(api_client: APIClient, register) -> None:
    _login(api_client, modules=["payroll"], clearance=2)
    resp = api_client.patch(f"/api/payroll/{register[1].id}", {"classification": 4}, format="json")
    assert resp.status_code == 403
    register[1].refresh_from_db()
    assert register[1].classification == 1


def test_update_within_clearance_200_and_audited(api_client: APIClient, register) -> None:
    _login(api_client, modules=["payroll"], clearance=3)
    resp = api_client.patch(
        f"/api/payroll/{register[2].id}", {"employee": "Renamed"}, format="json"
    )
    assert resp.status_code == 200
    assert resp.json()["employee"] == "Renamed"
    assert AuditEvent.objects.filter(
        action="update_payslip", target_id=str(register[2].id), result="GRANTED"
    ).exists()


def test_update_recomputes_net(api_client: APIClient, register) -> None:
    _login(api_client, modules=["payroll"], clearance=3)
    resp = api_client.patch(f"/api/payroll/{register[3].id}", {"base": "2000.00"}, format="json")
    assert resp.status_code == 200
    # 2000 + 100 - 50 = 2050.
    assert resp.json()["net"] == "2050.00"


def test_delete_over_clearance_403(api_client: APIClient, register) -> None:
    _login(api_client, modules=["payroll"], clearance=2)
    resp = api_client.delete(f"/api/payroll/{register[4].id}")
    assert resp.status_code == 403
    assert Payslip.objects.filter(pk=register[4].id).exists()


def test_delete_success_204_and_audited(api_client: APIClient, register) -> None:
    _login(api_client, modules=["payroll"], clearance=3)
    target_id = register[3].id
    resp = api_client.delete(f"/api/payroll/{target_id}")
    assert resp.status_code == 204
    assert not Payslip.objects.filter(pk=target_id).exists()
    assert AuditEvent.objects.filter(
        action="delete_payslip", target_id=str(target_id), result="GRANTED"
    ).exists()


def test_create_requires_module_and_auth(api_client: APIClient) -> None:
    assert api_client.post("/api/payroll/", _payload(1), format="json").status_code == 403
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'payroll'
    assert api_client.post("/api/payroll/", _payload(1), format="json").status_code == 403


def test_search_excludes_over_clearance(api_client: APIClient, register) -> None:
    from modules.payroll.application import services

    role = RoleFactory(code="rs2", modules=["payroll"])
    user = UserFactory(username="searcher", role=role, clearance=2)
    results = services.search(user, "Employee")
    levels = {Payslip.objects.get(pk=r["id"]).classification for r in results}
    assert levels <= {1, 2}
    assert all(r["kind"] == "payslip" for r in results)
