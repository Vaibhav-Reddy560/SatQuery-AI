"""
Query agents: natural-language understanding + orchestration.

Pipeline (see orchestrator.py):

    User Query
        -> Intent Detection
        -> Query Planning
        -> Tool Selection
        -> Analysis Service
        -> Structured Result
        -> NL Explanation

Phase 1 ships a deterministic rule-based intent classifier (modular so an
LLM/VLM implementation can replace it behind the same interface) and an
orchestrator that emits an ``AgentRun`` (trace, plan, result, explanation).
"""

from backend.app.agents.base import IntentClassifier, QueryAgent
from backend.app.agents.intent_detector import DeterministicIntentClassifier, intent_detector
from backend.app.agents.tool_selector import ToolSelector, tool_selector
from backend.app.agents.planner import QueryPlanner, planner
from backend.app.agents.orchestrator import QueryOrchestrator, query_orchestrator

__all__ = [
    "IntentClassifier",
    "QueryAgent",
    "DeterministicIntentClassifier",
    "intent_detector",
    "ToolSelector",
    "tool_selector",
    "QueryPlanner",
    "planner",
    "QueryOrchestrator",
    "query_orchestrator",
]
