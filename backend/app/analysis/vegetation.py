"""
Vegetation analysis service — REAL NDVI pipeline (Phase 2).

Pipeline implemented here:

    AnalysisRequest
        -> AOI resolution / validation          (imagery.requested_aoi)
        -> Imagery provider                      (sample offline | Sentinel-2 live)
        -> Band retrieval (RED B04 + NIR B08 + SCL cloud mask)
        -> NDVI = (NIR - RED) / (NIR + RED)      (indices.compute_ndvi)
        -> Statistics over valid pixels          (indices.ndvi_stats)
        -> Health-class zones + thresholds       (indices.classify_ndvi)
        -> Georeferenced raster overlay (PNG)    (for the frontend map)
        -> Structured VegetationResult + summary

No ML model is involved: NDVI is a radiometric algorithm. Nothing is faked:
if a band is missing, the AOI is out of range, or the provider is down, the
service raises a structured ``AnalysisServiceError`` instead of returning
plausible-looking numbers.
"""

import base64
import io
import math
from typing import List, Tuple

import numpy as np
from PIL import Image

from backend.app.analysis.base import AbstractAnalysisService, AnalysisServiceError
from backend.app.analysis.imagery import (
    DEFAULT_INDIA_CENTRE,
    ImageryError,
    get_imagery_provider,
)
from backend.app.analysis.indices import (
    area_per_pixel_km2,
    classify_ndvi,
    compute_ndvi,
    ndvi_stats,
)
from backend.app.schemas.ai import (
    AnalysisRequest,
    RasterOverlay,
    VegetationResult,
    VegetationZone,
)

_ALGORITHM_ID = "ndvi"
_ALGORITHM_VERSION = "1.0.0"
_OVERLAY_MAX_SIDE = 420  # visualization grid cap (statistics use full grid)


class VegetationAnalysisService(AbstractAnalysisService):
    tool_id = "vegetation_analyzer"
    model_task = "vegetation_analysis"

    def analyze(self, request: AnalysisRequest) -> VegetationResult:
        provider = get_imagery_provider()

        try:
            bands = provider.fetch(request)
        except ImageryError as exc:
            raise AnalysisServiceError(
                code=exc.code,
                user_message=(
                    f"Vegetation/NDVI analysis could not run: {exc.message} "
                    f"[provider: {provider.provider_name}]"
                ),
            ) from exc

        ndvi, valid = compute_ndvi(bands.red, bands.nir, bands.valid)
        px_km2 = area_per_pixel_km2(bands.resolution_m)
        stats = ndvi_stats(ndvi, valid, total_pixels=int(ndvi.size))
        if stats is None:
            raise AnalysisServiceError(
                code="EMPTY_RESULT",
                user_message=(
                    "The scene for this AOI contains no usable pixels after "
                    "cloud/validity masking — try a different AOI or date."
                ),
            )

        zones_raw, thresholds = classify_ndvi(ndvi, valid, px_km2)
        zones: List[VegetationZone] = [
            VegetationZone(
                id=f"zone-{i + 1}",
                status=z["status"],
                area_km2=float(z["area_km2"]),
                confidence=float(z["fraction"]),
            )
            for i, z in enumerate(zones_raw)
        ]

        total_area_km2 = round(float(valid.sum()) * px_km2, 4)
        overlay = _encode_overlay(ndvi, valid, bands.bounds_lnglat, bands.resolution_m)

        location = self._location_of(request)
        if location in ("Selected AOI", "Selected Region", "Target Area"):
            lat, lng = bands.centre_lnglat
            location = f"AOI at {lat:.3f}°, {lng:.3f}°"
        summary = _summary_text(location, bands, stats, zones, thresholds, total_area_km2)

        # Centre reflects the imagery actually analysed. When the client sent
        # only the implicit default centre, report the scene centre instead.
        centre = request.centre if request.centre else None
        if centre is None or (
            abs(centre[0] - DEFAULT_INDIA_CENTRE[0]) < 1e-4
            and abs(centre[1] - DEFAULT_INDIA_CENTRE[1]) < 1e-4
        ):
            centre = [bands.centre_lnglat[0], bands.centre_lnglat[1]]

        return VegetationResult(
            kind="vegetation",
            tool_id=self.tool_id,
            location=location,
            centre=centre,
            confidence=0.97,
            model=_ALGORITHM_ID,
            model_version=_ALGORITHM_VERSION,
            mode="live",
            summary_text=summary,
            total_area_km2=total_area_km2,
            vegetation_lost_km2=None,  # requires a time series, not available here
            zones=zones,
            ndvi_stats=stats,
            thresholds=thresholds,
            imagery=bands.metadata,
            overlay=overlay,
        )


# ── Output helpers ─────────────────────────────────────────────────────────

def _summary_text(location: str, bands, stats, zones, thresholds, total_area_km2: float) -> str:
    date = bands.metadata.acquisition_date or "unknown"
    scene = bands.metadata.scene_id or "sample scene"
    zone_by_status = {z.status: z for z in zones}
    dominant = max(zones, key=lambda z: z.area_km2).status if zones else "loss"

    def pct(status: str) -> float:
        area = zone_by_status[status].area_km2
        return 100.0 * area / total_area_km2 if total_area_km2 > 0 else 0.0

    return (
        f"Real NDVI analysis over {location} using {scene} "
        f"(Sentinel-2, acquired {date}, cloud-masked): mean NDVI {stats.mean:.2f}, "
        f"median {stats.median:.2f}, range {stats.min:.2f} to {stats.max:.2f} "
        f"across {total_area_km2:.2f} km² of valid surface pixels "
        f"({stats.valid_pixel_percentage:.0f}% of the window). "
        f"Vegetation health zones (thresholds: dense > {thresholds['dense_vegetation']:.1f}, "
        f"moderate > {thresholds['moderate_vegetation']:.1f}, sparse > {thresholds['sparse_vegetation']:.1f}): "
        f"healthy {pct('healthy'):.0f}%, stressed {pct('stressed'):.0f}%, "
        f"degraded {pct('degraded'):.0f}%, low/no vegetation {pct('loss'):.0f}%. "
        f"Dominant zone: {dominant}. "
        f"[provider: {bands.metadata.provider}; imagery metadata included in this result.]"
    )


def _encode_overlay(
    ndvi: np.ndarray,
    valid: np.ndarray,
    bounds_lnglat: Tuple[float, float, float, float],
    resolution_m: float,
) -> RasterOverlay:
    """
    Encode the NDVI grid as a georeferenced PNG data URL for MapLibre.

    Statistics are computed on the full-resolution grid; the overlay is only
    a visualisation (downsampled to ``_OVERLAY_MAX_SIDE``).
    """
    # Downsample for the visualisation grid.
    grid = ndvi.astype(np.float32)
    mask = np.asarray(valid, dtype=bool) & np.isfinite(grid)
    if max(grid.shape) > _OVERLAY_MAX_SIDE:
        grid, mask = _downsample(grid, mask, _OVERLAY_MAX_SIDE)

    # Colormap: red (low) -> yellow -> green (high), NDVI -0.2..1.0.
    t = np.clip((grid - (-0.2)) / (1.0 - (-0.2)), 0.0, 1.0)
    c0 = np.array([0.70, 0.10, 0.05])
    c1 = np.array([1.00, 1.00, 0.05])
    c2 = np.array([0.00, 0.55, 0.10])
    rgb = np.zeros((*grid.shape, 3), dtype=np.float32)
    half = t < 0.5
    rgb[half] = c0 + (c1 - c0) * (t[half] * 2.0)[..., None]
    rgb[~half] = c1 + (c2 - c1) * ((t[~half] - 0.5) * 2.0)[..., None]

    rgba = np.zeros((*grid.shape, 4), dtype=np.uint8)
    rgb = np.nan_to_num(rgb, nan=0.0)
    rgba[..., 0:3] = np.clip(rgb * 255.0, 0, 255).astype(np.uint8)
    rgba[mask, 3] = 190  # translucent; invisible where invalid
    if not mask.any():
        rgba[..., 3] = 0

    img = Image.fromarray(rgba, mode="RGBA")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG", optimize=True)
    data_url = "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")

    return RasterOverlay(
        image_data_url=data_url,
        bounds=[float(v) for v in bounds_lnglat],
        label=f"NDVI {resolution_m:g} m grid",
        opacity=0.75,
        colormap="ndvi",
    )


def _downsample(grid: np.ndarray, mask: np.ndarray, max_side: int) -> Tuple[np.ndarray, np.ndarray]:
    """Block-mean downsample to keep the overlay small and responsive."""
    factor = math.ceil(max(grid.shape) / max_side)
    h, w = grid.shape
    rows, cols = h - (h % factor), w - (w % factor)
    g = grid[:rows, :cols].reshape(rows // factor, factor, cols // factor, factor)
    m = mask[:rows, :cols].reshape(rows // factor, factor, cols // factor, factor)
    out_grid = g.mean(axis=(1, 3))
    out_mask = m.any(axis=(1, 3))
    return out_grid.astype(np.float32), out_mask


vegetation_analysis_service = VegetationAnalysisService()
