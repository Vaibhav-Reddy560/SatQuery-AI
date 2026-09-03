"""
Agent-layer protocols.

The intent detector and the query agent are both defined behind small
protocols so the deterministic Phase-1 implementations can be swapped for
LLM/VLM implementations later without touching callers (orchestrator, API).
"""

from typing import Optional, Protocol

from backend.app.schemas.ai import (
    AgentContext,
    AgentRun,
    IntentResult,
)


class IntentClassifier(Protocol):
    """Turns raw user text into a structured IntentResult."""

    def classify(self, raw_query: str) -> IntentResult:
        ...


class QueryAgent(Protocol):
    """
    Full agent execution: intent -> plan -> tool -> analysis -> explanation.
    Accepts optional workspace context (AOI, centre, imagery) from the
    frontend so a drawn selection can be used instead of query text alone.
    """

    def run(
        self,
        raw_query: str,
        context: Optional[AgentContext] = None,
    ) -> AgentRun:
        ...
