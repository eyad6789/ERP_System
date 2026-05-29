"""Public interface of the AI module."""

from __future__ import annotations

from .services import ask_assistant, briefing, detect_anomalies, summarize

__all__ = ["ask_assistant", "briefing", "detect_anomalies", "summarize"]
