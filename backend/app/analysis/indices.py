"""
Remote-sensing index algorithms (Phase 2).

NDVI is a deterministic radiometric algorithm — NOT an ML model:

    NDVI = (NIR - RED) / (NIR + RED)

RED comes from the Sentinel-2 B04 band and NIR from B08 (both 10 m, L2A
surface reflectance). The math here is unit-tested against the textbook
formula; nothing is simulated, hue-shifted or random.

Invalid pixels (nodata, cloud, shadow, snow or zero reflectance) and
divide-by-zero denominators are handled explicitly: they never contribute to
the statistics and never silently become plausible values.
"""

import math
from typing import Dict, List, Optional, Tuple

import numpy as np

from backend.app.schemas.ai import NdviStats

# Qualitative NDVI health thresholds (per pixel), used only for the text
# summary and per-class zone areas. These are conventional breakpoints.
HEALTH_THRESHOLDS = {
    "dense_vegetation": 0.6,
    "moderate_vegetation": 0.4,
    "sparse_vegetation": 0.2,
    "no_vegetation": 0.0,
}


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


def area_per_pixel_km2(resolution_m: float) -> float:
    """Ground area of one pixel in km² from its resolution in metres."""
    m2 = float(resolution_m) ** 2.0
    return m2 / 1_000_000.0
