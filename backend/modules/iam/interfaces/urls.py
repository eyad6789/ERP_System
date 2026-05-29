from django.urls import path

from .views import AuditListView, AuditStatsView, LoginView, LogoutView, MeView

urlpatterns = [
    path("auth/login", LoginView.as_view(), name="login"),
    path("auth/logout", LogoutView.as_view(), name="logout"),
    path("me", MeView.as_view(), name="me"),
    path("audit", AuditListView.as_view(), name="audit-list"),
    path("audit/stats", AuditStatsView.as_view(), name="audit-stats"),
]
