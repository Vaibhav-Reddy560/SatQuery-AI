"""
Query planner: query + detected intent + workspace context -> AnalysisRequest.

The planner is where AOI context is merged. The frontend's map drawing tools
produce GeoJSON geometry; this module accepts that geometry (as
``AgentContext.aoi_geometry``) so a drawn selection can drive the analysis
instead of just query text. Every context field is optional, so a bare text
query still plans correctly.

Sentinel defaults from the existing API ("Selected Region", the India
centre) are treated as "not provided" so a real location/centre extracted
from the query text or supplied by the frontend wins.
"""

from typing import Dict, Optional

from backend.app.agents.base import IntentClassifier  # noqa: F401
from backend.app.core.gazetteer import lookup as gazetteer_lookup
from backend.app.schemas.ai import (
    AgentContext,
    AnalysisRequest,
    DateRange,
    IntentResult,
    IntentType,
    ToolSelection,
)

# Defaults matched by the existing API schema (kept for back-compat).
DEFAULT_CENTRE = [78.9629, 20.5937]
_DEFAULT_LOCATION_NAMES = {
    "selected region",
    "selected aoi",
    "selected area of interest",
    "target area",
    "aoi region",
    "regional aoi",
    "selected area",
}


class QueryPlanner:
    """Builds the AnalysisRequest (the plan) for an actionable intent."""

    def plan(
        self,
        raw_query: str,
        intent_result: IntentResult,
        tool_selection: Optional[ToolSelection],
        context: Optional[AgentContext] = None,
    ) -> Optional[AnalysisRequest]:
        if tool_selection is None:
            return None

        ctx = context or AgentContext()
        entities = intent_result.entities

        # Location: prefer explicit request context; fall back to the entity
        # extracted from the text; ignore "no location" sentinels.
        location: Optional[str] = ctx.location_name
        if location is None or location.strip().lower() in _DEFAULT_LOCATION_NAMES:
            entity_location = entities.get("location")
            location = str(entity_location) if entity_location else None

        # Centre: an explicit context centre (map position / drawn AOI) always
        # wins. Otherwise resolve a text location deterministically through the
        # local gazetteer so an explicit place never silently analyses the
        # default scene under the wrong label. Locations unknown to the
        # gazetteer keep the default centre; the imagery layer refuses them
        # (NoAoiProvided) instead of analysing the wrong scene.
        centre = [float(v) for v in ctx.centre] if ctx.centre else None
        if centre is None:
            resolved = gazetteer_lookup(location)
            centre = [float(v) for v in resolved] if resolved else DEFAULT_CENTRE

        # Date range: entity years (e.g. "between 2024 and 2026") or the
        # context window supplied by the API.
        date_range = self._date_range(entities, ctx)

        # Merge selector parameters with anything else the context carries.
        parameters: Dict[str, object] = dict(tool_selection.parameters)

        return AnalysisRequest(
            query=raw_query,
            intent=intent_result.intent,
            tool_id=tool_selection.tool_id,
            location=location,
            centre=centre,
            aoi_geometry=ctx.aoi_geometry,
            date_range=date_range,
            image_ids=list(ctx.image_ids),
            thresholds={},
            parameters=parameters,
        )

    @staticmethod
    def _date_range(entities: Dict[str, object], ctx: AgentContext) -> Optional[DateRange]:
        # Explicit API context dates win when present.
        if ctx.from_date or ctx.to_date:
            return DateRange(from_date=ctx.from_date, to_date=ctx.to_date)

        from_year = entities.get("from_year")
        to_year = entities.get("to_year")
        if isinstance(from_year, str) and from_year:
            return DateRange(
                from_date=f"{from_year}-01-01",
                to_date=f"{to_year}-01-01" if isinstance(to_year, str) and to_year else None,
            )
        return None


planner = QueryPlanner()
