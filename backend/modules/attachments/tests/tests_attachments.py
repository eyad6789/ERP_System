"""Gate: uploaded files are clearance-scoped end to end. The list excludes
over-clearance attachments SERVER-side, download is IDOR-safe (an over-clearance
id returns 403 + a DENIED audit row, never the bytes), and every upload / view /
delete is audited. CSV parsing is clearance-checked before it runs."""

from __future__ import annotations

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from modules.attachments.application import services
from modules.attachments.infrastructure.models import Attachment
from modules.iam.infrastructure.models import AuditEvent, User
from modules.iam.tests.factories import RoleFactory, UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _tmp_media(settings, tmp_path) -> None:
    """Keep uploaded test files out of the repo's MEDIA_ROOT."""
    settings.MEDIA_ROOT = str(tmp_path)


def _make_user(username: str, modules: list[str], clearance: int) -> User:
    role = RoleFactory(code=f"role-{username}", modules=modules)
    return UserFactory(
        username=username, password="test-pass-12345", role=role, clearance=clearance
    )


def _login(api_client: APIClient, username: str, modules: list[str], clearance: int) -> User:
    user = _make_user(username, modules, clearance)
    api_client.post(
        "/api/auth/login",
        {"username": username, "password": "test-pass-12345"},
        format="json",
    )
    return user


def _csv(name: str = "data.csv") -> SimpleUploadedFile:
    body = b"name,amount\nAlpha,10\nBeta,20\n"
    return SimpleUploadedFile(name, body, content_type="text/csv")


def _png(name: str = "scan.png") -> SimpleUploadedFile:
    return SimpleUploadedFile(name, b"\x89PNG\r\n\x1a\n0000", content_type="image/png")


@pytest.fixture
def library() -> dict[int, Attachment]:
    """One attachment at each clearance level, owned by a clr-4 service user."""
    owner = _make_user("librarian", ["files"], 4)
    out: dict[int, Attachment] = {}
    for level in (1, 2, 3, 4):
        out[level] = services.create_attachment(
            user=owner,
            uploaded_file=_csv(f"file-{level}.csv"),
            classification=level,
        )
    return out


# --- access control -------------------------------------------------------


def test_upload_requires_module_and_auth(api_client: APIClient) -> None:
    assert api_client.post("/api/attachments/", {}, format="multipart").status_code == 403
    _login(api_client, "nomod", ["dashboard"], 4)  # no 'files'
    resp = api_client.post(
        "/api/attachments/", {"file": _csv(), "classification": 1}, format="multipart"
    )
    assert resp.status_code == 403


def test_upload_csv_creates_attachment_and_audits(api_client: APIClient) -> None:
    _login(api_client, "u3", ["files"], 3)
    resp = api_client.post(
        "/api/attachments/",
        {"file": _csv(), "classification": 2},
        format="multipart",
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["kind"] == Attachment.Kind.SPREADSHEET
    assert body["original_name"] == "data.csv"
    assert body["download_url"] == f"/api/attachments/{body['id']}/download"
    assert AuditEvent.objects.filter(
        action="upload_file", target_id=str(body["id"]), result="GRANTED"
    ).exists()


def test_upload_above_clearance_403(api_client: APIClient) -> None:
    _login(api_client, "u2", ["files"], 2)
    resp = api_client.post(
        "/api/attachments/",
        {"file": _csv(), "classification": 4},
        format="multipart",
    )
    assert resp.status_code == 403
    assert not Attachment.objects.exists()


def test_list_excludes_over_clearance(api_client: APIClient, library) -> None:
    _login(api_client, "viewer2", ["files"], 2)
    rows = api_client.get("/api/attachments/").json()
    assert {r["classification"] for r in rows} == {1, 2}


# --- download (IDOR defense) ----------------------------------------------


def test_download_over_clearance_denied_and_audited(api_client: APIClient, library) -> None:
    _login(api_client, "viewer2b", ["files"], 2)
    resp = api_client.get(f"/api/attachments/{library[4].id}/download")
    assert resp.status_code == 403
    assert AuditEvent.objects.filter(
        action="download_file", target_id=str(library[4].id), result="DENIED"
    ).exists()


def test_download_authorized_streams_bytes(api_client: APIClient, library) -> None:
    _login(api_client, "viewer3", ["files"], 3)
    resp = api_client.get(f"/api/attachments/{library[3].id}/download")
    assert resp.status_code == 200
    assert b"Alpha" in b"".join(resp.streaming_content)


def test_detail_over_clearance_denied(api_client: APIClient, library) -> None:
    _login(api_client, "viewer2c", ["files"], 2)
    resp = api_client.get(f"/api/attachments/{library[4].id}")
    assert resp.status_code == 403
    assert "original_name" not in resp.json()


# --- CSV parsing ----------------------------------------------------------


def test_parse_csv_returns_columns_and_rows(api_client: APIClient, library) -> None:
    _login(api_client, "parser", ["files"], 3)
    resp = api_client.post(f"/api/attachments/{library[2].id}/parse")
    assert resp.status_code == 200
    body = resp.json()
    assert body["columns"] == ["name", "amount"]
    assert body["total_rows"] == 2
    assert ["Alpha", "10"] in body["rows"]


def test_parse_non_csv_rejected(api_client: APIClient) -> None:
    user = _make_user("imguser", ["files"], 3)
    image = services.create_attachment(user=user, uploaded_file=_png(), classification=2)
    _login(api_client, "imgviewer", ["files"], 3)
    resp = api_client.post(f"/api/attachments/{image.id}/parse")
    assert resp.status_code == 400


def test_parse_over_clearance_denied(api_client: APIClient, library) -> None:
    _login(api_client, "parser2", ["files"], 2)
    resp = api_client.post(f"/api/attachments/{library[4].id}/parse")
    assert resp.status_code == 403


# --- delete ---------------------------------------------------------------


def test_delete_within_clearance_204_and_audited(api_client: APIClient, library) -> None:
    _login(api_client, "deleter3", ["files"], 3)
    target_id = library[3].id
    resp = api_client.delete(f"/api/attachments/{target_id}")
    assert resp.status_code == 204
    assert not Attachment.objects.filter(pk=target_id).exists()
    assert AuditEvent.objects.filter(
        action="delete_file", target_id=str(target_id), result="GRANTED"
    ).exists()


def test_delete_over_clearance_403(api_client: APIClient, library) -> None:
    _login(api_client, "deleter2", ["files"], 2)
    resp = api_client.delete(f"/api/attachments/{library[4].id}")
    assert resp.status_code == 403
    assert Attachment.objects.filter(pk=library[4].id).exists()


# --- summary & search (aggregation contract) ------------------------------


def test_module_summary_excludes_over_clearance(library) -> None:
    user = _make_user("summer", ["files"], 2)
    summary = services.module_summary(user)
    assert summary["key"] == "files"
    assert summary["total"] == 2  # only L1 + L2 visible
    assert {row["kind"] for row in summary["by_kind"]} == set(Attachment.Kind.values)


def test_search_respects_clearance(library) -> None:
    user = _make_user("seeker", ["files"], 2)
    results = services.search(user, "file")
    assert all(r["kind"] == "attachment" for r in results)
    assert all("file-3" not in r["label_en"] and "file-4" not in r["label_en"] for r in results)
