from django.urls import path

from .views import RiskDetailView, RiskListView

urlpatterns = [
    path("", RiskListView.as_view(), name="risk-list"),
    path("<int:pk>", RiskDetailView.as_view(), name="risk-detail"),
]
