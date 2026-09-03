import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.app.agents.intent_classifier import classify, extract_location, detect_tools


def test_single_intent_detection():
    result = classify("Show me buildings in Bengaluru")
    assert "detection" in result["tools"]
    assert result["subtype"] == "building_detection"
    assert result["location"] == "Bengaluru"


def test_plural_nouns_are_detected():
    # Regression test for the "buildings" vs "building" word-boundary bug
    result = classify("Show me buildings here")
    assert result["subtype"] == "building_detection"


def test_multi_intent_detection():
    result = classify("Detect ships and classify land cover near Mumbai port")
    assert "detection" in result["tools"]
    assert "land_cover" in result["tools"]


def test_change_detection_keywords():
    result = classify("Compare forest cover before and after 2023 near Shimla")
    assert "change_detection" in result["tools"]
    assert result["location"] == "Shimla"


def test_measurement_keywords():
    result = classify("How large is this region in square km?")
    assert result["primary_tool"] == "measurement"


def test_no_keywords_falls_back_to_detection():
    result = classify("asdkjfh random gibberish text")
    assert result["primary_tool"] == "detection"


def test_no_location_returns_default():
    result = classify("measure the distance")
    assert result["location"] == "Selected Area of Interest"


def test_confidence_is_between_zero_and_one():
    result = classify("Show me buildings in Bengaluru")
    assert 0.0 <= result["confidence"] <= 1.0


def test_extract_location_directly():
    assert extract_location("ships near Mumbai port") == "Mumbai"
    assert extract_location("no location here") == "Selected Area of Interest"


def test_detect_tools_directly():
    tools = detect_tools("classify land cover and detect ships")
    assert "land_cover" in tools
    assert "detection" in tools