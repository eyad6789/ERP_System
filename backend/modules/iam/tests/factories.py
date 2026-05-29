from __future__ import annotations

import factory

from modules.iam.domain.entities import ClearanceLevel
from modules.iam.infrastructure.models import Role, User


class RoleFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Role
        django_get_or_create = ("code",)

    code = "analyst"
    name_ar = "محلل"
    name_en = "Analyst"
    modules = factory.LazyFunction(lambda: ["dashboard", "documents"])
    clearance = ClearanceLevel.RESTRICTED


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    username = factory.Sequence(lambda n: f"user{n}")
    clearance = ClearanceLevel.RESTRICTED
    department = "Operations"
    role = factory.SubFactory(RoleFactory)

    @factory.post_generation
    def password(obj, create, extracted, **kwargs):  # noqa: N805
        obj.set_password(extracted or "test-pass-12345")
        if create:
            obj.save()
