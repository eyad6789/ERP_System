"""Root URL configuration."""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health", include("core.health.urls")),
    path("api/", include("modules.iam.interfaces.urls")),
]
