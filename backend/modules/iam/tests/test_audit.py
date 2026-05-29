"""Gate clause (c): every grant/denial writes a row, and the log is append-only."""

from __future__ import annotations

import pytest
from django.db import connection, transaction
from django.db.utils import InternalError, ProgrammingError

from modules.iam.infrastructure.models import AuditEvent

from .factories import UserFactory

pytestmark = pytest.mark.django_db


def test_save_on_existing_row_is_rejected() -> None:
    actor = UserFactory()
    event = AuditEvent.objects.create(
        actor=actor, actor_label=actor.username, action="login", result="GRANTED"
    )
    event.action = "tampered"
    with pytest.raises(ValueError):
        event.save()


def test_manager_update_and_delete_are_forbidden() -> None:
    actor = UserFactory()
    AuditEvent.objects.create(
        actor=actor, actor_label=actor.username, action="login", result="GRANTED"
    )
    with pytest.raises(NotImplementedError):
        AuditEvent.objects.update(action="x")
    with pytest.raises(NotImplementedError):
        AuditEvent.objects.delete()


def test_db_trigger_blocks_raw_update() -> None:
    """The Postgres trigger blocks even raw SQL mutation (tamper-evidence)."""
    actor = UserFactory()
    event = AuditEvent.objects.create(
        actor=actor, actor_label=actor.username, action="login", result="GRANTED"
    )
    with (
        pytest.raises((InternalError, ProgrammingError)),
        transaction.atomic(),
        connection.cursor() as cursor,
    ):
        cursor.execute("UPDATE iam_audit_event SET action = 'x' WHERE id = %s", [event.id])
