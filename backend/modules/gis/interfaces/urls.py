from django.urls import path

from .views import SiteDetailView, SiteListView

urlpatterns = [
    path("sites", SiteListView.as_view(), name="site-list"),
    path("sites/<int:pk>", SiteDetailView.as_view(), name="site-detail"),
]
