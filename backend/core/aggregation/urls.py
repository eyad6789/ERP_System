from django.urls import path

from .views import AlertsView, OverviewView, SearchView

urlpatterns = [
    path("dashboard/overview", OverviewView.as_view(), name="dashboard-overview"),
    path("alerts", AlertsView.as_view(), name="alerts"),
    path("search", SearchView.as_view(), name="search"),
]
