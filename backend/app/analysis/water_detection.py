"""
Water body detection service — REAL Sentinel-2 NDWI pipeline (Phase 2C).

Pipeline implemented here:

    AnalysisRequest
        -> AOI resolution / validation          (imagery.requested_aoi)
        -> Imagery provider                      (sample offline | Sentinel-2 live)
        -> Band retrieval (GREEN B03 + NIR B08 + SCL cloud mask)
        -> NDWI = (GREEN - NIR) / (GREEN + NIR)  (indices.compute_ndwi)
        -> Statistics over valid pixels          (indices.ndwi_stats)
        -> Water classification (NDWI >= 0.0)    (indices.water_mask)
        -> Georeferenced raster overlay (PNG)    (for the frontend map)
        -> Structured WaterResult + summary

NDWI is a radiometric algorithm — NOT an ML model — and it is deliberately
different from NDVI: it compares GREEN (B03) against NIR (B08), which makes
water surfaces strongly positive. Nothing is faked: if a band is missing, the
AOI is out of range, or the provider is down, the service raises a structured
``AnalysisServiceError`` instead of returning plausible-looking numbers.
"""

import base64
import io
import math
from typing import Tuple

import numpy as np
from PIL import Image

from backend.app.analysis.base import AbstractAnalysisService, AnalysisServiceError
from backend.app.analysis.imagery import (
    DEFAULT_INDIA_CENTRE,
    ImageryError,
    get_imagery_provider,
)
from backend.app.analysis.indices import (
    DEFAULT_WATER_THRESHOLD,
    area_per_pixel_km2,
    compute_ndwi,
    downsample_raster,
    ndwi_stats,
    water_mask,
)
from backend.app.schemas.ai import (
    AnalysisRequest,
    RasterOverlay,
    WaterResult,
)

_ALGORITHM_ID = "ndwi"
_ALGORITHM_VERSION = "1.0.0"
_OVERLAY_MAX_SIDE = 420  # visualization grid cap (statistics use full grid)


class WaterDetectionService(AbstractAnalysisService):
    tool_id = "water_detector"
    model_task = "water_detection"

    def analyze(self, request: AnalysisRequest) -> WaterResult:
        provider = get_imagery_provider()

        try:
            bands = provider.fetch(request)
        except ImageryError as exc:
            raise AnalysisServiceError(
                code=exc.code,
                user_message=(
                    f"Water detection could not run: {exc.message} "
                    f"[provider: {provider.provider_name}]"
                ),
            ) from exc

        if bands.green is None:
            raise AnalysisServiceError(
                code="MISSING_BAND",
                user_message=(
                    "The imagery provider did not return the GREEN (B03) band "
                    "required for NDWI water detection. Regenerate the sample "
                    "with: python scripts/fetch_sentinel2_sample.py"
                ),
            )

        threshold = _threshold_of(request)

        ndwi, valid = compute_ndwi(bands.green, bands.nir, bands.valid)
        px_km2 = area_per_pixel_km2(bands.resolution_m)
        stats = ndwi_stats(
            ndwi, valid, total_pixels=int(ndwi.size), water_threshold=threshold
        )
        if stats is None:
            raise AnalysisServiceError(
                code="EMPTY_RESULT",
                user_message=(
                    "The scene for this AOI contains no usable pixels after "
                    "cloud/validity masking — try a different AOI or date."
                ),
            )

        water = water_mask(ndwi, valid, threshold)
        water_area_km2 = round(float(water.sum()) * px_km2, 4)
        total_area_km2 = round(float(valid.sum()) * px_km2, 4)
        overlay = _encode_water_overlay(ndwi, valid, bands.bounds_lnglat, bands.resolution_m)

        location = self._location_of(request)
        if location in ("Selected AOI", "Selected Region", "Target Area"):
            lat, lng = bands.centre_lnglat
            location = f"AOI at {lat:.3f}°, {lng:.3f}°"
        summary = _summary_text(location, bands, stats, threshold, water_area_km2, total_area_km2)

        # Centre reflects the imagery actually analysed. When the client sent
        # only the implicit default centre, report the scene centre instead.
        centre = request.centre if request.centre else None
        if centre is None or (
            abs(centre[0] - DEFAULT_INDIA_CENTRE[0]) < 1e-4
            and abs(centre[1] - DEFAULT_INDIA_CENTRE[1]) < 1e-4
        ):
            centre = [bands.centre_lnglat[0], bands.centre_lnglat[1]]

        return WaterResult(
            kind="water",
            tool_id=self.tool_id,
            location=location,
            centre=centre,
            confidence=0.97,
            model=_ALGORITHM_ID,
            model_version=_ALGORITHM_VERSION,
            mode="live",
            model_kind="algorithm",
            summary_text=summary,
            water_area_km2=water_area_km2,
            total_area_km2=total_area_km2,
            ndwi_stats=stats,
            threshold=threshold,
            imagery=bands.metadata,
            overlay=overlay,
        )


# ── Output helpers ─────────────────────────────────────────────────────────

def _threshold_of(request: AnalysisRequest) -> float:
    """Explicit, configurable NDWI water threshold (default 0.0)."""
    raw = request.parameters.get("ndwi_threshold", DEFAULT_WATER_THRESHOLD)
    try:
        value = float(raw)
    except (TypeError, ValueError):
        raise AnalysisServiceError(
            code="INVALID_PARAMETER",
            user_message=(
                f"The ndwi_threshold parameter must be a number, got {raw!r}. "
                f"The default water threshold is NDWI >= 0.0."
            ),
        ) from None
    if not math.isfinite(value):
        raise AnalysisServiceError(
            code="INVALID_PARAMETER",
            user_message="The ndwi_threshold parameter must be a finite number.",
        )
    return value


def _summary_text(location, bands, stats, threshold: float, water_area_km2: float, total_area_km2: float) -> str:
    date = bands.metadata.acquisition_date or "unknown"
    scene = bands.metadata.scene_id or "sample scene"
    return (
        f"Real NDWI water analysis over {location} using {scene} "
        f"(Sentinel-2, acquired {date}, cloud-masked): NDWI mean {stats.mean:.2f}, "
        f"median {stats.median:.2f}, range {stats.min:.2f} to {stats.max:.2f}. "
        f"Pixels with NDWI >= {threshold:g} are classified as water "
        f"(McFeeters 1996 threshold): **{water_area_km2:.2f} km² of water** "
        f"({stats.water_pixel_percentage:.1f}% of valid surface pixels, "
        f"{total_area_km2:.2f} km² analysed, {stats.valid_pixel_percentage:.0f}% of the "
        f"window usable after cloud masking). "
        f"[bands: B03 (GREEN) + B08 (NIR); provider: {bands.metadata.provider}; "
        f"imagery metadata included in this result.]"
    )


def _encode_water_overlay(
    ndwi: np.ndarray,
    valid: np.ndarray,
    bounds_lnglat: Tuple[float, float, float, float],
    resolution_m: float,
) -> RasterOverlay:
    """
    Encode the NDWI grid as a georeferenced PNG data URL for MapLibre.

    Non-water and invalid pixels are fully transparent; water pixels (NDWI >=
    0) render as a blue ramp whose opacity increases with NDWI.
    Statistics are computed on the full-resolution grid; the overlay is only
    a visualisation (downsampled to ``_OVERLAY_MAX_SIDE``).
    """
    grid = ndwi.astype(np.float32)
    mask = np.asarray(valid, dtype=bool) & np.isfinite(grid)
    if max(grid.shape) > _OVERLAY_MAX_SIDE:
        grid, mask = downsample_raster(grid, mask, _OVERLAY_MAX_SIDE)

    # Blue water ramp: NDWI 0..1 -> opacity 0..~0.85 (fully transparent below
    # the water threshold, invisible where invalid).
    t = np.clip((grid - 0.0) / (1.0 - 0.0), 0.0, 1.0)
    rgba = np.zeros((*grid.shape, 4), dtype=np.uint8)
    rgba[..., 0:3] = np.array([0.05, 0.45, 0.95], dtype=np.float32) * 255.0
    alpha = np.zeros(grid.shape, dtype=np.float32)
    alpha[mask] = t[mask] * 0.85
    rgba[..., 3] = np.clip(alpha * 255.0, 0, 255).astype(np.uint8)
    if not mask.any():
        rgba[..., 3] = 0

    img = Image.fromarray(rgba, mode="RGBA")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG", optimize=True)
    data_url = "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")

    return RasterOverlay(
        image_data_url=data_url,
        bounds=[float(v) for v in bounds_lnglat],
        label=f"NDWI {resolution_m:g} m water mask",
        opacity=0.75,
        colormap="ndwi",
    )


water_detection_service = WaterDetectionService()