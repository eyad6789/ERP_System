"""Phase 13 gate: the inventory listing excludes over-clearance items SERVER-side
(FILTER pattern), and the detail endpoint is IDOR-safe (an over-clearance id
returns 403 + a DENIED audit row, never the record body)."""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from modules.iam.infrastructure.models import AuditEvent
from modules.iam.tests.factories import RoleFactory, UserFactory
from modules.inventory.infrastructure.models import InventoryItem, Warehouse

pytestmark = pytest.mark.django_db


@pytest.fixture
def warehouse() -> Warehouse:
    return Warehouse.objects.create(
        code="WH-TEST",
        name_ar="مستودع",
        name_en="Test Warehouse",
        location="Depot",
    )


@pytest.fixture
def stock(warehouse: Warehouse) -> dict[int, InventoryItem]:
    out = {}
    for level in (1, 2, 3, 4):
        out[level] = InventoryItem.objects.create(
            sku=f"SKU-{level}",
            name_ar=f"صنف{level}",
            name_en=f"Item L{level}",
            quantity=level * 5,
            unit="unit",
            warehouse=warehouse,
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


def test_list_excludes_over_clearance_items(api_client: APIClient, stock) -> None:
    _login(api_client, modules=["inventory"], clearance=2)
    rows = api_client.get("/api/inventory/").json()
    levels = {r["classification"] for r in rows}
    # Only items at or below the viewer's clearance are returned at all.
    assert levels == {1, 2}


def test_detail_over_clearance_denied_and_audited(api_client: APIClient, stock) -> None:
    _login(api_client, modules=["inventory"], clearance=2)
    resp = api_client.get(f"/api/inventory/{stock[4].id}")
    assert resp.status_code == 403
    assert "name_en" not in resp.json()
    assert AuditEvent.objects.filter(
        action="view_item", target_id=str(stock[4].id), result="DENIED"
    ).exists()


def test_detail_authorized_returns_item_and_audits(api_client: APIClient, stock) -> None:
    _login(api_client, modules=["inventory"], clearance=3)
    resp = api_client.get(f"/api/inventory/{stock[3].id}")
    assert resp.status_code == 200
    assert resp.json()["name_en"] == "Item L3"
    assert AuditEvent.objects.filter(
        action="view_item", target_id=str(stock[3].id), result="GRANTED"
    ).exists()


def test_inventory_require_module(api_client: APIClient, stock) -> None:
    assert api_client.get("/api/inventory/").status_code == 403  # unauthenticated
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'inventory'
    assert api_client.get("/api/inventory/").status_code == 403


def _payload(warehouse: Warehouse, classification: int) -> dict[str, object]:
    return {
        "sku": "SKU-NEW",
        "name_ar": "صنف جديد",
        "name_en": "New Item",
        "quantity": 25,
        "unit": "unit",
        "warehouse": warehouse.id,
        "classification": classification,
    }


def test_create_within_clearance_201_and_audited(
    api_client: APIClient, warehouse: Warehouse
) -> None:
    _login(api_client, modules=["inventory"], clearance=3)
    resp = api_client.post("/api/inventory/", _payload(warehouse, 2), format="json")
    assert resp.status_code == 201
    assert resp.json()["name_en"] == "New Item"
    new_id = resp.json()["id"]
    assert AuditEvent.objects.filter(
        action="create_item", target_id=str(new_id), result="GRANTED"
    ).exists()


def test_create_above_clearance_403(api_client: APIClient, warehouse: Warehouse) -> None:
    _login(api_client, modules=["inventory"], clearance=2)
    resp = api_client.post("/api/inventory/", _payload(warehouse, 4), format="json")
    assert resp.status_code == 403
    assert not InventoryItem.objects.filter(name_en="New Item").exists()


def test_create_invalid_classification_400(api_client: APIClient, warehouse: Warehouse) -> None:
    _login(api_client, modules=["inventory"], clearance=4)
    resp = api_client.post("/api/inventory/", _payload(warehouse, 7), format="json")
    assert resp.status_code == 400


def test_list_query_filters(api_client: APIClient, warehouse: Warehouse, stock) -> None:
    _login(api_client, modules=["inventory"], clearance=4)
    InventoryItem.objects.create(
        sku="GEN-1",
        name_ar="مولد",
        name_en="Generator",
        quantity=3,
        unit="unit",
        warehouse=warehouse,
        classification=1,
    )
    rows = api_client.get("/api/inventory/?q=generat").json()
    assert {r["name_en"] for r in rows} == {"Generator"}


def test_list_ordering_whitelist(api_client: APIClient, stock) -> None:
    _login(api_client, modules=["inventory"], clearance=4)
    rows = api_client.get("/api/inventory/?ordering=classification").json()
    assert [r["classification"] for r in rows] == [1, 2, 3, 4]
    # Unknown ordering field is ignored and STILL returns an array.
    rows = api_client.get("/api/inventory/?ordering=bogus").json()
    assert isinstance(rows, list)


def test_update_over_clearance_object_403_denied(api_client: APIClient, stock) -> None:
    _login(api_client, modules=["inventory"], clearance=2)
    resp = api_client.patch(f"/api/inventory/{stock[4].id}", {"name_en": "X"}, format="json")
    assert resp.status_code == 403
    assert AuditEvent.objects.filter(
        action="view_item", target_id=str(stock[4].id), result="DENIED"
    ).exists()


def test_update_raise_classification_above_clearance_403(api_client: APIClient, stock) -> None:
    _login(api_client, modules=["inventory"], clearance=2)
    resp = api_client.patch(f"/api/inventory/{stock[1].id}", {"classification": 4}, format="json")
    assert resp.status_code == 403
    stock[1].refresh_from_db()
    assert stock[1].classification == 1


def test_update_within_clearance_200_and_audited(api_client: APIClient, stock) -> None:
    _login(api_client, modules=["inventory"], clearance=3)
    resp = api_client.patch(f"/api/inventory/{stock[2].id}", {"name_en": "Renamed"}, format="json")
    assert resp.status_code == 200
    assert resp.json()["name_en"] == "Renamed"
    assert AuditEvent.objects.filter(
        action="update_item", target_id=str(stock[2].id), result="GRANTED"
    ).exists()


def test_delete_over_clearance_403(api_client: APIClient, stock) -> None:
    _login(api_client, modules=["inventory"], clearance=2)
    resp = api_client.delete(f"/api/inventory/{stock[4].id}")
    assert resp.status_code == 403
    assert InventoryItem.objects.filter(pk=stock[4].id).exists()


def test_delete_success_204_and_audited(api_client: APIClient, stock) -> None:
    _login(api_client, modules=["inventory"], clearance=3)
    target_id = stock[3].id
    resp = api_client.delete(f"/api/inventory/{target_id}")
    assert resp.status_code == 204
    assert not InventoryItem.objects.filter(pk=target_id).exists()
    assert AuditEvent.objects.filter(
        action="delete_item", target_id=str(target_id), result="GRANTED"
    ).exists()


def test_create_requires_module_and_auth(api_client: APIClient, warehouse: Warehouse) -> None:
    assert (
        api_client.post("/api/inventory/", _payload(warehouse, 1), format="json").status_code == 403
    )
    _login(api_client, modules=["dashboard"], clearance=4)  # no 'inventory'
    assert (
        api_client.post("/api/inventory/", _payload(warehouse, 1), format="json").status_code == 403
    )


def test_search_respects_clearance(api_client: APIClient, stock) -> None:
    from modules.inventory.application import services

    role = RoleFactory(code="rs2", modules=["inventory"])
    user = UserFactory(username="searcher", role=role, clearance=2)
    results = services.search(user, "Item")
    levels = {int(r["detail"].split("-")[1].split(" ")[0]) for r in results}
    # Over-clearance items (3, 4) never surface in search results.
    assert max(levels) <= 2
    assert all(r["kind"] == "item" for r in results)


def test_module_summary_counts(api_client: APIClient, stock) -> None:
    from modules.inventory.application import services

    role = RoleFactory(code="rsum4", modules=["inventory"])
    user = UserFactory(username="summary", role=role, clearance=4)
    summary = services.module_summary(user)
    assert summary["key"] == "inventory"
    assert summary["total"] == 4
    assert summary["low_stock"] == 1  # only Item L1 (quantity 5) is below 10
    assert summary["warehouses"] == 1
