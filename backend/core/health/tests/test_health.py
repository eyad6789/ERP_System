from __future__ import annotations

from rest_framework.test import APIClient


def test_health_returns_ok() -> None:
    client = APIClient()
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
