from django.urls import path

from .views import IncidentDetailView, IncidentListView, IncidentStatusView

urlpatterns = [
    path("", IncidentListView.as_view(), name="incident-list"),
    path("<int:pk>", IncidentDetailView.as_view(), name="incident-detail"),
    path("<int:pk>/status", IncidentStatusView.as_view(), name="incident-status"),
]
