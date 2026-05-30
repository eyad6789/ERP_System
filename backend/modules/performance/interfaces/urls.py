from django.urls import path

from .views import PerformanceReviewDetailView, PerformanceReviewListView

urlpatterns = [
    path("", PerformanceReviewListView.as_view(), name="performance-review-list"),
    path("<int:pk>", PerformanceReviewDetailView.as_view(), name="performance-review-detail"),
]
