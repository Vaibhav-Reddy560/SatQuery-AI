"""
Small manual benchmark for the intent classification pipeline
(regex classifier + LLM fallback).

Not a formal eval harness — just a quick, repeatable way to get a real
number for the demo: how many queries the fast regex path handles
confidently vs. how many need to escalate to the LLM.

Run with: python -m backend.app.agents.benchmark_intent
"""

from backend.app.agents.intent_detector import intent_detector
from backend.app.schemas.ai import IntentType

CONFIDENCE_ESCALATION_THRESHOLD = 0.6

# A mix of clear-keyword queries and vague/naturally-phrased ones,
# meant to reflect how a real non-expert user might actually type.
TEST_QUERIES = [
    # Clear keyword matches (should stay on the fast regex path)
    "Find buildings in Bengaluru",
    "Detect ships near Mumbai port",
    "Classify the land cover in Punjab",
    "What changed between 2024 and 2026?",
    "How large is this lake?",
    "How far is the coast from here?",
    "Find water bodies near Chennai",
    "Analyze vegetation in this area",
    "Show me solar farms in Rajasthan",
    "Measure the perimeter of this region",

    # Vague / naturally-phrased (expected to need the LLM fallback)
    "Is there any greenery being cut down near the hills?",
    "Tell me what's happening around the coast lately",
    "What's going on with the trees over there",
    "Has this place changed much recently?",
    "Are there a lot of ships around here?",
    "What does this place look like from above?",
    "Any flooding I should know about here?",
    "How's the farmland doing this season?",
    "Is this area mostly urban or rural?",
    "Anything unusual happening near this river?",
]


def run_benchmark():
    regex_confident = 0
    escalated = 0
    unknown_after_regex = 0

    print(f"{'Query':<55} {'Intent':<25} {'Conf':<6} {'Escalate?'}")
    print("-" * 100)

    for query in TEST_QUERIES:
        result = intent_detector.classify(query)
        needs_escalation = (
            result.intent == IntentType.unknown or result.confidence < CONFIDENCE_ESCALATION_THRESHOLD
        )

        if result.intent == IntentType.unknown:
            unknown_after_regex += 1
        if needs_escalation:
            escalated += 1
        else:
            regex_confident += 1

        print(
            f"{query:<55} {result.intent.value:<25} {result.confidence:<6.2f} "
            f"{'YES' if needs_escalation else 'no'}"
        )

    total = len(TEST_QUERIES)
    print("-" * 100)
    print(f"\nTotal queries tested: {total}")
    print(f"Handled confidently by regex alone: {regex_confident} ({regex_confident/total*100:.0f}%)")
    print(f"Escalated to LLM fallback: {escalated} ({escalated/total*100:.0f}%)")
    print(f"  (of which, regex returned 'unknown': {unknown_after_regex})")


if __name__ == "__main__":
    run_benchmark()