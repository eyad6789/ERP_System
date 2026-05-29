from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import HasModuleAccess, enforce_object_clearance
from modules.iam.application import public as iam

from ..application import services
from ..infrastructure.models import Asset
from .serializers import AssetDetailSerializer, AssetListSerializer


class AssetListView(APIView):
    """Clearance-filtered asset inventory. Assets above the viewer's clearance are
    excluded server-side (not merely hidden in the UI)."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "assets"

    def get(self, request: Request) -> Response:
        iam.record_audit(request, action="open_module", target="assets", result="GRANTED")
        assets = services.visible_assets(request.user)
        return Response(AssetListSerializer(assets, many=True).data)


class AssetDetailView(APIView):
    """Asset detail. The object-level clearance check (IDOR defense) withholds an
    asset whose classification exceeds the viewer's clearance and audits it."""

    permission_classes = [IsAuthenticated, HasModuleAccess]
    required_module = "assets"

    def get(self, request: Request, pk: int) -> Response:
        asset = get_object_or_404(Asset, pk=pk)
        enforce_object_clearance(request, asset, action="view_asset")
        return Response(AssetDetailSerializer(asset).data)
