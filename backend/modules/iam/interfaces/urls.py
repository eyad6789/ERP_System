from django.urls import path

from .admin_views import (
    AdminRoleDetailView,
    AdminRoleListView,
    AdminUserDetailView,
    AdminUserListView,
)
from .security_views import (
    MfaDisableView,
    MfaSetupView,
    MfaVerifyView,
    PasswordChangeView,
    SessionDetailView,
    SessionListView,
)
from .views import (
    ActivityView,
    AuditListView,
    AuditStatsView,
    LoginView,
    LogoutView,
    MeView,
)

urlpatterns = [
    path("auth/login", LoginView.as_view(), name="login"),
    path("auth/logout", LogoutView.as_view(), name="logout"),
    path("me", MeView.as_view(), name="me"),
    path("audit", AuditListView.as_view(), name="audit-list"),
    path("audit/stats", AuditStatsView.as_view(), name="audit-stats"),
    path("activity", ActivityView.as_view(), name="activity"),
    # Administration suite (sysadmin only)
    path("admin/users", AdminUserListView.as_view(), name="admin-users"),
    path("admin/users/<int:pk>", AdminUserDetailView.as_view(), name="admin-user-detail"),
    path("admin/roles", AdminRoleListView.as_view(), name="admin-roles"),
    path("admin/roles/<int:pk>", AdminRoleDetailView.as_view(), name="admin-role-detail"),
    # Account-security suite
    path("auth/password", PasswordChangeView.as_view(), name="auth-password"),
    path("auth/mfa/setup", MfaSetupView.as_view(), name="auth-mfa-setup"),
    path("auth/mfa/verify", MfaVerifyView.as_view(), name="auth-mfa-verify"),
    path("auth/mfa/disable", MfaDisableView.as_view(), name="auth-mfa-disable"),
    path("auth/sessions", SessionListView.as_view(), name="auth-sessions"),
    path("auth/sessions/<str:key>", SessionDetailView.as_view(), name="auth-session-detail"),
]
