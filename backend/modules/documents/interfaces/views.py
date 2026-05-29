from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasModuleAccess, enforce_object_clearance
from modules.iam.application import public as iam

from ..application import services
from ..infrastructure.models import Document
from .serializers import DocumentWriteSerializer


def _reject_over_clearance(request: Request, classification: int) -> None:
    """Raise 403 if the caller tries to set a classification above their clearance."""
    user_clearance = getattr(request.user, "clearance", 0)
    if classification > user_clearance:
        raise PermissionDenied("Cannot set a classification above your clearance.")


class DocumentListView(APIView):
    """Classified document list. Over-clearance documents appear but with their
    title/body withheld server-side (locked). POST creates a new document."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "documents"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="documents", result="GRANTED")
        query = request.query_params.get("q", "")
        ordering = request.query_params.get("ordering", "")
        return Response(services.list_documents(request.user, query=query, ordering=ordering))

    def post(self, request: Request) -> Response:
        serializer = DocumentWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        # A caller may never create a row above their own clearance.
        _reject_over_clearance(request, data["classification"])
        document = services.create_document(request.user, data)
        iam.record_audit(
            request,
            action="create_document",
            target=f"Document:{document.pk}",
            result="GRANTED",
        )
        return Response(services.serialize_detail(document), status=status.HTTP_201_CREATED)


class DocumentDetailView(APIView):
    """Full document read/update/delete. Denied (403) + audited for over-clearance;
    the body is never serialized in that case. Authorized reads are access-logged."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "documents"

    def get(self, request: Request, pk: int) -> Response:
        document = get_object_or_404(Document, pk=pk)
        # Raises 403 + writes a DENIED audit row when over-clearance (body withheld).
        enforce_object_clearance(request, document, action="view_document")
        services.record_full_read(document)
        return Response(services.serialize_detail(document))

    def patch(self, request: Request, pk: int) -> Response:
        document = get_object_or_404(Document, pk=pk)
        # Object-clearance gate first: over-clearance rows are 403 + DENIED-audited.
        enforce_object_clearance(request, document, action="view_document")
        serializer = DocumentWriteSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if "classification" in data:
            _reject_over_clearance(request, data["classification"])
        document = services.update_document(document, data)
        iam.record_audit(
            request,
            action="update_document",
            target=f"Document:{document.pk}",
            result="GRANTED",
        )
        return Response(services.serialize_detail(document))

    def delete(self, request: Request, pk: int) -> Response:
        document = get_object_or_404(Document, pk=pk)
        enforce_object_clearance(request, document, action="view_document")
        pk_value = document.pk
        document.delete()
        iam.record_audit(
            request,
            action="delete_document",
            target=f"Document:{pk_value}",
            result="GRANTED",
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class DocumentVersionView(APIView):
    """Append a new version to a document (bumps version, snapshots a DocumentVersion)."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "documents"

    def post(self, request: Request, pk: int) -> Response:
        document = get_object_or_404(Document, pk=pk)
        enforce_object_clearance(request, document, action="view_document")
        document = services.add_version(request.user, document)
        iam.record_audit(
            request,
            action="add_document_version",
            target=f"Document:{document.pk}",
            result="GRANTED",
        )
        return Response(services.serialize_detail(document), status=status.HTTP_201_CREATED)
