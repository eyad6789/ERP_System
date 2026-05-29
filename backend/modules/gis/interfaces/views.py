from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasModuleAccess, enforce_object_clearance
from modules.iam.application import public as iam

from ..application import services
from ..infrastructure.models import Site
from .serializers import SiteSerializer, SiteWriteSerializer


def _over_clearance(request: Request, classification: int) -> bool:
    """True when the requested classification exceeds the caller's clearance."""
    return classification > getattr(request.user, "clearance", 0)


class SiteListView(APIView):
    """Clearance-filtered map. Sites above the viewer's clearance are excluded
    server-side (not merely hidden in the UI)."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "gis"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="gis", result="GRANTED")
        sites = services.list_sites(
            request.user,
            q=request.query_params.get("q", ""),
            ordering=request.query_params.get("ordering", ""),
        )
        return Response(SiteSerializer(sites, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = SiteWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if _over_clearance(request, serializer.validated_data["classification"]):
            iam.record_audit(request, action="create_site", target="Site:new", result="DENIED")
            return Response(status=status.HTTP_403_FORBIDDEN)
        site = serializer.save()
        iam.record_audit(request, action="create_site", target=f"Site:{site.pk}", result="GRANTED")
        return Response(SiteSerializer(site).data, status=status.HTTP_201_CREATED)


class SiteDetailView(APIView):
    """Site detail. The object-level clearance check (IDOR defense) withholds a
    site whose classification exceeds the viewer's clearance and audits it."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "gis"

    def get(self, request: Request, pk: int) -> Response:
        site = get_object_or_404(Site, pk=pk)
        enforce_object_clearance(request, site, action="view_site")
        return Response(SiteSerializer(site).data)

    def patch(self, request: Request, pk: int) -> Response:
        site = get_object_or_404(Site, pk=pk)
        enforce_object_clearance(request, site, action="view_site")
        serializer = SiteWriteSerializer(site, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        new_classification = serializer.validated_data.get("classification", site.classification)
        if _over_clearance(request, new_classification):
            iam.record_audit(
                request, action="update_site", target=f"Site:{site.pk}", result="DENIED"
            )
            return Response(status=status.HTTP_403_FORBIDDEN)
        site = serializer.save()
        iam.record_audit(request, action="update_site", target=f"Site:{site.pk}", result="GRANTED")
        return Response(SiteSerializer(site).data)

    def delete(self, request: Request, pk: int) -> Response:
        site = get_object_or_404(Site, pk=pk)
        enforce_object_clearance(request, site, action="view_site")
        pk_value = site.pk
        site.delete()
        iam.record_audit(request, action="delete_site", target=f"Site:{pk_value}", result="GRANTED")
        return Response(status=status.HTTP_204_NO_CONTENT)
