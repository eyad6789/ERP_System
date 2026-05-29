"""Phase 11: the AI assistant is grounded in clearance-scoped data, audited, and
never returns data the user cannot see."""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from modules.iam.infrastructure.models import AuditEvent
from modules.iam.tests.factories import RoleFactory, UserFactory
from modules.incidents.infrastructure.models import Incident
from modules.personnel.infrastructure.models import Person

pytestmark = pytest.mark.django_db

ALL = [
    "dashboard",
    "personnel",
    "documents",
    "finance",
    "operations",
    "assets",
    "gis",
    "incidents",
    "audit",
]


def _login(api_client: APIClient, modules: list[str], clearance: int = 4) -> None:
    role = RoleFactory(code="r", modules=modules)
    UserFactory(username="u", password="test-pass-12345", role=role, clearance=clearance)
    api_client.post(
        "/api/auth/login", {"username": "u", "password": "test-pass-12345"}, format="json"
    )


def test_assistant_requires_auth(api_client: APIClient) -> None:
    assert (
        api_client.post("/api/ai/assistant", {"question": "hi"}, format="json").status_code == 403
    )


def test_assistant_answers_counts_and_audits(api_client: APIClient) -> None:
    Person.objects.create(name_ar="ع", name_en="P", classification=1)
    _login(api_client, ALL, 4)
    resp = api_client.post(
        "/api/ai/assistant", {"question": "how many personnel?", "lang": "en"}, format="json"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["intent"] == "counts" and "personnel: 1" in body["answer"]
    assert body["provider"] == "heuristic-offline"
    assert AuditEvent.objects.filter(action="ai_query", result="GRANTED").exists()


def test_assistant_search_respects_clearance(api_client: APIClient) -> None:
    Person.objects.create(name_ar="س", name_en="Top Secret Agent", classification=4)
    _login(api_client, ALL, 2)  # clearance 2 cannot see the clearance-4 person
    body = api_client.post("/api/ai/assistant", {"question": "find Agent"}, format="json").json()
    assert body["intent"] == "search"
    assert all("Agent" not in r["label_en"] for r in body["grounding"].get("results", []))


def test_briefing_and_anomalies(api_client: APIClient) -> None:
    Incident.objects.create(
        title_ar="ح", title_en="Breach", severity="critical", status="open", classification=1
    )
    _login(api_client, ALL, 4)
    briefing = api_client.get("/api/ai/briefing").json()
    assert "summary" in briefing and "recommendation" in briefing
    assert api_client.get("/api/ai/anomalies").status_code == 200


def test_summarize_extracts(api_client: APIClient) -> None:
    _login(api_client, ALL, 4)
    text = (
        "Alpha unit secured the perimeter. Logistics resupplied the base. "
        "Alpha unit reported all clear. Command acknowledged the report."
    )
    resp = api_client.post("/api/ai/summarize", {"text": text}, format="json")
    body = resp.json()
    assert body["sentences"] <= 3 and len(body["summary"]) > 0
