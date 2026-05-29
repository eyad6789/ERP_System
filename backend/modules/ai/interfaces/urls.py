from django.urls import path

from .views import AnomaliesView, AssistantView, BriefingView, SummarizeView

urlpatterns = [
    path("assistant", AssistantView.as_view(), name="ai-assistant"),
    path("briefing", BriefingView.as_view(), name="ai-briefing"),
    path("anomalies", AnomaliesView.as_view(), name="ai-anomalies"),
    path("summarize", SummarizeView.as_view(), name="ai-summarize"),
]
