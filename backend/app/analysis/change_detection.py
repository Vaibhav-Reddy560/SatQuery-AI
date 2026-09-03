"""
Bi-temporal change detection service — REAL multi-temporal pipeline (Phase 2E).

Pipeline implemented here:

    AnalysisRequest
        -> AOI resolution / validation        (imagery.requested_aoi)
        -> Temporal imagery provider           (sample offline pair | Sentinel-2 live pair)
        -> Two real Sentinel-2 observations   (same AOI, different dates)
        -> NDVI per date + SCL cloud masking  (indices.compute_ndvi)
        -> Spatial alignment verification      (change.align_pair)
        -> delta_ndvi = NDVI_after - NDVI_before
        -> Threshold classification            (change.classify_change)
        -> Change statistics + areas           (change.change_statistics)
        -> Georeferenced categorical overlay   (change.encode_change_overlay)
        -> Structured ChangeDetectionResult + summary

The algorithm is deterministic radiometric math — delta-NDVI differencing —
and is stamped ``model_kind=\"algorithm\"`` (never ML). Nothing is faked: if
either observation is unavailable, the grids cannot be aligned, or no pixel
is valid in both dates, a structured ``AnalysisServiceError`` is raised.
"""

from typing import List

from backend.app.analysis.base import AbstractAnalysisService, AnalysisServiceError
from backend.app.analysis.change import (
    CHANGE_CLASS_LABELS,
    align_pair,
    change_statistics,
    classify_change,
    compute_delta_ndvi,
    encode_change_overlay,
    resolve_change_threshold,
)
from backend.app.analysis.imagery import (
    ImageryError,
    TemporalPair,
    get_imagery_provider,
)
from backend.app.schemas.ai import (
    AnalysisRequest,
    ChangeDetectionResult,
    ChangeItem,
    ImageryMetadata,
)

_ALGORITHM_ID = "delta-ndvi"
_ALGORITHM_VERSION = "1.0.0"


class ChangeDetectionService(AbstractAnalysisService):
    tool_id = "change_detector"
    model_task = "change_detection"
    OVERALL_CONFIDENCE = 0.9

    def analyze(self, request: AnalysisRequest) -> ChangeDetectionResult:
        provider = get_imagery_provider()

        try:
            pair: TemporalPair = provider.fetch_pair(request)
        except ImageryError as exc:
            raise AnalysisServiceError(
                code=exc.code,
                user_message=(
                    f"Change detection could not run: {exc.message} "
                    f"[provider: {provider.provider_name}]"
                ),
            ) from exc
        except AttributeError as exc:
            raise AnalysisServiceError(
                code="TEMPORAL_UNAVAILABLE",
                user_message=(
                    "The configured imagery provider does not support "
                    "two-date retrieval, so change detection cannot run. "
                    "Use the sample or sentinel2 provider."
                ),
            ) from exc

        before, after = pair.before, pair.after

        # 1. Spatial alignment FIRST: both observations must sit on the same
        #    grid before any per-pixel difference is meaningful. Identical
        #    grids (the bundled sample pair) pass through untouched; mismatched
        #    grids are resampled onto the before grid or fail structurally.
        red_before, red_after, valid_red = align_pair(
            before.red, after.red, before.valid, after.valid,
            before.crs or "", after.crs or "",
            before.transform or (), after.transform or (),
        )
        nir_before, nir_after, valid_nir = align_pair(
            before.nir, after.nir, before.valid, after.valid,
            before.crs or "", after.crs or "",
            before.transform or (), after.transform or (),
        )
        valid_both = valid_red & valid_nir

        # 2. NDVI per date over the aligned, cloud-masked pixels, then ΔNDVI.
        delta_ndvi, valid_both = compute_delta_ndvi(
            red_before, nir_before, valid_both,
            red_after, nir_after, valid_both,
        )

        threshold = resolve_change_threshold(request)

        # 3. Threshold classification.
        classes = classify_change(delta_ndvi, valid_both, threshold)

        # 4. Statistics + areas (resolution from the actual raster).
        stats = change_statistics(delta_ndvi, valid_both, classes, before.resolution_m)

        # 5. Georeferenced categorical overlay.
        overlay = encode_change_overlay(
            classes, valid_both, before.bounds_lnglat, before.resolution_m
        )

        location = self._location_of(request)
        if location in ("Selected AOI", "Selected Region", "Target Area"):
            lat, lng = before.centre_lnglat
            location = f"AOI at {lat:.3f}°, {lng:.3f}°"

        # Structured change items mirroring the aggregate classes (honest
        # per-class descriptions, real areas).
        changes: List[ChangeItem] = [
            ChangeItem(
                id="change-loss",
                type="loss",
                description=(
                    f"Vegetation cover decrease: {stats.loss_percentage:.1f}% of "
                    f"valid pixels (delta NDVI <= -{threshold:.2f})"
                ),
                area_km2=round(stats.loss_area_km2, 4),
                confidence=self.OVERALL_CONFIDENCE,
            ),
            ChangeItem(
                id="change-gain",
                type="gain",
                description=(
                    f"Vegetation cover increase: {stats.gain_percentage:.1f}% of "
                    f"valid pixels (delta NDVI >= +{threshold:.2f})"
                ),
                area_km2=round(stats.gain_area_km2, 4),
                confidence=self.OVERALL_CONFIDENCE,
            ),
        ]

        summary = _summary_text(
            location, before.metadata, after.metadata, stats, threshold
        )

        return ChangeDetectionResult(
            kind="change",
            tool_id=self.tool_id,
            location=location,
            centre=before.centre_lnglat and [before.centre_lnglat[0], before.centre_lnglat[1]],
            confidence=self.OVERALL_CONFIDENCE,
            model=_ALGORITHM_ID,
            model_version=_ALGORITHM_VERSION,
            mode="live",
            model_kind="algorithm",
            summary_text=summary,
            before_date=before.metadata.acquisition_date or "",
            after_date=after.metadata.acquisition_date or "",
            total_area_changed_km2=round(stats.changed_area_km2, 4),
            changes=changes,
            before_imagery=before.metadata,
            after_imagery=after.metadata,
            change_stats=stats,
            threshold=round(threshold, 4),
            change_method="delta_ndvi",
            overlay=overlay,
        )


def _summary_text(
    location: str,
    before_meta: ImageryMetadata,
    after_meta: ImageryMetadata,
    stats,
    threshold: float,
) -> str:
    b_date = before_meta.acquisition_date or "unknown"
    a_date = after_meta.acquisition_date or "unknown"
    b_scene = before_meta.scene_id or "unknown scene"
    a_scene = after_meta.scene_id or "unknown scene"
    return (
        f"Real change detection over {location} comparing two Sentinel-2 "
        f"observations: {b_scene} (acquired {b_date}) and {a_scene} "
        f"(acquired {a_date}), both SCL cloud-masked. "
        f"delta NDVI = NDVI_after - NDVI_before with threshold "
        f"|delta NDVI| >= {threshold:.2f} (vegetation loss where delta NDVI <= "
        f"-{threshold:.2f}, gain where delta NDVI >= +{threshold:.2f}). "
        f"Of {stats.valid_pixel_count:,} pixels valid in both dates "
        f"({stats.total_area_km2:.2f} km²): unchanged "
        f"{stats.unchanged_percentage:.1f}%, vegetation loss "
        f"{stats.loss_percentage:.1f}% ({stats.loss_area_km2:.2f} km²), "
        f"vegetation gain {stats.gain_percentage:.1f}% "
        f"({stats.gain_area_km2:.2f} km²). "
        f"Caution: spectral differences also reflect seasonal/agricultural "
        f"cycles, illumination and sensor effects — not every changed pixel "
        f"is real land-use change. "
        f"[algorithm: {_ALGORITHM_ID} v{_ALGORITHM_VERSION} (radiometric, not ML); "
        f"provider: {before_meta.provider}]"
    )


change_detection_service = ChangeDetectionService()