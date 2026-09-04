from fastapi import APIRouter
from backend.app.core.config import settings
from backend.app.ml.vlm import (
    MODEL_DESCRIPTION,
    MODEL_LICENSE,
    MODEL_NAME,
    MODEL_VERSION,
    smol_vlm_backend,
    vlm_enabled,
)

router = APIRouter()


@router.get("/status")
def get_model_status():
    """
    Honest model-serving status (Phase 3C audit).

    Reports the REAL state of the local vision-language pipeline: whether the
    real SmolVLM weights are loaded in this process, the device they run on
    and which license applies. No fabricated benchmark claims: SatQuery has
    NOT been fine-tuned on BigEarthNet and has NOT been evaluated against
    VRSBench or BigEarthNet, so ``bigearthnet_finetuned`` / ``vrsbench_evaluated``
    are ``False`` and no GPU memory or inference-latency numbers are invented.
    """
    enabled = vlm_enabled()
    loaded = smol_vlm_backend.is_loaded() if enabled else False
    load_error = smol_vlm_backend.load_error() if enabled else None

    return {
        # Model identity — real, verifiable provenance only.
        "model_name": MODEL_NAME,
        "model_version": MODEL_VERSION,
        "hf_model_id": "HuggingFaceTB/SmolVLM-500M-Instruct",
        "license": MODEL_LICENSE,
        "task": "visual_interpretation",
        "description": MODEL_DESCRIPTION,
        # Real runtime state.
        "vlm_enabled": enabled,
        "vlm_loaded": loaded,
        "vlm_load_error": load_error,
        "device": smol_vlm_backend.device if enabled else None,
        # Legacy field kept for client compatibility: ONLINE means the model
        # serving API itself is reachable, NOT that weights are loaded.
        "status": "ONLINE",
        # Honest training/evaluation status — no fine-tuning or benchmark
        # evaluation has been performed, so nothing is claimed.
        "bigearthnet_finetuned": False,
        "vrsbench_evaluated": False,
        "fine_tuning": {
            "status": "NOT_PERFORMED",
            "note": (
                "SmolVLM is used out of the box for general visual "
                "interpretation; it has not been fine-tuned on BigEarthNet "
                "or any remote-sensing dataset in this project."
            ),
        },
        # No fabricated hardware/latency figures: those are only meaningful
        # when measured on the serving machine.
        "gpu_memory_used_gb": None,
        "inference_latency_ms": None,
    }
