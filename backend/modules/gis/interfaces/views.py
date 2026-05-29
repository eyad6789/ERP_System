from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasModuleAccess, enforce_object_clearance
from modules.iam.application import public as iam

from ..application import services
from ..infrastructure.models import Site
from .serializers import SiteSerializer


class SiteListView(APIView):
    """Clearance-filtered map. Sites above the viewer's clearance are excluded
    server-side (not merely hidden in the UI)."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "gis"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="gis", result="GRANTED")
        sites = services.visible_sites(request.user)
        return Response(SiteSerializer(sites, many=True).data)


class SiteDetailView(APIView):
    """Site detail. The object-level clearance check (IDOR defense) withholds a
    site whose classification exceeds the viewer's clearance and audits it."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "gis"

    def get(self, request: Request, pk: int) -> Response:
        site = get_object_or_404(Site, pk=pk)
        enforce_object_clearance(request, site, action="view_site")
        return Response(SiteSerializer(site).data)
