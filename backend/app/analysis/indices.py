"""
Remote-sensing index algorithms (Phase 2).

Both indices are deterministic radiometric algorithms — NOT ML models:

    NDVI = (NIR - RED) / (NIR + RED)      RED from Sentinel-2 B04, NIR from B08
    NDWI = (GREEN - NIR) / (GREEN + NIR)  GREEN from Sentinel-2 B03, NIR from B08

Do not confuse NDWI with NDVI: they share the B08 NIR band but NDWI compares
it against GREEN (B03), which is what makes water surfaces strongly positive
(water reflects green and absorbs NIR). The math here is unit-tested against
the textbook formulas; nothing is simulated, hue-shifted or random.

Invalid pixels (nodata, cloud, shadow, snow or zero reflectance) and
divide-by-zero denominators are handled explicitly: they never contribute to
the statistics and never silently become plausible values.
"""

import math
from typing import Dict, List, Optional, Tuple

import numpy as np

from backend.app.schemas.ai import NdviStats, NdwiStats

# Qualitative NDVI health thresholds (per pixel), used only for the text
# summary and per-class zone areas. These are conventional breakpoints.
HEALTH_THRESHOLDS = {
    "dense_vegetation": 0.6,
    "moderate_vegetation": 0.4,
    "sparse_vegetation": 0.2,
    "no_vegetation": 0.0,
}

# Default water classification threshold for NDWI. Pixels with
# NDWI >= 0.0 are classified as water — a conventional, published breakpoint
# (McFeeters 1996). It is explicit and configurable per request (see
# water_detection.py), never silently derived from the sample.
DEFAULT_WATER_THRESHOLD = 0.0


def compute_ndvi(
    red: np.ndarray,
    nir: np.ndarray,
    valid: Optional[np.ndarray] = None,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Compute NDVI from RED/NIR reflectance arrays.

    Returns ``(ndvi, valid)`` where ``ndvi`` is float32 with ``np.nan`` on
    every invalid pixel and ``valid`` is the boolean mask of pixels that
    entered the calculation (finite bands, positive reflectance, denom > 0).
    Accepts 1-D/2-D arrays; broadcasting shapes are supported.
    """
    red = np.asarray(red, dtype=np.float64)
    nir = np.asarray(nir, dtype=np.float64)

    valid_bands = np.isfinite(red) & np.isfinite(nir) & (red >= 0) & (nir >= 0)
    if valid is not None:
        valid_bands &= np.asarray(valid, dtype=bool)

    denominator = nir + red
    numerator = nir - red

    ndvi = np.full(red.shape, np.nan, dtype=np.float32)
    safe = valid_bands & (denominator > 1e-12)  # divide-by-zero protection
    ndvi[safe] = (numerator[safe] / denominator[safe]).astype(np.float32)
    return ndvi, safe


def ndvi_stats(ndvi: np.ndarray, valid: np.ndarray, total_pixels: Optional[int] = None) -> Optional[NdviStats]:
    """
    Statistics over valid NDVI pixels only.

    ``total_pixels`` (default: full array size) is used for the valid-pixel
    percentage; valid pixels are those that produced a finite NDVI.
    Returns ``None`` when there is nothing valid to summarise.
    """
    # Statistics are computed in float64 on the float32 NDVI grid so the
    # reported values keep full precision (no fabricated/truncated numbers).
    values = np.asarray(ndvi, dtype=np.float32)
    mask = np.asarray(valid, dtype=bool) & np.isfinite(values)
    n_valid = int(mask.sum())
    if n_valid == 0:
        return None

    total = total_pixels if total_pixels is not None else int(values.size)
    subset = values[mask].astype(np.float64)

    std = float(np.std(subset)) if n_valid > 1 else 0.0
    return NdviStats(
        min=float(np.min(subset)),
        max=float(np.max(subset)),
        mean=float(np.mean(subset)),
        median=float(np.median(subset)),
        std=std,
        valid_pixel_percentage=100.0 * n_valid / max(1, total),
    )


def classify_ndvi(
    ndvi: np.ndarray,
    valid: np.ndarray,
    area_per_pixel_km2: float,
) -> Tuple[List[Dict[str, object]], Dict[str, float]]:
    """
    Break the valid NDVI pixels into qualitative health zones.

    Returns ``(zones, used_thresholds)``. ``zones`` items carry ``status``
    (one of healthy/stressed/degraded/loss, matching the result schema),
    ``fraction`` (of valid pixels) and ``area_km2``.
    """
    values = np.asarray(ndvi, dtype=np.float32)
    mask = np.asarray(valid, dtype=bool) & np.isfinite(values)
    total_valid = int(mask.sum())

    # Zone boundaries (inclusive lower, exclusive upper).
    ranges = [
        ("healthy", HEALTH_THRESHOLDS["moderate_vegetation"], None),
        ("stressed", HEALTH_THRESHOLDS["sparse_vegetation"], HEALTH_THRESHOLDS["moderate_vegetation"]),
        ("degraded", HEALTH_THRESHOLDS["no_vegetation"], HEALTH_THRESHOLDS["sparse_vegetation"]),
        ("loss", None, HEALTH_THRESHOLDS["no_vegetation"]),
    ]
    zones: List[Dict[str, object]] = []
    for status, lo, hi in ranges:
        if hi is None:
            sel = mask & (values >= (lo or 0.0))
        elif lo is None:
            sel = mask & (values < hi)
        else:
            sel = mask & (values >= lo) & (values < hi)
        count = int(sel.sum())
        zones.append({
            "status": status,
            "count": count,
            "fraction": round(count / max(1, total_valid), 4),
            "area_km2": round(count * area_per_pixel_km2, 4),
        })

    return zones, dict(HEALTH_THRESHOLDS)


def compute_ndwi(
    green: np.ndarray,
    nir: np.ndarray,
    valid: Optional[np.ndarray] = None,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Compute NDWI from GREEN/NIR reflectance arrays.

        NDWI = (GREEN - NIR) / (GREEN + NIR)

    Returns ``(ndwi, valid)`` where ``ndwi`` is float32 with ``np.nan`` on
    every invalid pixel and ``valid`` is the boolean mask of pixels that
    entered the calculation (finite bands, non-negative reflectance,
    denominator > 0). Accepts 1-D/2-D arrays; broadcasting shapes are
    supported. Mirrors ``compute_ndvi`` exactly, so the two pipelines share
    identical masking semantics.
    """
    green = np.asarray(green, dtype=np.float64)
    nir = np.asarray(nir, dtype=np.float64)

    valid_bands = np.isfinite(green) & np.isfinite(nir) & (green >= 0) & (nir >= 0)
    if valid is not None:
        valid_bands &= np.asarray(valid, dtype=bool)

    denominator = green + nir
    numerator = green - nir

    ndwi = np.full(green.shape, np.nan, dtype=np.float32)
    safe = valid_bands & (denominator > 1e-12)  # divide-by-zero protection
    ndwi[safe] = (numerator[safe] / denominator[safe]).astype(np.float32)
    return ndwi, safe


def ndwi_stats(
    ndwi: np.ndarray,
    valid: np.ndarray,
    total_pixels: Optional[int] = None,
    water_threshold: float = DEFAULT_WATER_THRESHOLD,
) -> Optional[NdwiStats]:
    """
    Statistics over valid NDWI pixels only, plus the share of pixels above
    ``water_threshold`` (default 0.0, NDWI >= 0 = water). ``total_pixels``
    (default: full array size) is used for the valid-pixel percentage.
    Returns ``None`` when there is nothing valid to summarise.
    """
    values = np.asarray(ndwi, dtype=np.float32)
    mask = np.asarray(valid, dtype=bool) & np.isfinite(values)
    n_valid = int(mask.sum())
    if n_valid == 0:
        return None

    total = total_pixels if total_pixels is not None else int(values.size)
    subset = values[mask].astype(np.float64)

    n_water = int((mask & (values >= float(water_threshold))).sum())
    std = float(np.std(subset)) if n_valid > 1 else 0.0
    return NdwiStats(
        min=float(np.min(subset)),
        max=float(np.max(subset)),
        mean=float(np.mean(subset)),
        median=float(np.median(subset)),
        std=std,
        valid_pixel_percentage=100.0 * n_valid / max(1, total),
        water_pixel_percentage=100.0 * n_water / max(1, n_valid),
    )


def water_mask(
    ndwi: np.ndarray,
    valid: np.ndarray,
    water_threshold: float = DEFAULT_WATER_THRESHOLD,
) -> np.ndarray:
    """Boolean mask of water pixels: valid pixels with NDWI >= threshold."""
    values = np.asarray(ndwi, dtype=np.float32)
    mask = np.asarray(valid, dtype=bool) & np.isfinite(values)
    return mask & (values >= float(water_threshold))


def downsample_raster(
    grid: np.ndarray,
    mask: np.ndarray,
    max_side: int,
) -> Tuple[np.ndarray, np.ndarray]:
    """Block-mean downsample of a float grid (+ boolean mask) for display.

    Keeps overlay payloads small while statistics continue to run on the
    full-resolution grid.
    """
    factor = math.ceil(max(grid.shape) / max_side)
    h, w = grid.shape
    rows, cols = h - (h % factor), w - (w % factor)
    g = grid[:rows, :cols].reshape(rows // factor, factor, cols // factor, factor)
    m = mask[:rows, :cols].reshape(rows // factor, factor, cols // factor, factor)
    out_grid = g.mean(axis=(1, 3))
    out_mask = m.any(axis=(1, 3))
    return out_grid.astype(np.float32), out_mask


def area_per_pixel_km2(resolution_m: float) -> float:
    """Ground area of one pixel in km² from its resolution in metres."""
    m2 = float(resolution_m) ** 2.0
    return m2 / 1_000_000.0
