from __future__ import annotations

from rest_framework import serializers


class AssistantSerializer(serializers.Serializer):
    question = serializers.CharField(max_length=500)
    lang = serializers.ChoiceField(choices=["ar", "en"], required=False, default="en")


class SummarizeSerializer(serializers.Serializer):
    text = serializers.CharField()
    lang = serializers.ChoiceField(choices=["ar", "en"], required=False, default="en")
