from django.urls import path

from .views import AuditListView, LoginView, LogoutView, MeView

urlpatterns = [
    path("auth/login", LoginView.as_view(), name="login"),
    path("auth/logout", LogoutView.as_view(), name="logout"),
    path("me", MeView.as_view(), name="me"),
    path("audit", AuditListView.as_view(), name="audit-list"),
]
