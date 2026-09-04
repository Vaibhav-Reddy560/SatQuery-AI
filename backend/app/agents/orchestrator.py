"""
Query orchestrator.

Full Phase 1 pipeline:

    User Query
        -> Intent Detection
        -> Query Planning
        -> Tool Selection
        -> Analysis Service (deterministic mock OR real satellite pipeline)
        -> Structured Result
        -> NL Explanation

Returns an ``AgentRun`` carrying everything the frontend AgentTrace needs:
intent, confidence, plan, selected tool, result, explanation and a step
trace. Services stamp their results with an honest ``mode``: ``mock`` for
the deterministic demo backends (object/land-cover/change/measurement) and
``live`` for the real satellite pipelines (NDVI vegetation and NDWI water,
Sentinel-2 imagery). The trace reflects whichever mode actually ran.
"""

import re
import time
from typing import List, Optional

from backend.app.agents.llm_fallback import classify_with_llm
from backend.app.agents.base import QueryAgent  # noqa: F401
from backend.app.agents.intent_detector import intent_detector
from backend.app.agents.planner import planner
from backend.app.agents.tool_selector import tool_selector
from backend.app.analysis.base import AnalysisServiceError
from backend.app.analysis.registry import analysis_service_registry
from backend.app.schemas.ai import (
    AgentContext,
    AgentRun,
    AnalysisRequest,
    AnalysisResult,
    IntentType,
    ToolSelection,
)

# Intents the agent answers directly (no analysis service).
_ANSWERED_WITHOUT_TOOL = (
    IntentType.general_satellite_question,
    IntentType.unknown,
)

_EXAMPLE_TASKS = (
    "detecting objects (buildings, ships, vehicles)",
    "finding water bodies",
    "land-cover classification",
    "change detection between two dates",
    "vegetation analysis",
    "measuring area or distance",
)
# Below this, even the LLM fallback's own best guess is too uncertain to
# act on — better to ask the user than confidently run the wrong analysis.
CLARIFICATION_THRESHOLD = 0.5

_CLARIFICATION_EXAMPLES = (
    "\"find water bodies near Mumbai\"",
    "\"what changed here since 2024?\"",
    "\"classify land cover in Punjab\"",
    "\"detect ships near this port\"",
)


class QueryOrchestrator:
    """Executes the full agent pipeline for one user query."""

    def run(
        self,
        raw_query: str,
        context: Optional[AgentContext] = None,
    ) -> AgentRun:
        start = time.perf_counter()
        trace: List[str] = ["Received query"]

        # 1. Intent detection
        intent_result = intent_detector.classify(raw_query)
        trace.append(
            f"Detected intent: {intent_result.intent.value} "
            f"(confidence {intent_result.confidence:.2f})"
        )
        # 1b. LLM fallback for low-confidence / unknown regex results.
        # The regex classifier is intentionally deterministic and fast;
        # this escalates to a real LLM only when it's genuinely unsure,
        # per the "later phase can add an LLM/VLM implementation" note
        # in intent_detector.py's docstring.
        if intent_result.intent == IntentType.unknown or intent_result.confidence < 0.6:
            try:
                llm_result = classify_with_llm(raw_query)
                trace.append(
                    f"Escalated to LLM fallback: {llm_result.intent.value} "
                    f"(confidence {llm_result.confidence:.2f})"
                )
                intent_result = llm_result
            except Exception as exc:
                trace.append(f"LLM fallback unavailable, keeping regex result: {exc}")
                # 1c. Clarification safety net: if even the LLM's best guess is
        # still too uncertain to act on, ask the user instead of silently
        # picking a tool that's probably wrong.
        if intent_result.intent == IntentType.unknown and intent_result.confidence < CLARIFICATION_THRESHOLD:
            trace.append("Confidence too low even after LLM fallback — asking for clarification")
            latency_ms = round((time.perf_counter() - start) * 1000.0, 2)
            return AgentRun(
                query=raw_query,
                intent=intent_result.intent,
                intent_confidence=intent_result.confidence,
                entities=intent_result.entities,
                reasoning=intent_result.reasoning,
                plan=None,
                selected_tool=None,
                result=None,
                explanation=(
                    "I'm not confident I understood what you're asking for. Could you "
                    "rephrase, or try something like " + ", ".join(_CLARIFICATION_EXAMPLES) + "?"
                ),
                trace=trace,
                latency_ms=latency_ms,
            )

        # 2. Tool selection
        selection: Optional[ToolSelection] = tool_selector.select(intent_result)

        # 3. Query planning -> AnalysisRequest
        plan: Optional[AnalysisRequest] = planner.plan(
            raw_query=raw_query,
            intent_result=intent_result,
            tool_selection=selection,
            context=context,
        )
        if selection is not None and plan is not None:
            trace.append(f"Selected tool: {selection.tool_id}")

        # 4. Run the analysis service for actionable intents.
        result: Optional[AnalysisResult] = None
        explanation: str = ""

        if intent_result.intent in _ANSWERED_WITHOUT_TOOL or selection is None:
            trace.append("No dedicated tool needed — answering directly")
            explanation = self._non_analysis_explanation(raw_query, intent_result.intent)
        else:
            try:
                service = analysis_service_registry.get(selection.tool_id)
                trace.append(f"Executing analysis service: {service.tool_id}")
                result = service.analyze(plan)
                if result.mode == "mock":
                    trace.append("Executed analysis (deterministic mock model backend)")
                elif getattr(result, "model_kind", None) == "vlm":
                    trace.append(
                        "Executed analysis (live vision-language model: SmolVLM "
                        "on real Sentinel-2 RGB pixels, no simulation)"
                    )
                elif getattr(result, "model_kind", None) == "ml":
                    trace.append(
                        "Executed analysis (live ML pipeline: trained classifier "
                        "on real satellite imagery, no simulation)"
                    )
                elif (
                    result.kind == "change"
                    and getattr(result, "change_method", None) == "delta_ndvi"
                ):
                    trace.append(
                        "Executed analysis (live change-detection algorithm on "
                        "two real Sentinel-2 observations, no simulation)"
                    )
                else:
                    trace.append(
                        f"Executed analysis ({result.mode} pipeline: real "
                        "satellite imagery, no simulation)"
                    )
                trace.append("Generated structured result")
                explanation = result.summary_text
            except AnalysisServiceError as exc:
                trace.append(f"Analysis failed ({exc.code}): {exc.user_message}")
                explanation = (
                    f"I couldn't complete that analysis: {exc.user_message}"
                )
            except Exception as exc:  # noqa: BLE001 - surface as a clear agent message
                trace.append(f"Analysis failed: {exc}")
                explanation = (
                    "I ran into an error while analysing that request. "
                    "Please try rephrasing it."
                )

        latency_ms = round((time.perf_counter() - start) * 1000.0, 2)

        return AgentRun(
            query=raw_query,
            intent=intent_result.intent,
            intent_confidence=intent_result.confidence,
            entities=intent_result.entities,
            reasoning=intent_result.reasoning,
            plan=plan,
            selected_tool=selection,
            result=result,
            explanation=explanation,
            trace=trace,
            latency_ms=latency_ms,
        )

    @staticmethod
    def _educational_answer(raw_query: str) -> Optional[str]:
        """
        Static, honest explainer for conceptual questions ("What is NDVI?",
        "Explain what Sentinel-2 is."). Returns None when the query is not a
        known concept so the caller keeps its generic reply. Facts here are
        real textbook definitions — no analysis is run and no numbers are
        invented.
        """
        text = raw_query.lower()
        if re.search(r"\bndvi\b", text):
            return (
                "NDVI (Normalized Difference Vegetation Index) is a radiometric "
                "index measuring vegetation vigour from satellite reflectance: "
                "NDVI = (NIR − RED) / (NIR + RED), where RED is Sentinel-2 B04 and "
                "NIR is B08. Values range from −1 to +1; dense healthy vegetation "
                "is strongly positive (~0.6–0.9), bare soil/urban near zero, and "
                "water negative. SatQuery computes NDVI from real Sentinel-2 L2A "
                "reflectance — say \"what is the NDVI of this scene?\" to run it."
            )
        if re.search(r"\bndwi\b", text):
            return (
                "NDWI (Normalized Difference Water Index) highlights open water: "
                "NDWI = (GREEN − NIR) / (GREEN + NIR), using Sentinel-2 B03 "
                "(GREEN) and B08 (NIR). Water surfaces are strongly positive; "
                "soil and dry vegetation are negative. SatQuery classifies "
                "pixels with NDWI >= 0 as water on real Sentinel-2 imagery — "
                "say \"find water around Delhi\" to run it."
            )
        if re.search(r"\bsentinel[- ]?2\b", text) or re.search(r"\bsentinel\b", text):
            return (
                "Sentinel-2 is a pair of Earth-observation satellites (2A/2B/2C) "
                "run by the European Space Agency under Copernicus. Its MSI "
                "instrument images the land in 13 spectral bands at 10–60 m "
                "resolution every ~5 days; the L2A product used here provides "
                "atmospherically corrected surface reflectance (free, open "
                "data). SatQuery analyses real Sentinel-2 scenes — say \"what "
                "is the NDVI of this scene?\" or \"find water around Delhi\"."
            )
        if re.search(r"\bremote\s+sensing\b|\bsatellite\s+imagery\b|\bsatellite\b", text):
            return (
                "Remote sensing is measuring the Earth's surface from space "
                "using sensors on satellites — optical (reflected sunlight, e.g. "
                "Sentinel-2), SAR (radar, e.g. Sentinel-1) or thermal. SatQuery "
                "uses real Sentinel-2 reflectance to compute vegetation (NDVI), "
                "water (NDWI), land cover and change. Ask for a concrete "
                "analysis such as \"what is the NDVI of this scene?\"."
            )
        if re.search(r"\bland\s*cover\b", text):
            return (
                "Land cover is the physical surface type observed from space — "
                "water, vegetation/cropland, built-up, bare soil and so on. "
                "SatQuery classifies land cover from real Sentinel-2 reflectance "
                "with a trained RandomForest model — say \"classify the land "
                "cover here\" to run it."
            )
        return None

    @classmethod
    def _non_analysis_explanation(cls, raw_query: str, intent: IntentType) -> str:
        if intent == IntentType.unknown:
            return (
                "I couldn't map that to a satellite-analysis task. I can help with "
                + ", ".join(_EXAMPLE_TASKS)
                + ". Try rephrasing, e.g. \"find water bodies near Mumbai\"."
            )
        answer = cls._educational_answer(raw_query)
        if answer:
            return answer
        return (
            "I understood your question about the selected area. For a concrete "
            "analysis, ask me to do one of: "
            + ", ".join(_EXAMPLE_TASKS)
            + ". (This response is generated by the deterministic mock agent; "
            "no real analysis was run.)"
        )


# Canonical singleton used by the API layer.
query_orchestrator = QueryOrchestrator()
