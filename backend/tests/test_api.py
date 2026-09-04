import os
import sys
import pytest
from fastapi.testclient import TestClient

# Ensure root backend module is importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.app.main import app

client = TestClient(app)

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ONLINE"
    assert "SatQuery AI" in data["title"]

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_query_endpoint():
    payload = {
        "query": "Detect ships near Mumbai port",
        "location_name": "Mumbai Port",
        "centre": [72.8360, 18.9438]
    }
    response = client.post("/api/v1/query/", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "text_response" in data
    assert data["analysis_kind"] == "detection"
    assert data["confidence"] > 0.8

def test_projects_endpoint():
    response = client.get("/api/v1/projects/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_datasets_bigearthnet_endpoint():
    response = client.get("/api/v1/datasets/bigearthnet/samples")
    assert response.status_code == 200
    data = response.json()
    assert data["dataset"] == "BigEarthNet"
    assert len(data["samples"]) > 0
    # Phase 3A: mock/demo patches must be explicitly labelled, never presented
    # as live BigEarthNet data.
    assert data["mode"] == "mock"

def test_vrsbench_eval_endpoint_reports_not_available():
    """Phase 3A: VRSBench is not evaluated, so the endpoint must say so
    instead of fabricating benchmark metrics."""
    response = client.get("/api/v1/datasets/vrsbench/eval")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "NOT_AVAILABLE"
    assert data["evaluated"] is False
    assert data["metrics"] is None

def test_model_status_endpoint():
    response = client.get("/api/v1/models/status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ONLINE"
