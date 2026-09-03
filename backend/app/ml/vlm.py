"""
Real local vision-language model backend (Phase 2G).

Wraps Hugging Face ``SmolVLM`` (``HuggingFaceTB/SmolVLM-500M-Instruct``) —
a genuinely multimodal model that receives actual image pixels plus a text
prompt and returns text grounded in the image. It runs fully locally on CPU
with transformers + torch; no API key, no cloud service. Weights (~1 GB)
are fetched from the Hugging Face hub on first use and cached under
``~/.cache/huggingface``.

Honesty contract
----------------
- This is general VISUAL INTERPRETATION. It is not a calibrated
  remote-sensing measurement model: the analysis services (NDVI/NDWI/land
  cover/change) remain authoritative for quantitative questions. The
  ``VisualAnalysisService`` documents this in the result and never reports a
  ``confidence`` — the model provides no calibrated confidence.
- If the model (or torch/transformers) is unavailable, loading raises a
  clear, structured error; the service turns it into a typed
  ``AnalysisServiceError``. Nothing is ever fabricated when the model did
  not actually run.
- Model provenance: ``SmolVLM`` is published by Hugging Face under the
  Apache-2.0 license (see the model card). Training data/architecture
  details live on the HF model card; we record what we verifiably know
  (name, id, version, license, device) and never invent accuracy numbers.

The heavy imports (torch, transformers) happen inside methods, so merely
importing this module (or the whole app) never requires them.
"""

import os
import time
from typing import List, Optional, Tuple

from PIL import Image

# Model identity + provenance (verifiable facts from the HF model card).
HF_MODEL_ID = "HuggingFaceTB/SmolVLM-500M-Instruct"
MODEL_NAME = "smolvlm-500m-instruct"
MODEL_VERSION = "0.0.2"  # checkpoint revision family reported by HF
MODEL_LICENSE = "Apache-2.0"
MODEL_DESCRIPTION = (
    "SmolVLM-500M-Instruct: compact open vision-language model (image + text "
    "prompt -> grounded text). Runs locally on CPU via transformers/torch; "
    "weights from the Hugging Face hub (~1 GB, cached). General visual "
    "interpretation only — not a calibrated remote-sensing model."
)


def vlm_enabled() -> bool:
    """Whether the real VLM may be invoked.

    ``SATQUERY_VLM=0/disabled/off`` forces it off (deployment without model
    weights or torch). Anything else enables it — loading is lazy and
    failures surface as structured MODEL_UNAVAILABLE errors, never fake text.
    """
    raw = os.environ.get("SATQUERY_VLM", "").strip().lower()
    if raw in ("0", "disabled", "off", "false", "no"):
        return False
    return True


class SmolVLMBackend:
    """Lazy local SmolVLM inference over a real RGB image + a text prompt."""

    task = "visual_interpretation"
    model_name = MODEL_NAME
    model_version = MODEL_VERSION
    device = "cpu"

    def __init__(self, model_id: str = HF_MODEL_ID) -> None:
        self.model_id = model_id
        self._processor = None
        self._model = None
        self._load_error: Optional[str] = None
        self._max_new_tokens = 200
        # Deterministic-ish generation: low temperature keeps consecutive
        # runs of the same query closely aligned (helpful for tests/demos)
        # while still allowing natural phrasing.
        self._temperature = 0.4

    # ── Loading (lazy; heavy imports deferred) ────────────────────────────

    def load(self) -> None:
        """Import transformers/torch and load processor + model weights."""
        if self._model is not None:
            return
        try:
            import torch  # noqa: F401  (presence check)
            from transformers import AutoProcessor, AutoModelForImageTextToText
        except Exception as exc:  # noqa: BLE001 - surface as clear error
            self._load_error = (
                f"Vision-language model dependencies are not installed "
                f"(torch/transformers): {exc}. Install them with "
                f"`pip install torch transformers torchvision` to enable "
                f"real visual interpretation."
            )
            raise RuntimeError(self._load_error) from exc

        try:
            from transformers import AutoProcessor, AutoModelForImageTextToText

            self._processor = AutoProcessor.from_pretrained(self.model_id)
            self._model = AutoModelForImageTextToText.from_pretrained(self.model_id)
            self._model.eval()
        except Exception as exc:  # noqa: BLE001 - surface as clear error
            self._load_error = (
                f"Failed to load the SmolVLM model '{self.model_id}' (weights "
                f"unavailable or hub unreachable): {exc}. Visual interpretation "
                f"needs network access on first run to download ~1 GB of weights "
                f"to the Hugging Face cache."
            )
            raise RuntimeError(self._load_error) from exc

    def is_loaded(self) -> bool:
        return self._model is not None

    def load_error(self) -> Optional[str]:
        return self._load_error

    # ── Inference ─────────────────────────────────────────────────────────

    def caption(self, image: Image.Image, prompt: str) -> Tuple[str, float]:
        """
        Run the model over ``image`` + ``prompt``.

        Returns ``(answer_text, latency_ms)``. ``image`` must be an RGB PIL
        image (the analysis service renders the true-colour Sentinel-2 RGB
        preview and passes the pixels here — the model genuinely sees them).
        Raises RuntimeError with a descriptive message on any failure.
        """
        if self._model is None:
            self.load()

        from transformers import AutoProcessor, AutoModelForImageTextToText

        if self._processor is None:
            self._processor = AutoProcessor.from_pretrained(self.model_id)
        if self._model is None:
            self._model = AutoModelForImageTextToText.from_pretrained(self.model_id)
            self._model.eval()

        if image.mode != "RGB":
            image = image.convert("RGB")

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image"},
                    {"type": "text", "text": prompt},
                ],
            },
        ]
        start = time.perf_counter()
        try:
            prompt_text = self._processor.apply_chat_template(
                messages, add_generation_prompt=True
            )
            inputs = self._processor(
                text=prompt_text, images=[image], return_tensors="pt"
            )
            import torch

            with torch.no_grad():
                generated = self._model.generate(
                    **inputs,
                    do_sample=True,
                    temperature=self._temperature,
                    max_new_tokens=self._max_new_tokens,
                )
            # Decode ONLY the generated tokens (drop the prompt prefix) so the
            # answer is the model's response, not an echo of the chat template.
            prompt_len = int(inputs["input_ids"].shape[1])
            answer = self._processor.batch_decode(
                generated[:, prompt_len:], skip_special_tokens=True
            )[0].strip()
        except Exception as exc:  # noqa: BLE001 - surface as clear error
            raise RuntimeError(f"Vision-language inference failed: {exc}") from exc
        latency_ms = round((time.perf_counter() - start) * 1000.0, 1)
        return answer, latency_ms

    # ── Provenance helpers ────────────────────────────────────────────────

    def provenance(self) -> dict:
        return {
            "model": self.model_name,
            "model_version": self.model_version,
            "hf_model_id": self.model_id,
            "license": MODEL_LICENSE,
            "device": self.device,
            "description": MODEL_DESCRIPTION,
        }


smol_vlm_backend = SmolVLMBackend()
