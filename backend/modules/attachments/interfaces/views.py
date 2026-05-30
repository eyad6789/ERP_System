from __future__ import annotations

import json
from typing import cast

from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasModuleAccess, enforce_object_clearance
from modules.iam.application import public as iam
from modules.iam.infrastructure.models import User

from ..application import services
from ..infrastructure.models import Attachment


class AttachmentListView(APIView):
    """Clearance-filtered file list (GET) + multipart upload (POST)."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "files"
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="files", result="GRANTED")
        items = services.visible_attachments(request.user)
        return Response([services.serialize(a) for a in items])

    def post(self, request: Request) -> Response:
        user = cast("User", request.user)
        uploaded = request.FILES.get("file")
        if uploaded is None:
            return Response({"detail": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            classification = int(request.data.get("classification", 1))
        except (TypeError, ValueError):
            classification = 1
        if not iam.can_read_sensitivity(user.clearance, classification):
            return Response(
                {"detail": "Cannot upload above your clearance."},
                status=status.HTTP_403_FORBIDDEN,
            )
        extracted_raw = request.data.get("extracted")
        extracted = {}
        if extracted_raw:
            try:
                extracted = json.loads(extracted_raw)
            except (TypeError, ValueError):
                extracted = {}
        attachment = services.create_attachment(
            user=user,
            uploaded_file=uploaded,
            classification=classification,
            kind=str(request.data.get("kind", "")),
            linked_module=str(request.data.get("linked_module", "")),
            linked_id=str(request.data.get("linked_id", "")),
            extracted=extracted,
        )
        iam.record_audit(
            request, action="upload_file", target=f"Attachment:{attachment.pk}", result="GRANTED"
        )
        return Response(services.serialize(attachment), status=status.HTTP_201_CREATED)


class AttachmentDetailView(APIView):
    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "files"

    def get(self, request: Request, pk: int) -> Response:
        attachment = get_object_or_404(Attachment, pk=pk)
        enforce_object_clearance(request, attachment, action="view_file")
        return Response(services.serialize(attachment))

    def delete(self, request: Request, pk: int) -> Response:
        attachment = get_object_or_404(Attachment, pk=pk)
        enforce_object_clearance(request, attachment, action="view_file")
        iam.record_audit(request, action="delete_file", target=f"Attachment:{pk}", result="GRANTED")
        attachment.file.delete(save=False)
        attachment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AttachmentDownloadView(APIView):
    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "files"

    def get(self, request: Request, pk: int) -> FileResponse | Response:
        attachment = get_object_or_404(Attachment, pk=pk)
        enforce_object_clearance(request, attachment, action="download_file")
        return FileResponse(
            attachment.file.open("rb"), as_attachment=True, filename=attachment.original_name
        )


class AttachmentParseView(APIView):
    """Parse a CSV attachment into columns/rows (server-side, clearance-checked)."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "files"

    def post(self, request: Request, pk: int) -> Response:
        attachment = get_object_or_404(Attachment, pk=pk)
        enforce_object_clearance(request, attachment, action="parse_file")
        name = attachment.original_name.lower()
        if not (name.endswith(".csv") or attachment.content_type == "text/csv"):
            return Response(
                {"detail": "Only CSV files are parsed server-side; XLSX is parsed in the browser."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(services.parse_csv(attachment))
