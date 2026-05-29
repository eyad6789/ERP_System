"""PostgreSQL Row-Level Security helpers.

RLS is defense-in-depth *behind* the application-layer object checks. On each
authenticated request we set session GUCs that RLS policies read:

    SET LOCAL app.current_clearance = <int>;
    SET LOCAL app.current_department = '<str>';

Policies on classified tables then use:

    USING (classification <= current_setting('app.current_clearance')::int)

The app DB role must be NON-superuser and NOT have BYPASSRLS for policies to apply.
"""

from __future__ import annotations

from django.db import connection


def set_rls_context(clearance: int, department: str = "") -> None:
    """Apply the current user's clearance/department to the DB session.

    Uses parameterized SET LOCAL via set_config so it is injection-safe.
    """
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT set_config('app.current_clearance', %s, true)",
            [str(int(clearance))],
        )
        cursor.execute(
            "SELECT set_config('app.current_department', %s, true)",
            [department or ""],
        )
