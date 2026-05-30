from django.urls import path

from .views import MeetingDetailView, MeetingListView

urlpatterns = [
    path("", MeetingListView.as_view(), name="meeting-list"),
    path("<int:pk>", MeetingDetailView.as_view(), name="meeting-detail"),
]
