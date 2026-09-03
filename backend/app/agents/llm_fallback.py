"""
LLM Fallback — used when the regex-based intent_classifier isn't confident
enough about a query. Calls Groq's fast LLM API to do real language-based
intent classification instead of keyword matching.

This is intentionally a FALLBACK, not the primary path:
  - Regex classification is instant, free, and works offline.
  - The LLM call adds latency and costs API quota, so it should only
    fire when the cheap path is unsure.
"""

import os
import json
from typing import Dict, Any

from dotenv import load_dotenv
from groq import Groq

load_dotenv()

_client = None


def _get_client() -> Groq:
    """Lazily create the Groq client so importing this module doesn't
    require an API key to be present (e.g. during basic unit tests)."""
    global _client
    if _client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GROQ_API_KEY not found in environment. Add it to your .env file."
            )
        _client = Groq(api_key=api_key)
    return _client


VALID_TOOLS = {"land_cover", "change_detection", "measurement", "detection"}

SYSTEM_PROMPT = """You are an intent classifier for a satellite remote-sensing assistant.
Given a user's natural language query, decide which tool(s) it needs.

Available tools:
- land_cover: land cover / land use classification questions
- change_detection: comparing two time periods, before/after questions
- measurement: distance, area, size, perimeter questions
- detection: finding specific objects (ships, buildings, solar panels, water, forests, crops, airports)

Respond with ONLY valid JSON, no other text, in this exact shape:
{
  "tools": ["tool_name", ...],
  "location": "place name or null",
  "confidence": 0.0 to 1.0
}
"""


def classify_with_llm(text: str) -> Dict[str, Any]:
    """
    Sends the query to Groq's LLM and parses the structured intent back out.
    Raises on API failure or malformed response — caller should catch and
    fall back to the regex classifier's best guess if this fails.
    """
    client = _get_client()

    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": text},
        ],
        temperature=0.1,
        max_tokens=600,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content.strip()

    # Models sometimes wrap JSON in markdown fences despite instructions — strip those.
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:].strip()

    parsed = json.loads(raw)

    tools = [t for t in parsed.get("tools", []) if t in VALID_TOOLS]
    if not tools:
        tools = ["detection"]

    return {
        "tools": tools,
        "primary_tool": tools[0],
        "location": parsed.get("location") or "Selected Area of Interest",
        "confidence": float(parsed.get("confidence", 0.7)),
        "source": "llm",
    }


if __name__ == "__main__":
    # Manual test — requires a real GROQ_API_KEY in .env to run.
    test_queries = [
        "Is there any greenery being cut down near the hills?",
        "Tell me what's happening around the coast lately",
    ]
    for q in test_queries:
        print(q)
        try:
            print(classify_with_llm(q))
        except Exception as e:
            print(f"Error: {e}")
        print()