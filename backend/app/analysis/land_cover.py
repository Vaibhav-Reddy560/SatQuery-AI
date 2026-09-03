"""
Land cover classification service — REAL trained ML pipeline (Phase 2D).

Pipeline implemented here:

    AnalysisRequest
        -> AOI resolution / validation          (imagery.requested_aoi)
        -> Imagery provider                      (sample offline | Sentinel-2 live)
        -> Band retrieval (B03 GREEN + B04 RED + B08 NIR + SCL cloud mask)
        -> Spectral features per pixel           (B03/B04/B08 + NDVI + NDWI)
        -> Trained random-forest classifier      (ml.landcover; see model card)
        -> Class statistics + categorical overlay
        -> Structured LandCoverResult + summary

The classifier is genuine supervised ML trained on real open data (ESA
WorldCover 2021 labels + Sentinel-2 L2A reflectance; see
``scripts/train_landcover_classifier.py``). It is NOT a hand-written rule
system, and it is clearly stamped ``model_kind=\"ml\"`` — unlike the NDVI/NDWI
algorithms, which are radiometric math and never labelled as ML. Nothing is
faked: if imagery is unavailable or a band is missing, a structured
``AnalysisServiceError`` is raised instead of returning plausible-looking
percentages.
"""

import base64
import io
from typing import Tuple

import numpy as np
from PIL import Image

from backend.app.analysis.base import AbstractAnalysisService, AnalysisServiceError
from backend.app.analysis.imagery import (
    DEFAULT_INDIA_CENTRE,
    ImageryError,
    get_imagery_provider,
)
from backend.app.analysis.indices import area_per_pixel_km2, downsample_raster
from backend.app.ml.landcover import CLASS_NAMES, FEATURE_NAMES
from backend.app.schemas.ai import (
    AnalysisRequest,
    LandCoverClass,
    LandCoverResult,
    RasterOverlay,
)

_OVERLAY_MAX_SIDE = 420

# Legend colors — the EXACT colours used for both the result classes and the
# classification overlay, so the map legend always matches the pixels.
CLASS_COLORS = {
    "water": "#2563eb",
    "vegetation": "#22c55e",
    "built_up": "#dc2626",
    "bare": "#ca8a04",
}

CLASS_LABELS = {
    "water": "Water",
    "vegetation": "Vegetation",
    "built_up": "Built-up",
    "bare": "Bare soil",
}

# Honest fallback if the model card is unavailable: the held-out balanced
# accuracy measured when the shipped artifact was trained (see model card).
_DEFAULT_CONFIDENCE = 0.78


def build_landcover_features(bands):
    """
    Build the per-pixel feature matrix from provider bands.

    Returns ``(X, valid)``: ``X`` is (n_valid, 5) float32 in FEATURE_NAMES
    order [B03 green, B04 red, B08 nir, NDVI, NDWI]; ``valid`` is the boolean
    grid of pixels that entered the model (finite bands, positive
    reflectance, cloud/nodata masked, finite indices).
    """
    if bands.green is None:
        raise AnalysisServiceError(
            code="MISSING_BAND",
            user_message=(
                "The imagery provider did not return the GREEN (B03) band "
                "required for land-cover classification."
            ),
        )
    green = np.asarray(bands.green, dtype=np.float32)
    red = np.asarray(bands.red, dtype=np.float32)
    nir = np.asarray(bands.nir, dtype=np.float32)

    valid = (
        np.asarray(bands.valid, dtype=bool)
        & np.isfinite(green)
        & np.isfinite(red)
        & np.isfinite(nir)
        & (green > 0)
        & (red > 0)
        & (nir > 0)
    )
    with np.errstate(divide="ignore", invalid="ignore"):
        ndvi = (nir - red) / (nir + red)
        ndwi = (green - nir) / (green + nir)
    valid &= np.isfinite(ndvi) & np.isfinite(ndwi)

    stack = np.stack([green, red, nir, ndvi, ndwi], axis=-1)
    X = stack[valid].astype(np.float32)
    return X, valid


class LandCoverService(AbstractAnalysisService):
    tool_id = "land_cover_classifier"
    model_task = "land_cover"

    def analyze(self, request: AnalysisRequest) -> LandCoverResult:
        provider = get_imagery_provider()

        try:
            bands = provider.fetch(request)
        except ImageryError as exc:
            raise AnalysisServiceError(
                code=exc.code,
                user_message=(
                    f"Land-cover classification could not run: {exc.message} "
                    f"[provider: {provider.provider_name}]"
                ),
            ) from exc

        X, valid = build_landcover_features(bands)
        if X.shape[0] == 0:
            raise AnalysisServiceError(
                code="EMPTY_RESULT",
                user_message=(
                    "The scene for this AOI contains no usable pixels after "
                    "cloud/validity masking — try a different AOI or date."
                ),
            )

        model = self._model()
        try:
            model.load()
        except (FileNotFoundError, RuntimeError) as exc:
            raise AnalysisServiceError(
                code="MODEL_UNAVAILABLE",
                user_message=(
                    "The land-cover classifier is not available in this "
                    "deployment (model artifact missing or unreadable). "
                    "No classification was run."
                ),
            ) from exc
        predicted = model.predict_classes(X)

        classes_grid = np.full(valid.shape, "", dtype=object)
        classes_grid[valid] = predicted

        px_km2 = area_per_pixel_km2(bands.resolution_m)
        n_valid = int(valid.sum())
        total_area_km2 = round(n_valid * px_km2, 4)

        class_stats: list[LandCoverClass] = []
        for cls in CLASS_NAMES:
            count = int((classes_grid == cls).sum())
            pct = 100.0 * count / max(1, n_valid)
            class_stats.append(
                LandCoverClass(
                    name=CLASS_LABELS[cls],
                    code=cls,
                    percentage=round(pct, 1),
                    area_km2=round(count * px_km2, 4),
                    color=CLASS_COLORS[cls],
                )
            )

        overlay = _encode_overlay(classes_grid, valid, bands.bounds_lnglat, bands.resolution_m)

        location = self._location_of(request)
        if location in ("Selected AOI", "Selected Region", "Target Area"):
            lat, lng = bands.centre_lnglat
            location = f"AOI at {lat:.3f}°, {lng:.3f}°"

        confidence = _model_confidence(model)

        summary = _summary_text(
            location, model, bands, class_stats, total_area_km2, confidence
        )

        # Centre reflects the imagery actually analysed. When the client sent
        # only the implicit default centre, report the scene centre instead.
        centre = request.centre if request.centre else None
        if centre is None or (
            abs(centre[0] - DEFAULT_INDIA_CENTRE[0]) < 1e-4
            and abs(centre[1] - DEFAULT_INDIA_CENTRE[1]) < 1e-4
        ):
            centre = [bands.centre_lnglat[0], bands.centre_lnglat[1]]

        return LandCoverResult(
            kind="land_cover",
            tool_id=self.tool_id,
            location=location,
            centre=centre,
            confidence=confidence,
            model=model.model_name,
            model_version=model.model_version,
            mode="live",
            model_kind="ml",
            summary_text=summary,
            total_area_km2=total_area_km2,
            classes=class_stats,
            model_inputs=list(FEATURE_NAMES),
            imagery=bands.metadata,
            overlay=overlay,
        )


# ── Output helpers ─────────────────────────────────────────────────────────

def _model_confidence(model) -> float:
    """Honest confidence: the measured held-out balanced accuracy of the
    shipped artifact, taken from its model card (never invented)."""
    meta = model.model_card()
    if meta:
        training = meta.get("training", {})
        balanced = training.get("holdout_balanced_accuracy")
        if isinstance(balanced, (int, float)) and 0.0 <= balanced <= 1.0:
            return round(float(balanced), 2)
    return _DEFAULT_CONFIDENCE


def _summary_text(location, model, bands, classes, total_area_km2: float, confidence: float) -> str:
    date = bands.metadata.acquisition_date or "unknown"
    scene = bands.metadata.scene_id or "sample scene"
    dominant = max(classes, key=lambda c: c.percentage)
    breakdown = ", ".join(
        f"{c.name} {c.percentage:.1f}% ({c.area_km2:.2f} km²)"
        for c in sorted(classes, key=lambda c: c.percentage, reverse=True)
    )
    return (
        f"Real land-cover classification over {location} using {model.model_name} "
        f"(random forest, trained on ESA WorldCover 2021 + Sentinel-2 L2A; "
        f"held-out balanced accuracy {confidence:.2f}): {breakdown}. "
        f"Dominant class: {dominant.name} ({dominant.percentage:.1f}%). "
        f"Scene {scene} (acquired {date}, cloud-masked); {total_area_km2:.2f} km² "
        f"of valid surface pixels classified. "
        f"[model kind: ML; inputs: {' + '.join(FEATURE_NAMES)}; "
        f"provider: {bands.metadata.provider}; imagery metadata included in this result.]"
    )


def _encode_overlay(
    classes_grid: np.ndarray,
    valid: np.ndarray,
    bounds_lnglat: Tuple[float, float, float, float],
    resolution_m: float,
) -> RasterOverlay:
    """
    Encode the classification as a categorical georeferenced PNG data URL.

    Each classified pixel is drawn in its class's legend colour (fully
    opaque); invalid/cloud-masked pixels are transparent. Downsampled to
    ``_OVERLAY_MAX_SIDE`` for display, matching the NDVI/NDWI overlays.
    """
    idx = np.zeros(classes_grid.shape, dtype=np.float32)
    for i, cls in enumerate(CLASS_NAMES, start=1):
        idx[classes_grid == cls] = float(i)

    mask = np.asarray(valid, dtype=bool)
    if max(idx.shape) > _OVERLAY_MAX_SIDE:
        idx, mask = downsample_raster(idx, mask, _OVERLAY_MAX_SIDE)
    idx = np.round(idx).astype(np.int16)

    rgba = np.zeros((*idx.shape, 4), dtype=np.uint8)
    for i, cls in enumerate(CLASS_NAMES, start=1):
        rgb = _hex_to_rgb(CLASS_COLORS[cls])
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
        label=f"Land cover {resolution_m:g} m classification",
        opacity=1.0,
        colormap="classes",
    )


def _hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
    h = hex_color.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


land_cover_service = LandCoverService()