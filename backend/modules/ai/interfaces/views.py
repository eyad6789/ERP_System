from __future__ import annotations

from typing import cast

from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from core.db.rls import set_rls_context
from modules.iam.application import public as iam
from modules.iam.infrastructure.models import User

from ..application import public as ai
from .serializers import AssistantSerializer, SummarizeSerializer


def _ctx(request: Request) -> User:
    user = cast("User", request.user)
    set_rls_context(user.clearance, user.department)
    return user


class AssistantView(APIView):
    """Grounded, clearance-scoped AI assistant. Every query is audited."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        user = _ctx(request)
        serializer = AssistantSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        question = serializer.validated_data["question"]
        lang = serializer.validated_data["lang"]
        iam.record_audit(request, action="ai_query", target=f"q:{question[:48]}", result="GRANTED")
        return Response(ai.ask_assistant(user, question, lang))


class BriefingView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        user = _ctx(request)
        lang = request.query_params.get("lang", "en")
        iam.record_audit(request, action="ai_briefing", target="overview", result="GRANTED")
        return Response(ai.briefing(user, lang))


class AnomaliesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        user = _ctx(request)
        return Response(ai.detect_anomalies(user))


class SummarizeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        _ctx(request)
        serializer = SummarizeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        iam.record_audit(request, action="ai_summarize", target="text", result="GRANTED")
        return Response(
            ai.summarize(serializer.validated_data["text"], serializer.validated_data["lang"])
        )
