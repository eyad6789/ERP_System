"""AI provider abstraction.

The system is air-gapped by design (BUILD_PLAN §6), so the demo ships a fully
OFFLINE, deterministic provider that phrases answers from data already gathered
(and clearance-filtered) by the service layer — it never invents facts and makes
no network calls. The same `AIProvider` interface accepts an on-prem / self-hosted
LLM (or the Anthropic API) in production by setting ``settings.AI_PROVIDER`` and
implementing ``compose``; the grounding context is passed in RAG-style so the
model only ever sees data the requesting user is cleared to see.
"""

from __future__ import annotations

from typing import Any, Protocol


class AIProvider(Protocol):
    name: str

    def compose(self, question: str, context: dict[str, Any], lang: str) -> str: ...


def _t(lang: str, ar: str, en: str) -> str:
    return ar if lang == "ar" else en


class HeuristicProvider:
    """Offline, deterministic natural-language composer over pre-gathered data."""

    name = "heuristic-offline"

    def compose(self, question: str, context: dict[str, Any], lang: str) -> str:
        intent = context.get("intent", "unknown")
        data = context.get("data", {})
        method = getattr(self, f"_say_{intent}", None)
        if method is None:
            return _t(
                lang,
                "أستطيع الإجابة عن أعداد الأفراد والوثائق والحوادث، الميزانية، التنبيهات، "
                "نشاط التدقيق، أو البحث في النظام. اسألني مثلاً: كم عدد الحوادث المفتوحة؟",
                "I can answer about personnel/document/incident counts, the budget, alerts, "
                "audit activity, or search the system. Try: how many open incidents?",
            )
        return method(data, lang)

    def _say_counts(self, d: dict[str, Any], lang: str) -> str:
        parts = []
        m = d.get("modules", {})
        if "personnel" in m:
            parts.append(
                _t(
                    lang,
                    f"الأفراد: {m['personnel']['total']}",
                    f"personnel: {m['personnel']['total']}",
                )
            )
        if "documents" in m:
            parts.append(
                _t(
                    lang,
                    f"الوثائق: {m['documents']['total']}",
                    f"documents: {m['documents']['total']}",
                )
            )
        if "incidents" in m:
            parts.append(
                _t(
                    lang,
                    f"الحوادث المفتوحة: {m['incidents']['open']}",
                    f"open incidents: {m['incidents']['open']}",
                )
            )
        if "operations" in m:
            parts.append(
                _t(
                    lang,
                    f"المهام: {m['operations']['total']}",
                    f"tasks: {m['operations']['total']}",
                )
            )
        if "gis" in m:
            parts.append(_t(lang, f"المواقع: {m['gis']['total']}", f"sites: {m['gis']['total']}"))
        body = "، ".join(parts) if lang == "ar" else ", ".join(parts)
        return _t(lang, f"حسب صلاحيتك: {body}.", f"Within your clearance — {body}.")

    def _say_budget(self, d: dict[str, Any], lang: str) -> str:
        f = d.get("finance")
        if not f:
            return _t(
                lang, "لا توجد بيانات مالية ضمن صلاحيتك.", "No finance data within your clearance."
            )
        return _t(
            lang,
            f"الميزانية {f['budget_total']}، المصروف {f['spent']}، المتبقي {f['remaining']}، "
            f"وعدد العقود {f['contracts']} (منها {f['under_review']} قيد المراجعة).",
            f"Budget {f['budget_total']}, spent {f['spent']}, remaining {f['remaining']}; "
            f"{f['contracts']} contracts ({f['under_review']} under review).",
        )

    def _say_alerts(self, d: dict[str, Any], lang: str) -> str:
        alerts = d.get("alerts", [])
        if not alerts:
            return _t(lang, "لا توجد تنبيهات نشطة حالياً.", "No active alerts right now.")
        lines = [
            f"• {(a['message_ar'] if lang == 'ar' else a['message_en'])}: {a['count']}"
            for a in alerts
        ]
        head = _t(lang, f"يوجد {len(alerts)} تنبيهات:", f"There are {len(alerts)} alerts:")
        return head + "\n" + "\n".join(lines)

    def _say_audit(self, d: dict[str, Any], lang: str) -> str:
        s = d.get("stats", {})
        return _t(
            lang,
            f"إجمالي أحداث التدقيق {s.get('total', 0)}، منها {s.get('denied', 0)} مرفوضة.",
            f"{s.get('total', 0)} audit events, {s.get('denied', 0)} denied.",
        )

    def _say_search(self, d: dict[str, Any], lang: str) -> str:
        results = d.get("results", [])
        if not results:
            return _t(
                lang,
                "لم أجد نتائج مطابقة ضمن صلاحيتك.",
                "No matching results within your clearance.",
            )
        lines = [
            f"• {(r['label_ar'] if lang == 'ar' else r['label_en'])} ({r['kind']})"
            for r in results[:6]
        ]
        return (
            _t(lang, f"وجدت {len(results)} نتيجة:", f"Found {len(results)} results:")
            + "\n"
            + "\n".join(lines)
        )


class LLMProvider:
    """Production adapter for an on-prem / self-hosted LLM. Not active in the demo.

    Implement ``compose`` to call your internal model endpoint, passing ``context``
    as grounding so the model is constrained to clearance-filtered facts.
    """

    name = "llm"

    def __init__(self, endpoint: str | None = None) -> None:
        self.endpoint = endpoint

    def compose(self, question: str, context: dict[str, Any], lang: str) -> str:
        raise NotImplementedError(
            "Configure an on-prem LLM endpoint and implement LLMProvider.compose (BUILD_PLAN §6)."
        )


def get_provider() -> AIProvider:
    """Return the active provider. Demo default is the offline heuristic provider."""
    return HeuristicProvider()
