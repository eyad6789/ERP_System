from django.urls import path

from .views import DocumentDetailView, DocumentListView, DocumentVersionView

urlpatterns = [
    path("", DocumentListView.as_view(), name="document-list"),
    path("<int:pk>", DocumentDetailView.as_view(), name="document-detail"),
    path("<int:pk>/version", DocumentVersionView.as_view(), name="document-version"),
]
