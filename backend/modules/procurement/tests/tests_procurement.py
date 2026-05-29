"""Phase 13 gate: the purchase-order list excludes over-clearance orders
SERVER-side (FILTER pattern), and the detail endpoint is IDOR-safe (an
over-clearance id returns 403 + a DENIED audit row, never the record body)."""

from __future__ import annotations

from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from modules.iam.infrastructure.models import AuditEvent
from modules.iam.tests.factories import RoleFactory, UserFactory
from modules.procurement.infrastructure.models import PurchaseOrder, Vendor

pytestmark = pytest.mark.django_db


@pytest.fixture
def vendor() -> Vendor:
    return Vendor.objects.create(
        name_ar="مورد",
        name_en="Vendor",
        category="Logistics",
        rating=3,
        classification=1,
    )


@pytest.fixture
def orders(vendor: Vendor) -> dict[int, PurchaseOrder]:
    out = {}
    for level in (1, 2, 3, 4):
        out[level] = PurchaseOrder.objects.create(
            vendor=vendor,
            title_ar=f"أمر شراء{level}",
            title_en=f"Order L{level}",
            total=Decimal("1000.00"),
            status=PurchaseOrder.Status.DRAFT,
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


def test_list_excludes_over_clearance_orders(api_client: APIClient, orders) -> None:
    _login(api_client, modules=["procurement"], clearance=2)
    rows = api_client.get("/api/procurement/").json()
    levels = {r["classification"] for r in rows}
    # Only orders at or below the viewer's clearance are returned at all.
    assert levels == {1, 2}


def test_detail_over_clearance_denied_and_audited(api_client: APIClient, orders) -> None:
    _login(api_client, modules=["procurement"], clearance=2)
    resp = api_client.get(f"/api/procurement/{orders[4].id}")
    assert resp.status_code == 403
    assert "title_en" not in resp.json()
    assert AuditEvent.objects.filter(
        action="view_purchase_order", target_id=str(orders[4].id), result="DENIED"
    ).exists()


def test_detail_authorized_returns_order_and_audits(api_client: APIClient, orders) -> None:
    _login(api_client, modules=["procurement"], clearance=3)
    resp = api_client.get(f"/api/procurement/{orders[3].id}")
    assert resp.status_code == 200
    assert resp.json()["title_en"] == "Order L3"
    assert AuditEvent.objects.filter(
        action="view_purchase_order", target_id=str(orders[3].id), result="GRANTED"
    ).exists()


def test_procurement_requires_module(api_client: APIClient, orders) -> None:
    assert api_client.get("/api/procurement/").status_code == 403  # unauthenticated
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'procurement'
    assert api_client.get("/api/procurement/").status_code == 403


def _payload(vendor: Vendor, classification: int) -> dict[str, object]:
    return {
        "vendor": vendor.id,
        "title_ar": "أمر شراء جديد",
        "title_en": "New Order",
        "total": "2500.00",
        "status": PurchaseOrder.Status.DRAFT,
        "classification": classification,
    }


def test_create_within_clearance_201_and_audited(api_client: APIClient, vendor) -> None:
    _login(api_client, modules=["procurement"], clearance=3)
    resp = api_client.post("/api/procurement/", _payload(vendor, 2), format="json")
    assert resp.status_code == 201
    assert resp.json()["title_en"] == "New Order"
    new_id = resp.json()["id"]
    assert AuditEvent.objects.filter(
        action="create_purchase_order", target_id=str(new_id), result="GRANTED"
    ).exists()


def test_create_above_clearance_403(api_client: APIClient, vendor) -> None:
    _login(api_client, modules=["procurement"], clearance=2)
    resp = api_client.post("/api/procurement/", _payload(vendor, 4), format="json")
    assert resp.status_code == 403
    assert not PurchaseOrder.objects.filter(title_en="New Order").exists()


def test_create_invalid_classification_400(api_client: APIClient, vendor) -> None:
    _login(api_client, modules=["procurement"], clearance=4)
    resp = api_client.post("/api/procurement/", _payload(vendor, 7), format="json")
    assert resp.status_code == 400


def test_create_requires_module_and_auth(api_client: APIClient, vendor) -> None:
    assert (
        api_client.post("/api/procurement/", _payload(vendor, 1), format="json").status_code == 403
    )
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'procurement'
    assert (
        api_client.post("/api/procurement/", _payload(vendor, 1), format="json").status_code == 403
    )


def test_list_query_filters(api_client: APIClient, vendor, orders) -> None:
    _login(api_client, modules=["procurement"], clearance=4)
    PurchaseOrder.objects.create(
        vendor=vendor,
        title_ar="رادار",
        title_en="Radar Unit",
        total=Decimal("9000.00"),
        status=PurchaseOrder.Status.DRAFT,
        classification=1,
    )
    rows = api_client.get("/api/procurement/?q=radar").json()
    assert {r["title_en"] for r in rows} == {"Radar Unit"}


def test_list_ordering_whitelist(api_client: APIClient, orders) -> None:
    _login(api_client, modules=["procurement"], clearance=4)
    rows = api_client.get("/api/procurement/?ordering=classification").json()
    assert [r["classification"] for r in rows] == [1, 2, 3, 4]
    # Unknown ordering field is ignored and STILL returns an array.
    rows = api_client.get("/api/procurement/?ordering=bogus").json()
    assert isinstance(rows, list)


def test_update_over_clearance_object_403_denied(api_client: APIClient, orders) -> None:
    _login(api_client, modules=["procurement"], clearance=2)
    resp = api_client.patch(f"/api/procurement/{orders[4].id}", {"title_en": "X"}, format="json")
    assert resp.status_code == 403
    assert AuditEvent.objects.filter(
        action="view_purchase_order", target_id=str(orders[4].id), result="DENIED"
    ).exists()


def test_update_raise_classification_above_clearance_403(api_client: APIClient, orders) -> None:
    _login(api_client, modules=["procurement"], clearance=2)
    resp = api_client.patch(
        f"/api/procurement/{orders[1].id}", {"classification": 4}, format="json"
    )
    assert resp.status_code == 403
    orders[1].refresh_from_db()
    assert orders[1].classification == 1


def test_update_within_clearance_200_and_audited(api_client: APIClient, orders) -> None:
    _login(api_client, modules=["procurement"], clearance=3)
    resp = api_client.patch(
        f"/api/procurement/{orders[2].id}", {"title_en": "Renamed"}, format="json"
    )
    assert resp.status_code == 200
    assert resp.json()["title_en"] == "Renamed"
    assert AuditEvent.objects.filter(
        action="update_purchase_order", target_id=str(orders[2].id), result="GRANTED"
    ).exists()


def test_delete_over_clearance_403(api_client: APIClient, orders) -> None:
    _login(api_client, modules=["procurement"], clearance=2)
    resp = api_client.delete(f"/api/procurement/{orders[4].id}")
    assert resp.status_code == 403
    assert PurchaseOrder.objects.filter(pk=orders[4].id).exists()


def test_delete_success_204_and_audited(api_client: APIClient, orders) -> None:
    _login(api_client, modules=["procurement"], clearance=3)
    target_id = orders[3].id
    resp = api_client.delete(f"/api/procurement/{target_id}")
    assert resp.status_code == 204
    assert not PurchaseOrder.objects.filter(pk=target_id).exists()
    assert AuditEvent.objects.filter(
        action="delete_purchase_order", target_id=str(target_id), result="GRANTED"
    ).exists()


def test_summary_respects_clearance(api_client: APIClient, orders) -> None:
    from modules.procurement.application import services

    role = RoleFactory(code="r2", modules=["procurement"])
    user = UserFactory(username="su2", role=role, clearance=2)
    summary = services.module_summary(user)
    assert summary["key"] == "procurement"
    assert summary["total"] == 2  # only classifications 1 and 2
    assert summary["vendors"] == 1
    assert {row["status"] for row in summary["by_status"]} == set(PurchaseOrder.Status.values)


def test_search_respects_clearance(api_client: APIClient, orders) -> None:
    from modules.procurement.application import services

    role = RoleFactory(code="r2", modules=["procurement"])
    user = UserFactory(username="ss2", role=role, clearance=2)
    results = services.search(user, "Order")
    levels = {r["label_en"] for r in results}
    # Over-clearance orders (L3/L4) never surface in search.
    assert levels == {"Order L1", "Order L2"}
    assert all(r["kind"] == "purchase_order" for r in results)


def test_vendor_list_excludes_over_clearance(api_client: APIClient) -> None:
    for level in (1, 2, 3, 4):
        Vendor.objects.create(
            name_ar=f"مورد{level}",
            name_en=f"Vendor L{level}",
            category="Logistics",
            rating=level,
            classification=level,
        )
    _login(api_client, modules=["procurement"], clearance=2)
    rows = api_client.get("/api/procurement/vendors").json()
    assert {r["classification"] for r in rows} == {1, 2}
