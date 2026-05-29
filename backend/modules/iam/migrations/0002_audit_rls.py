"""Tamper-evidence for the audit log: a Postgres trigger that blocks UPDATE and
DELETE at the database level, so append-only holds even against raw SQL.
"""
from django.db import migrations

CREATE = """
CREATE OR REPLACE FUNCTION iam_audit_event_block_mutation()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'iam_audit_event is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_iam_audit_event_append_only ON iam_audit_event;
CREATE TRIGGER trg_iam_audit_event_append_only
    BEFORE UPDATE OR DELETE ON iam_audit_event
    FOR EACH ROW EXECUTE FUNCTION iam_audit_event_block_mutation();
"""

DROP = """
DROP TRIGGER IF EXISTS trg_iam_audit_event_append_only ON iam_audit_event;
DROP FUNCTION IF EXISTS iam_audit_event_block_mutation();
"""


class Migration(migrations.Migration):
    dependencies = [
        ("iam", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(sql=CREATE, reverse_sql=DROP),
    ]
