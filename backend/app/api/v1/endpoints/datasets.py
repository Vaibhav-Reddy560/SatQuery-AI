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

@router.get("/bigearthnet/eval")
def get_bigearthnet_evaluation():
    """
    BigEarthNet benchmark/reference evaluation status.

    Honest (Phase 3C): SatQuery's vision-language model has NOT been
    fine-tuned on BigEarthNet and NO evaluation against the BigEarthNet
    benchmark has been run in this project, so the endpoint reports
    NOT_AVAILABLE. It never fabricates metrics (accuracy, presence/area/
    counting scores, …). The reference dataset is documented in
    ml/bigearthnet_loader.py; full evaluation requires the external dataset
    (Sentinel-1/Sentinel-2 patches + BigEarthNet.txt labels) which is not
    bundled here.
    """
    return {
        "dataset": "BigEarthNet",
        "status": "NOT_AVAILABLE",
        "evaluated": False,
        "fine_tuned": False,
        "message": (
            "BigEarthNet is not evaluated in this deployment: no metrics are "
            "reported because none were measured. SatQuery's vision-language "
            "model has not been fine-tuned on, nor evaluated against, the "
            "BigEarthNet benchmark. Running it requires the external BigEarthNet "
            "dataset (Sentinel-1 SAR + Sentinel-2 patches with BigEarthNet.txt "
            "labels), which is not bundled with this repository."
        ),
        "reference_tasks": [
            "Multi-label land-cover presence",
            "Land-cover area estimation",
            "Object counting",
            "Adjacency / relative position",
            "Location / season / climate zone",
        ],
        "metrics": None,
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