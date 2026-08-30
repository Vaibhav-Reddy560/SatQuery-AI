from typing import List, Dict, Any
from fastapi import APIRouter
from backend.app.ml.bigearthnet_loader import bigearthnet_manager
from backend.app.ml.vrsbench_eval import vrsbench_evaluator

router = APIRouter()

@router.get("/bigearthnet/samples")
def get_bigearthnet_samples():
    """
    Returns BigEarthNet (Sentinel-1 SAR + Sentinel-2 multispectral) patch samples.
    """
    return {
        "dataset": "BigEarthNet",
        "primary_sensors": ["Sentinel-1 SAR (VV/VH)", "Sentinel-2 Multispectral"],
        "paper_link": "https://arxiv.org/abs/2603.29630",
        "samples": bigearthnet_manager.get_sample_patches(limit=10)
    }

@router.get("/vrsbench/eval")
def get_vrsbench_evaluation():
    """
    Triggers/retrieves VRSBench Visual Remote Sensing Benchmark evaluation performance metrics.
    """
    return vrsbench_evaluator.run_evaluation_suite()
