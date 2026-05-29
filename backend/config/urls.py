"""Root URL configuration."""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health", include("core.health.urls")),
    path("api/", include("modules.iam.interfaces.urls")),
    path("api/", include("core.aggregation.urls")),
    path("api/dashboard/", include("core.dashboard.urls")),
    path("api/personnel/", include("modules.personnel.interfaces.urls")),
    path("api/documents/", include("modules.documents.interfaces.urls")),
    path("api/finance/", include("modules.finance.interfaces.urls")),
    path("api/gis/", include("modules.gis.interfaces.urls")),
    path("api/operations/", include("modules.operations.interfaces.urls")),
    path("api/assets/", include("modules.assets.interfaces.urls")),
    path("api/incidents/", include("modules.incidents.interfaces.urls")),
    path("api/ai/", include("modules.ai.interfaces.urls")),
]
