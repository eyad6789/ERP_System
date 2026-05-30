from django.urls import path

from .views import AttendanceRecordDetailView, AttendanceRecordListView

urlpatterns = [
    path("", AttendanceRecordListView.as_view(), name="attendance-list"),
    path("<int:pk>", AttendanceRecordDetailView.as_view(), name="attendance-detail"),
]
