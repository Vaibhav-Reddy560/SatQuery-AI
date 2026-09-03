"""
Real multi-temporal change detection (Phase 2E) — deterministic remote sensing.

Method
------
Change detection is a radiometric algorithm, NOT ML. Two real Sentinel-2 L2A
observations of the same AOI at different acquisition dates are compared via
the normalized difference vegetation index:

    delta_ndvi = NDVI_after - NDVI_before
    NDVI = (NIR - RED) / (NIR + RED)

Change classes (per valid comparison pixel, i.e. cloud-free in BOTH dates):

    unchanged           |delta_ndvi| <  threshold
    vegetation loss     delta_ndvi   <= -threshold
    vegetation gain     delta_ndvi   >= +threshold

The default threshold is 0.15 in NDVI units — a conservative, published
breakpoint for bi-temporal NDVI differencing (well above typical NDVI
sensor/phenological noise of ~0.05–0.10, so random pixel noise is not
reported as change). It is explicit in the result metadata and configurable
per request via ``request.thresholds["ndvi_delta"]`` — never silently derived
from the sample.

Honesty rules
-------------
- Only pixels valid in BOTH dates (SCL cloud/shadow/nodata masked) are
  compared; statistics are computed over that intersection alone.
- No pixel difference is claimed to be real land-use change: the summary
  explicitly acknowledges seasonal/agricultural variation, illumination and
  sensor effects.
- Spatial alignment is verified (same CRS + grid). The bundled sample pair is
  pixel-aligned by construction; mismatched grids raise a structured error
  instead of silently misaligning.
- Areas use the raster's actual resolution (never assumed 10 m).
"""

import base64
import io
import math
from typing import Dict, List, Tuple

import numpy as np
from PIL import Image

from backend.app.analysis.base import AnalysisServiceError
from backend.app.analysis.indices import area_per_pixel_km2, compute_ndvi, downsample_raster
from backend.app.schemas.ai import ChangeStats, RasterOverlay

# |delta_ndvi| >= this => the pixel is "changed" (loss if negative, gain if
# positive). Conservative NDVI-differencing breakpoint; configurable per
# request via request.thresholds["ndvi_delta"].
DEFAULT_CHANGE_THRESHOLD = 0.15

# One centralized class -> color mapping: the result legend AND the overlay
# pixels use exactly these colours.
CHANGE_CLASS_COLORS: Dict[str, str] = {
    "unchanged": "#6b7280",
    "vegetation_loss": "#dc2626",
    "vegetation_gain": "#22c55e",
}

CHANGE_CLASS_LABELS: Dict[str, str] = {
    "unchanged": "Unchanged",
    "vegetation_loss": "Vegetation loss",
    "vegetation_gain": "Vegetation gain",
}

_OVERLAY_MAX_SIDE = 420


class ChangeGridError(AnalysisServiceError):
    """Raised when two observations cannot be compared on a common grid."""


def resolve_change_threshold(request) -> float:
    """Explicit threshold: request override, else the documented default."""
    thresholds = request.thresholds or {}
    override = thresholds.get("ndvi_delta")
    if isinstance(override, (int, float)) and float(override) > 0:
        return float(override)
    return DEFAULT_CHANGE_THRESHOLD


def align_pair(
    before: np.ndarray,
    after: np.ndarray,
    valid_before: np.ndarray,
    valid_after: np.ndarray,
    before_crs: str,
    after_crs: str,
    before_transform: Tuple[float, ...],
    after_transform: Tuple[float, ...],
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Verify that two observations sit on the same grid, or resample the
    ``after`` grid onto the ``before`` grid.

    Returns ``(before, after, valid_both)`` where ``valid_both`` is the
    per-pixel intersection of the two validity masks (cloud-free in both
    dates). Resampling is explicit (rasterio warp, bilinear) and only used
    when the grids genuinely differ; identical grids pass through untouched.
    """
    b = np.asarray(before, dtype=np.float32)
    a = np.asarray(after, dtype=np.float32)
    vb = np.asarray(valid_before, dtype=bool)
    va = np.asarray(valid_after, dtype=bool)

    same_crs = (before_crs or "").replace("EPSG:", "").strip() == (after_crs or "").replace("EPSG:", "").strip()
    same_transform = (
        before_transform is not None
        and after_transform is not None
        and np.allclose(before_transform, after_transform, atol=1e-6)
    )
    same_shape = b.shape == a.shape

    if same_shape and (same_crs and same_transform):
        return b, a, (vb & va)

    if not same_shape:
        # Resample the after grid onto the before grid. Only reachable for
        # live-provider pairs where scene grids differ.
        try:
            import rasterio
            from rasterio.enums import Resampling
            from rasterio.warp import reproject

            dst = np.empty(b.shape, dtype=np.float32)
            reproject(
                source=a,
                destination=dst,
                src_transform=after_transform,
                src_crs=after_crs,
                dst_transform=before_transform,
                dst_crs=before_crs,
                resampling=Resampling.bilinear,
            )
            a = dst

            dst_valid = np.zeros(b.shape, dtype=np.uint8)
            reproject(
                source=va.astype(np.uint8),
                destination=dst_valid,
                src_transform=after_transform,
                src_crs=after_crs,
                dst_transform=before_transform,
                dst_crs=before_crs,
                resampling=Resampling.nearest,
            )
            va = dst_valid.astype(bool)
            return b, a, (vb & va)
        except Exception as exc:  # noqa: BLE001 - structured failure
            raise ChangeGridError(
                code="INCOMPATIBLE_GRID",
                user_message=(
                    "The two observations could not be aligned onto a common "
                    "grid for change detection (CRS/grid mismatch)."
                ),
            ) from exc

    raise ChangeGridError(
        code="INCOMPATIBLE_GRID",
        user_message=(
            "The two observations use different CRS/grids and cannot be "
            "compared pixel-aligned. Change detection was not run."
        ),
    )


def compute_delta_ndvi(
    red_before: np.ndarray,
    nir_before: np.ndarray,
    valid_before: np.ndarray,
    red_after: np.ndarray,
    nir_after: np.ndarray,
    valid_after: np.ndarray,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    NDVI per date (over each date's own valid pixels) then the difference.

    Returns ``(delta_ndvi, valid_both)``: delta_ndvi is float32 with NaN
    wherever either date is invalid; valid_both is the intersection mask.
    """
    ndvi_before, vb = compute_ndvi(red_before, nir_before, valid_before)
    ndvi_after, va = compute_ndvi(red_after, nir_after, valid_after)
    valid_both = vb & va
    delta = np.full(ndvi_before.shape, np.nan, dtype=np.float32)
    delta[valid_both] = (ndvi_after[valid_both] - ndvi_before[valid_both]).astype(np.float32)
    return delta, valid_both


def classify_change(
    delta_ndvi: np.ndarray,
    valid_both: np.ndarray,
    threshold: float,
) -> np.ndarray:
    """
    Per-pixel change class grid (strings). Invalid pixels are marked ``""``.
    """
    values = np.asarray(delta_ndvi, dtype=np.float32)
    classes = np.full(values.shape, "", dtype=object)
    classes[valid_both & (values <= -float(threshold))] = "vegetation_loss"
    classes[valid_both & (values >= float(threshold))] = "vegetation_gain"
    classes[valid_both & (np.abs(values) < float(threshold))] = "unchanged"
    return classes


def change_statistics(
    delta_ndvi: np.ndarray,
    valid_both: np.ndarray,
    classes: np.ndarray,
    resolution_m: float,
) -> ChangeStats:
    """Counts, percentages and areas over the valid comparison pixels only."""
    delta = np.asarray(delta_ndvi, dtype=np.float32)
    mask = np.asarray(valid_both, dtype=bool) & np.isfinite(delta)
    n_valid = int(mask.sum())
    if n_valid == 0:
        raise AnalysisServiceError(
            code="NO_VALID_OVERLAP",
            user_message=(
                "No pixel is cloud-free in both observations, so nothing can "
                "be compared. Change detection was not run."
            ),
        )

    px_km2 = area_per_pixel_km2(resolution_m)
    counts = {
        "unchanged": int((classes[mask] == "unchanged").sum()),
        "vegetation_loss": int((classes[mask] == "vegetation_loss").sum()),
        "vegetation_gain": int((classes[mask] == "vegetation_gain").sum()),
    }
    counts["changed"] = counts["vegetation_loss"] + counts["vegetation_gain"]

    def pct(count: int) -> float:
        return 100.0 * count / n_valid

    return ChangeStats(
        valid_pixel_count=n_valid,
        unchanged_pixel_count=counts["unchanged"],
        changed_pixel_count=counts["changed"],
        loss_pixel_count=counts["vegetation_loss"],
        gain_pixel_count=counts["vegetation_gain"],
        unchanged_percentage=round(pct(counts["unchanged"]), 2),
        changed_percentage=round(pct(counts["changed"]), 2),
        loss_percentage=round(pct(counts["vegetation_loss"]), 2),
        gain_percentage=round(pct(counts["vegetation_gain"]), 2),
        total_area_km2=round(n_valid * px_km2, 4),
        changed_area_km2=round(counts["changed"] * px_km2, 4),
        loss_area_km2=round(counts["vegetation_loss"] * px_km2, 4),
        gain_area_km2=round(counts["vegetation_gain"] * px_km2, 4),
    )


def encode_change_overlay(
    classes: np.ndarray,
    valid_both: np.ndarray,
    bounds_lnglat: Tuple[float, float, float, float],
    resolution_m: float,
) -> RasterOverlay:
    """
    Categorical georeferenced PNG of the change classes.

    Every classified pixel is drawn in its class colour (fully opaque);
    invalid pixels are transparent. Colours come from ``CHANGE_CLASS_COLORS``
    — the same mapping the result legend uses, so pixels always match the
    legend. Downsampled to ``_OVERLAY_MAX_SIDE`` for display.
    """
    idx = np.zeros(classes.shape, dtype=np.float32)
    for i, cls in enumerate(("unchanged", "vegetation_loss", "vegetation_gain"), start=1):
        idx[classes == cls] = float(i)
    mask = np.asarray(valid_both, dtype=bool)

    if max(idx.shape) > _OVERLAY_MAX_SIDE:
        idx, mask = downsample_raster(idx, mask, _OVERLAY_MAX_SIDE)
    idx = np.round(idx).astype(np.int16)

    rgba = np.zeros((*idx.shape, 4), dtype=np.uint8)
    palette = [CHANGE_CLASS_COLORS["unchanged"], CHANGE_CLASS_COLORS["vegetation_loss"], CHANGE_CLASS_COLORS["vegetation_gain"]]
    for i, hex_color in enumerate(palette, start=1):
        rgb = _hex_to_rgb(hex_color)
        sel = mask & (idx == i)
        rgba[sel, 0] = rgb[0]
        rgba[sel, 1] = rgb[1]
        rgba[sel, 2] = rgb[2]
        rgba[sel, 3] = 255

    img = Image.fromarray(rgba, mode="RGBA")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG", optimize=True)
    data_url = "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")

    return RasterOverlay(
        image_data_url=data_url,
        bounds=[float(v) for v in bounds_lnglat],
        label=f"Delta NDVI change {resolution_m:g} m (loss/gain/unchanged)",
        opacity=0.8,
        colormap="classes",
    )


def _hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
    h = hex_color.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)