from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasModuleAccess, enforce_object_clearance
from modules.iam.application import public as iam

from ..application import services
from ..infrastructure.models import Applicant
from .serializers import (
    ApplicantDetailSerializer,
    ApplicantListSerializer,
    ApplicantWriteSerializer,
)

ORDERING_WHITELIST = frozenset({"name", "position", "stage", "classification"})


class ApplicantListView(APIView):
    """Clearance-filtered applicant directory. Applicants above the viewer's
    clearance are excluded server-side (not merely hidden in the UI). Also creates
    applicants, never above the caller's own clearance."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "recruitment"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="recruitment", result="GRANTED")
        applicants = services.visible_applicants(request.user)

        query = request.query_params.get("q", "").strip()
        if query:
            applicants = services.filter_by_query(applicants, query)

        ordering = request.query_params.get("ordering", "").strip()
        if ordering:
            field = ordering[1:] if ordering.startswith("-") else ordering
            if field in ORDERING_WHITELIST:
                applicants = applicants.order_by(ordering)

        return Response(ApplicantListSerializer(applicants, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = ApplicantWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.enforce_classification_ceiling(
            request, serializer.validated_data["classification"], action="create_applicant"
        )
        applicant = serializer.save()
        iam.record_audit(
            request, action="create_applicant", target=f"Applicant:{applicant.pk}", result="GRANTED"
        )
        return Response(ApplicantDetailSerializer(applicant).data, status=201)


class ApplicantDetailView(APIView):
    """Applicant detail. The object-level clearance check (IDOR defense) withholds
    an applicant whose classification exceeds the viewer's clearance and audits it.
    Also edits and deletes applicants after that same check."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "recruitment"

    def get(self, request: Request, pk: int) -> Response:
        applicant = get_object_or_404(Applicant, pk=pk)
        enforce_object_clearance(request, applicant, action="view_applicant")
        return Response(ApplicantDetailSerializer(applicant).data)

    def patch(self, request: Request, pk: int) -> Response:
        applicant = get_object_or_404(Applicant, pk=pk)
        enforce_object_clearance(request, applicant, action="view_applicant")
        serializer = ApplicantWriteSerializer(applicant, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if "classification" in serializer.validated_data:
            services.enforce_classification_ceiling(
                request,
                serializer.validated_data["classification"],
                action="update_applicant",
            )
        applicant = serializer.save()
        iam.record_audit(
            request, action="update_applicant", target=f"Applicant:{applicant.pk}", result="GRANTED"
        )
        return Response(ApplicantDetailSerializer(applicant).data)

    def delete(self, request: Request, pk: int) -> Response:
        applicant = get_object_or_404(Applicant, pk=pk)
        enforce_object_clearance(request, applicant, action="view_applicant")
        applicant_pk = applicant.pk
        applicant.delete()
        iam.record_audit(
            request, action="delete_applicant", target=f"Applicant:{applicant_pk}", result="GRANTED"
        )
        return Response(status=204)
