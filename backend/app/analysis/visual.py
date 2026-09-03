"""
Visual interpretation service — REAL local vision-language pipeline (Phase 2G).

Pipeline implemented here:

    AnalysisRequest
        -> AOI resolution / validation        (imagery.requested_aoi)
        -> Imagery provider                    (sample offline | Sentinel-2 live)
        -> Band retrieval (B02 BLUE + B03 GREEN + B04 RED + SCL mask)
        -> True-colour RGB render              (B04->R, B03->G, B02->B, 10 m)
        -> SmolVLM vision-language inference   (ml.vlm; image pixels + prompt)
        -> Structured VisualResult + summary

Scientific honesty
------------------
- The VLM genuinely receives the actual RGB pixels of the scene — its answer
  is grounded in the image, never in metadata, filenames or index values.
- The VLM provides GENERAL VISUAL INTERPRETATION only. It is not a
  calibrated remote-sensing measurement model: for quantitative questions
  (percent vegetation, water area, change) the deterministic/ML analysis
  services remain authoritative and the routing keeps those queries away
  from the VLM. The prompt instructs the model to never invent numbers.
- No ``confidence`` is reported (a VLM has no calibrated confidence) and the
  result is stamped ``model_kind="vlm"`` — never conflated with ML
  classifiers or radiometric algorithms.
- If the model or its weights are unavailable, a structured
  ``AnalysisServiceError`` is raised instead of fabricating a description.
"""

import base64
import io
from typing import Optional, Tuple

import numpy as np
from PIL import Image, ImageOps

from backend.app.analysis.base import AbstractAnalysisService, AnalysisServiceError
from backend.app.analysis.imagery import (
    DEFAULT_INDIA_CENTRE,
    ImageryError,
    get_imagery_provider,
)
from backend.app.ml.vlm import (
    MODEL_DESCRIPTION,
    MODEL_LICENSE,
    MODEL_NAME,
    MODEL_VERSION,
    smol_vlm_backend,
    vlm_enabled,
)
from backend.app.schemas.ai import AnalysisRequest, VisualResult

# VLM model id used for the "model" field on the result envelope.
VLM_MODEL_ID = "smolvlm-500m-instruct"

# Compact system instruction that grounds the model in the supplied image
# and forbids invented measurements. Kept short deliberately: SmolVLM-500M
# follows brief directives reliably but echoes long multi-sentence prompts.
_SYSTEM_INSTRUCTION = (
    "You analyze a real ~10 m satellite photo. Describe only what is visibly "
    "in the image (land cover, water, vegetation, large structures, colours, "
    "texture). If unclear, say so. Never invent objects, measurements or "
    "percentages."
)

# Reflectance quantiles used to stretch the true-colour preview. Sentinel-2
# L2A reflectance is dark and low-contrast when linearly scaled; clipping to
# [p02, p98] (with a mid-tone lift) produces a viewable RGB. This is a
# display stretch only — the underlying data and georeferencing are
# untouched, and multispectral analysis uses the raw reflectance.
_STRETCH_LO = 2.0
_STRETCH_HI = 98.0
_PREVIEW_MAX_SIDE = 512


class VisualAnalysisService(AbstractAnalysisService):
    tool_id = "visual_analyzer"
    model_task = "visual_interpretation"

    def analyze(self, request: AnalysisRequest) -> VisualResult:
        # Fail fast and honestly when the real VLM is unavailable. The agent
        # pipeline never silently substitutes canned text for model output.
        if not vlm_enabled():
            raise AnalysisServiceError(
                code="MODEL_UNAVAILABLE",
                user_message=(
                    "Visual interpretation is disabled in this deployment "
                    "(SATQUERY_VLM=off). No visual description was generated."
                ),
            )

        provider = get_imagery_provider()
        try:
            bands = provider.fetch(request)
        except ImageryError as exc:
            raise AnalysisServiceError(
                code=exc.code,
                user_message=(
                    f"Visual interpretation could not run: {exc.message} "
                    f"[provider: {provider.provider_name}]"
                ),
            ) from exc

        rgb, image = _render_rgb_preview(bands)
        image_size = f"{image.width}x{image.height}"

        location = self._location_of(request)
        if location in ("Selected AOI", "Selected Region", "Target Area"):
            lat, lng = bands.centre_lnglat
            location = f"AOI at {lat:.3f}°, {lng:.3f}°"

        date = bands.metadata.acquisition_date or "unknown"
        scene = bands.metadata.scene_id or "sample scene"
        prompt = _build_prompt(
            request.query,
            location=location,
            scene=scene,
            date=date,
            resolution_m=bands.resolution_m,
        )

        try:
            smol_vlm_backend.load()
            answer, latency_ms = smol_vlm_backend.caption(image, prompt)
        except RuntimeError as exc:
            raise AnalysisServiceError(
                code="MODEL_UNAVAILABLE",
                user_message=(
                    "The vision-language model could not run: "
                    f"{getattr(exc, 'message', None) or exc}. No visual "
                    "description was generated."
                ),
            ) from exc
        except Exception as exc:  # noqa: BLE001 - surface as structured error
            raise AnalysisServiceError(
                code="INFERENCE_FAILED",
                user_message=(
                    "Visual interpretation failed during model inference. "
                    "Please try again."
                ),
            ) from exc

        if not answer.strip():
            raise AnalysisServiceError(
                code="EMPTY_RESULT",
                user_message=(
                    "The vision-language model returned an empty response for "
                    "this image. Please try a different question."
                ),
            )

        summary = _summary_text(
            answer=answer,
            location=location,
            imagery=bands.metadata,
            image_size=image_size,
            latency_ms=latency_ms,
        )

        # Centre reflects the imagery actually analysed. When the client sent
        # only the implicit default centre, report the scene centre instead.
        centre = request.centre if request.centre else None
        if centre is None or (
            abs(centre[0] - DEFAULT_INDIA_CENTRE[0]) < 1e-4
            and abs(centre[1] - DEFAULT_INDIA_CENTRE[1]) < 1e-4
        ):
            centre = [bands.centre_lnglat[0], bands.centre_lnglat[1]]

        return VisualResult(
            kind="visual",
            tool_id=self.tool_id,
            location=location,
            centre=centre,
            confidence=None,  # no calibrated confidence exists — honest omission
            model=VLM_MODEL_ID,
            model_version=MODEL_VERSION,
            mode="live",
            model_kind="vlm",
            summary_text=summary,
            answer=answer,
            question=request.query,
            imagery=bands.metadata,
            context_supplied=False,
            context_source="none",
            image_size=image_size,
            inference_latency_ms=latency_ms,
            device=smol_vlm_backend.device,
            image_data_url=_encode_image_data_url(image),
        )


# ── Output helpers ─────────────────────────────────────────────────────────

def _build_prompt(
    raw_question: str,
    location: str,
    scene: str,
    date: str,
    resolution_m: float,
) -> str:
    """Controlled, grounded prompt: compact instruction + the user's question.

    The VLM sees only the image and this text (scene provenance is carried in
    the structured result, not crammed into the prompt). No statistics or
    analysis values are injected, so the model cannot parrot numbers — visual
    observation stays distinct from computed measurement by construction.
    """
    return (
        f"{_SYSTEM_INSTRUCTION} "
        f"Question: {raw_question}"
    )


def _render_rgb_preview(bands) -> Tuple[np.ndarray, Image.Image]:
    """
    Build a true-colour RGB preview from the provider's real bands.

    R = B04, G = B03, B = B02 (Sentinel-2 10 m L2A reflectance). Cloud /
    nodata pixels (NaN) are filled after stretching by nearest-valid value so
    the model sees the scene without black holes. Returns the uint8 RGB array
    and the PIL image.
    """
    red = np.asarray(bands.red, dtype=np.float32)
    green = np.asarray(bands.green, dtype=np.float32)
    blue = np.asarray(bands.blue, dtype=np.float32)

    missing = []
    if red.size == 0 or not np.isfinite(red).any():
        missing.append("RED (B04)")
    if green.size == 0 or not np.isfinite(green).any():
        missing.append("GREEN (B03)")
    if blue is None or blue.size == 0 or not np.isfinite(blue).any():
        missing.append("BLUE (B02)")
    if missing:
        raise AnalysisServiceError(
            code="MISSING_BAND",
            user_message=(
                "The imagery provider did not return the "
                f"{' + '.join(missing)} band(s) required to render the "
                "true-colour image for visual interpretation."
            ),
        )

    stack = np.stack([red, green, blue], axis=-1)

    # Display stretch per-channel at the scene's own reflectance distribution.
    stretched = np.zeros_like(stack)
    for c in range(3):
        chan = stack[..., c]
        finite = chan[np.isfinite(chan)]
        if finite.size == 0:
            continue
        lo, hi = np.percentile(finite, [_STRETCH_LO, _STRETCH_HI])
        hi = float(hi)
        lo = float(lo)
        if hi - lo < 1e-6:  # degenerate channel (e.g. fully dark)
            hi = lo + 1.0
        c_out = (chan - lo) / (hi - lo)
        # Mid-tone lift (gamma < 1 brightens) makes dark reflectance viewable.
        c_out = np.clip(c_out, 0.0, 1.0) ** (1.0 / 1.4)
        stretched[..., c] = c_out

    rgb8 = (np.nan_to_num(stretched, nan=0.0) * 255.0).astype(np.uint8)

    # Fill masked holes (NaN pixels became 0 above) with neighbouring valid
    # colours by iterative dilation, so the VLM does not stare at black
    # cloud holes. Cosmetic only — band values/georeferencing are untouched.
    valid_any = np.isfinite(stack).all(axis=-1)
    if not valid_any.all():
        try:
            from scipy import ndimage

            filled = rgb8.astype(np.float32)
            structure = np.ones((3, 3), dtype=bool)
            for _ in range(30):  # fills holes up to ~15 px wide
                grown = ndimage.grey_dilation(
                    filled, size=3, structure=structure, mode="nearest"
                )
                # only adopt the dilated colour where a valid neighbour exists
                adopted = ndimage.binary_dilation(valid_any, structure=structure)
                filled = np.where(adopted[..., None], grown, filled)
                if adopted.all():
                    break
            rgb8 = np.clip(filled, 0, 255).astype(np.uint8)
        except Exception:  # noqa: BLE001 - cosmetic only; keep NaN as black
            pass

    image = Image.fromarray(rgb8, mode="RGB")

    # Downscale for the model/preview when very large (keeps CPU inference
    # and the data URL small). LANCZOS is a faithful, documented resample.
    max_side = _PREVIEW_MAX_SIDE
    if max(image.size) > max_side:
        ratio = max_side / float(max(image.size))
        image = image.resize(
            (max(1, int(image.width * ratio)), max(1, int(image.height * ratio))),
            Image.LANCZOS,
        )
    return rgb8, image

def _encode_image_data_url(image: Image.Image) -> str:
    """Encode a PIL RGB image as a PNG data URL for the chat UI."""
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


def _summary_text(
    answer: str,
    location: str,
    imagery,
    image_size: str,
    latency_ms: float,
) -> str:
    date = imagery.acquisition_date or "unknown"
    scene = imagery.scene_id or "sample scene"
    return (
        f"Visual interpretation of the real Sentinel-2 scene over {location} "
        f"(scene {scene}, acquired {date}, {image_size} px true-colour RGB) "
        f"using {MODEL_NAME} v{MODEL_VERSION} ({MODEL_LICENSE}). "
        f"The model received the actual image pixels and answered: \"{answer}\" "
        f"Inference took {latency_ms / 1000.0:.1f}s on CPU. "
        f"Note: this is general visual interpretation by a compact vision-language "
        f"model — it is not a calibrated measurement; for quantitative answers "
        f"(vegetation %, water area, change) use the dedicated analysis tools."
    )


visual_analysis_service = VisualAnalysisService()
