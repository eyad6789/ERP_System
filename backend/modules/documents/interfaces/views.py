from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasModuleAccess, enforce_object_clearance
from modules.iam.application import public as iam

from ..application import services
from ..infrastructure.models import Document


class DocumentListView(APIView):
    """Classified document list. Over-clearance documents appear but with their
    title/body withheld server-side (locked)."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "documents"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="documents", result="GRANTED")
        return Response(services.list_documents(request.user))


class DocumentDetailView(APIView):
    """Full document read. Denied (403) + audited for over-clearance; the body is
    never serialized in that case. Authorized reads are counted and access-logged."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "documents"

    def get(self, request: Request, pk: int) -> Response:
        document = get_object_or_404(Document, pk=pk)
        # Raises 403 + writes a DENIED audit row when over-clearance (body withheld).
        enforce_object_clearance(request, document, action="view_document")
        services.record_full_read(document)
        return Response(services.serialize_detail(document))
