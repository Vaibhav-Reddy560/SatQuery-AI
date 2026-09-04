from typing import List, Dict, Any
from fastapi import APIRouter
from backend.app.ml.bigearthnet_loader import bigearthnet_manager
from backend.app.ml.vrsbench_eval import vrsbench_evaluator

router = APIRouter()

@router.get("/bigearthnet/samples")
def get_bigearthnet_samples():
    """
    Returns BigEarthNet (Sentinel-1 SAR + Sentinel-2 multispectral) patch samples.

    HONESTY (Phase 3A): these are MOCK/demo patches — canned patch metadata,
    not live BigEarthNet tiles. The response is stamped ``mode="mock"`` so a
    caller can never mistake them for real analysis data.
    """
    return {
        "dataset": "BigEarthNet",
        "mode": "mock",
        "note": (
            "Demo sample patches only: canned patch metadata, not live "
            "BigEarthNet tiles. Not scientific analysis data."
        ),
        "primary_sensors": ["Sentinel-1 SAR (VV/VH)", "Sentinel-2 Multispectral"],
        "paper_link": "https://arxiv.org/abs/1902.04048",
        "samples": bigearthnet_manager.get_sample_patches(limit=10)
    }

@router.get("/vrsbench/eval")
def get_vrsbench_evaluation():
    """
    VRSBench benchmark evaluation status.

    Honest (Phase 3A): SatQuery does not currently evaluate against VRSBench,
    so this endpoint reports NOT_AVAILABLE — it never fabricates benchmark
    metrics. See ml/vrsbench_eval.py.
    """
    return vrsbench_evaluator.run_evaluation_suite()