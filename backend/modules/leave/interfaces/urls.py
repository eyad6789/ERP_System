from django.urls import path

from .views import LeaveRequestDetailView, LeaveRequestListView, LeaveStatusView

urlpatterns = [
    path("", LeaveRequestListView.as_view(), name="leave-list"),
    path("<int:pk>", LeaveRequestDetailView.as_view(), name="leave-detail"),
    path("<int:pk>/status", LeaveStatusView.as_view(), name="leave-status"),
]
