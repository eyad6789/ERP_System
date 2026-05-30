"""Seed classified compliance items across standards, statuses and clearances. Idempotent."""

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from modules.compliance.infrastructure.models import ComplianceItem

# title_ar, title_en, standard, status, finding, classification
ITEMS = [
    (
        "ضبط الوصول المنطقي إلى الأنظمة السرية",
        "Logical Access Control for Classified Systems",
        "ISO/IEC 27001 A.9",
        ComplianceItem.Status.COMPLIANT,
        "MFA enforced on all privileged accounts; quarterly access reviews completed.",
        4,
    ),
    (
        "تشفير البيانات أثناء النقل والتخزين",
        "Encryption of Data in Transit and at Rest",
        "NIST SP 800-53 SC-13",
        ComplianceItem.Status.COMPLIANT,
        "TLS 1.2+ enforced; database volumes encrypted with rotating keys.",
        3,
    ),
    (
        "استمرارية الأعمال والتعافي من الكوارث",
        "Business Continuity & Disaster Recovery",
        "ISO 22301",
        ComplianceItem.Status.IN_REVIEW,
        "Hot standby provisioned; full failover drill scheduled for next quarter.",
        3,
    ),
    (
        "سجل التدقيق غير القابل للتعديل",
        "Tamper-Evident Audit Logging",
        "NIST SP 800-53 AU-9",
        ComplianceItem.Status.COMPLIANT,
        "Append-only audit trail with DB triggers; verified non-repudiable.",
        4,
    ),
    (
        "حماية البيانات الشخصية للمواطنين",
        "Citizen Personal Data Protection",
        "National Data Protection Directive",
        ComplianceItem.Status.NON_COMPLIANT,
        "Retention schedule not yet applied to two legacy datasets; remediation owner assigned.",
        2,
    ),
    (
        "إدارة الثغرات والترقيع الأمني",
        "Vulnerability & Patch Management",
        "ISO/IEC 27001 A.12.6",
        ComplianceItem.Status.IN_REVIEW,
        "Monthly scans running; 4 medium findings pending the next maintenance window.",
        2,
    ),
    (
        "فصل الواجبات في العمليات المالية",
        "Segregation of Duties in Financial Operations",
        "SOC 2 CC6",
        ComplianceItem.Status.COMPLIANT,
        "Maker-checker enforced on all disbursements above threshold.",
        2,
    ),
    (
        "تصنيف ومعالجة الوثائق الحساسة",
        "Classification & Handling of Sensitive Documents",
        "Government Security Manual §4",
        ComplianceItem.Status.COMPLIANT,
        "Clearance-based access enforced server-side; over-clearance reads withheld.",
        3,
    ),
    (
        "أمن سلسلة التوريد والموردين",
        "Supply Chain & Vendor Security",
        "ISO/IEC 27036",
        ComplianceItem.Status.NON_COMPLIANT,
        "Two suppliers lack signed security addenda; procurement notified.",
        1,
    ),
    (
        "التوعية والتدريب الأمني للموظفين",
        "Staff Security Awareness & Training",
        "ISO/IEC 27001 A.7.2",
        ComplianceItem.Status.IN_REVIEW,
        "Annual training at 82% completion; reminders sent to remaining staff.",
        1,
    ),
]


class Command(BaseCommand):
    help = "Seed classified compliance items across standards and statuses."

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        created = 0
        for title_ar, title_en, standard, status, finding, clazz in ITEMS:
            _, made = ComplianceItem.objects.update_or_create(
                title_en=title_en,
                defaults={
                    "title_ar": title_ar,
                    "standard": standard,
                    "status": status,
                    "finding": finding,
                    "classification": clazz,
                },
            )
            created += int(made)

        msg = f"Seeded {len(ITEMS)} compliance items ({created} new)."
        self.stdout.write(self.style.SUCCESS(msg))
