from django.urls import path

from .views import (
    AttachmentDetailView,
    AttachmentDownloadView,
    AttachmentListView,
    AttachmentParseView,
)

urlpatterns = [
    path("", AttachmentListView.as_view(), name="attachment-list"),
    path("<int:pk>", AttachmentDetailView.as_view(), name="attachment-detail"),
    path("<int:pk>/download", AttachmentDownloadView.as_view(), name="attachment-download"),
    path("<int:pk>/parse", AttachmentParseView.as_view(), name="attachment-parse"),
]
