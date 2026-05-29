"""AI use-cases. All answers are GROUNDED in data the requesting user is cleared
to see (gathered via the cross-module aggregation root), then phrased by the
configured provider. Nothing is fabricated; nothing crosses the clearance line.
"""

from __future__ import annotations

import re
from typing import Any

from core.aggregation import services as aggregation

from .providers import get_provider

# intent -> keyword triggers (English + Arabic)
_INTENTS: list[tuple[str, tuple[str, ...]]] = [
    (
        "budget",
        ("budget", "finance", "money", "spend", "contract", "ميزانية", "مالية", "صرف", "عقد"),
    ),
    ("alerts", ("alert", "risk", "critical", "urgent", "تنبيه", "خطر", "حرج", "عاجل")),
    ("audit", ("audit", "denied", "access", "تدقيق", "مرفوض", "وصول")),
    ("search", ("find", "search", "look up", "ابحث", "جد", "بحث")),
    ("counts", ("how many", "count", "number of", "total", "كم", "عدد", "إجمالي")),
]


def _detect_intent(question: str) -> str:
    q = question.lower()
    for intent, keywords in _INTENTS:
        if any(kw in q for kw in keywords):
            return intent
    return "unknown"


def _search_terms(question: str) -> str:
    q = question
    for kw in ("find", "search for", "search", "look up", "ابحث عن", "ابحث", "بحث", "جد"):
        q = re.sub(kw, " ", q, flags=re.IGNORECASE)
    return q.strip(" ?.،")


def _resolve(user: Any, question: str) -> tuple[str, dict[str, Any]]:
    intent = _detect_intent(question)
    if intent == "search":
        return intent, aggregation.global_search(user, _search_terms(question))
    overview = aggregation.command_overview(user)
    if intent == "counts":
        return intent, {"modules": overview["modules"]}
    if intent == "budget":
        return intent, {"finance": overview["modules"].get("finance")}
    if intent == "alerts":
        return intent, {"alerts": overview["alerts"]}
    if intent == "audit":
        kpis = overview["kpis"]
        return intent, {"stats": {"total": kpis["audit_events_7d"], "denied": kpis["denied_7d"]}}
    return intent, {}


def ask_assistant(user: Any, question: str, lang: str = "en") -> dict[str, Any]:
    intent, data = _resolve(user, question)
    provider = get_provider()
    answer = provider.compose(question, {"intent": intent, "data": data}, lang)
    return {"answer": answer, "intent": intent, "provider": provider.name, "grounding": data}


def briefing(user: Any, lang: str = "en") -> dict[str, Any]:
    """An executive briefing generated from the user's command-center overview."""
    overview = aggregation.command_overview(user)
    m = overview["modules"]
    alerts = overview["alerts"]
    ar = lang == "ar"

    lines: list[str] = []
    if "incidents" in m:
        lines.append(
            f"الحوادث المفتوحة {m['incidents']['open']}."
            if ar
            else f"{m['incidents']['open']} open incidents."
        )
    if "finance" in m:
        f = m["finance"]
        lines.append(
            f"الميزانية {f['budget_total']} بمصروف {f['spent']}."
            if ar
            else f"Budget {f['budget_total']} with {f['spent']} spent."
        )
    if "personnel" in m:
        lines.append(
            f"عدد الأفراد {m['personnel']['total']}."
            if ar
            else f"{m['personnel']['total']} personnel on record."
        )
    crit = [a for a in alerts if a["severity"] == "critical"]
    recommendation = (
        (
            "يُنصح بمعالجة الحوادث الحرجة فوراً."
            if ar
            else "Recommend immediate action on critical incidents."
        )
        if crit
        else ("الوضع التشغيلي مستقر." if ar else "Operational posture is stable.")
    )
    headline = "موجز تنفيذي" if ar else "Executive briefing"
    return {
        "headline": headline,
        "summary": " ".join(lines),
        "alerts": len(alerts),
        "critical": len(crit),
        "recommendation": recommendation,
        "provider": get_provider().name,
    }


def detect_anomalies(user: Any) -> dict[str, Any]:
    """Flag unusual audit patterns (e.g. a spike in denied access) from the user's
    clearance-scoped activity window."""
    overview = aggregation.command_overview(user)
    activity = overview.get("audit_activity", [])
    denials = [int(d.get("denied", 0)) for d in activity]
    anomalies: list[dict[str, Any]] = []
    if denials:
        avg = sum(denials) / len(denials)
        peak = max(denials)
        if peak >= 3 and peak > avg * 2:
            anomalies.append(
                {
                    "type": "denial_spike",
                    "severity": "high",
                    "value": peak,
                    "message_ar": f"ارتفاع غير معتاد في محاولات الوصول المرفوضة ({peak}).",
                    "message_en": f"Unusual spike in denied access attempts ({peak}).",
                }
            )
    return {"anomalies": anomalies, "provider": get_provider().name}


_STOP = {
    "the",
    "a",
    "an",
    "and",
    "or",
    "of",
    "to",
    "in",
    "for",
    "on",
    "is",
    "are",
    "be",
    "this",
    "that",
    "with",
    "by",
    "من",
    "في",
    "على",
    "إلى",
    "و",
    "أو",
    "هذا",
    "هذه",
    "عن",
}


def summarize(text: str, lang: str = "en", max_sentences: int = 3) -> dict[str, Any]:
    """Extractive summary: rank sentences by salient-word frequency, keep the top
    few in original order. Pure + offline; clearance is respected because the
    caller already holds the text they are cleared to read."""
    sentences = [s.strip() for s in re.split(r"(?<=[.!؟?])\s+", text.strip()) if s.strip()]
    if len(sentences) <= max_sentences:
        return {
            "summary": text.strip(),
            "sentences": len(sentences),
            "provider": get_provider().name,
        }

    freq: dict[str, int] = {}
    for word in re.findall(r"\w+", text.lower()):
        if word not in _STOP and len(word) > 2:
            freq[word] = freq.get(word, 0) + 1

    def score(sentence: str) -> int:
        return sum(freq.get(w, 0) for w in re.findall(r"\w+", sentence.lower()))

    ranked = sorted(range(len(sentences)), key=lambda i: score(sentences[i]), reverse=True)
    keep = sorted(ranked[:max_sentences])
    summary = " ".join(sentences[i] for i in keep)
    return {"summary": summary, "sentences": len(keep), "provider": get_provider().name}
