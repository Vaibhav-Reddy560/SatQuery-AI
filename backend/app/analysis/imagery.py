"""
Imagery providers for real multi-spectral analysis (Phase 2).

Two interchangeable providers behind one protocol:

* ``SampleSentinel2Provider`` (default, fully offline)
    Reads a small REAL Sentinel-2 L2A cutout shipped with the repo under
    ``analysis/data/sample_ndvi/`` (B04=RED, B08=NIR, SCL cloud mask).
    Deterministic, no network, ideal for demos/CI. Regenerate the cutout with
    ``scripts/fetch_sentinel2_sample.py``.

* ``Sentinel2EarthSearchProvider`` (live, still free & keyless)
    Queries the public Element84 Earth Search STAC API for Sentinel-2 L2A
    scenes over the requested AOI and reads the corresponding Cloud-Optimized
    GeoTIFF bands (B04/B08/SCL) directly over HTTPS with windowed reads.
    No API key, no account; public service with no SLA.

Both providers return ``BandData``: the actual RED/NIR reflectance arrays
(float 0..1) plus a validity/cloud mask and full imagery provenance. NDVI is
computed from those arrays in ``indices.py`` — never simulated.

AOI rules (honesty first)
-------------------------
- If the frontend supplied a drawn AOI geometry or an explicit centre, the
  AOI is honoured whenever it intersects the imagery.
- If no AOI was supplied at all (the "Analyze vegetation" default case), the
  sample provider analyses its bundled scene and says so explicitly in the
  result metadata; the live provider requires an AOI and returns a structured
  error instead.
- AOIs that do not intersect the sample coverage raise ``OutsideSampleAOI``
  with guidance to switch to the live provider.
"""

import json
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Protocol, Tuple

import httpx
import numpy as np
import rasterio
import rasterio.windows
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.warp import transform_bounds

from backend.app.core.config import settings
from backend.app.schemas.ai import (
    AnalysisRequest,
    ImageryMetadata,
    PointGeometry,
    PolygonGeometry,
)

WGS84 = CRS.from_epsg(4326)
SCALE_FACTOR = 1.0 / 10000.0  # Sentinel-2 L2A uint16 reflectance scale

# Sentinel-2 SCL classes that hide the surface (nodata, saturated, cloud
# shadow, clouds incl. cirrus, snow). See L2A SCL documentation.
_SCL_MASKED = {0, 1, 3, 8, 9, 10, 11}

SAMPLE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "sample_ndvi")

# Bi-temporal change-detection sample: two REAL Sentinel-2 observations of
# the same Harike-wetland AOI at different dates, stored on the identical
# 10 m UTM grid so the pair is pixel-aligned by construction.
#   before/ = S2B_43RDQ_20251202 (dry season, cloud 0%)
#   after/  = S2B_43RDQ_20260829 (monsoon, cloud ~9.5%)
# See scripts/fetch_change_sample.py for provenance.
SAMPLE_CHANGE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "sample_change")

# When the request carries neither an explicit centre nor an AOI geometry the
# planner's default "India" centre is treated as "no AOI specified".
DEFAULT_INDIA_CENTRE = (78.9629, 20.5937)

# Live-fetch guard: analysing more than this span (deg) is refused with a
# structured error rather than pulling tens of megapixels per band.
MAX_AOI_SPAN_DEG = 0.12


# ── Typed errors ───────────────────────────────────────────────────────────

class ImageryError(Exception):
    """Base error for the imagery layer. Every error has a stable code."""

    code = "IMAGERY_ERROR"

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class InvalidAOI(ImageryError):
    code = "INVALID_AOI"


class OversizedAOI(ImageryError):
    code = "OVERSIZED_AOI"


class OutsideSampleAOI(ImageryError):
    code = "AOI_OUTSIDE_SAMPLE"


class NoAoiProvided(ImageryError):
    code = "NO_AOI"


class NoImageryFound(ImageryError):
    code = "NO_IMAGERY"


class ImageryUnavailable(ImageryError):
    code = "IMAGERY_UNAVAILABLE"


class MissingBand(ImageryError):
    code = "MISSING_BAND"


class EmptyScene(ImageryError):
    code = "EMPTY_SCENE"


# ── Shared data structures ─────────────────────────────────────────────────

@dataclass
class BandData:
    """Real RED/GREEN/NIR reflectance + cloud/valid mask + provenance."""

    red: np.ndarray            # float32 reflectance 0..1 (masked pixels: NaN)
    nir: np.ndarray            # float32 reflectance 0..1 (masked pixels: NaN)
    valid: np.ndarray          # bool; True where surface pixels are usable
    bounds_lnglat: Tuple[float, float, float, float]  # [west, south, east, north]
    resolution_m: float
    metadata: ImageryMetadata
    centre_lnglat: Tuple[float, float] = (0.0, 0.0)
    # GREEN (Sentinel-2 B03, 10 m) — used by the NDWI water pipeline. Fetched
    # alongside RED/NIR so the providers stay interchangeable; the NDVI
    # pipeline simply never reads it. Optional so tests can construct a
    # BandData without imagery that carries no green band.
    green: Optional[np.ndarray] = None
    # BLUE (Sentinel-2 B02, 10 m) — used to render true-colour RGB previews
    # for the vision-language pipeline (B04 RED + B03 GREEN + B02 BLUE).
    # Optional like GREEN so band-less test fixtures stay constructible.
    blue: Optional[np.ndarray] = None
    # Georeferencing of the returned grid (populated by providers; used by
    # bi-temporal change detection to verify/restore spatial alignment).
    crs: Optional[str] = None
    transform: Optional[Tuple[float, float, float, float, float, float]] = None


@dataclass
class TemporalPair:
    """Two real observations of the same AOI at different acquisition dates."""

    before: BandData
    after: BandData


class ImageryProvider(Protocol):
    """Fetches RED+NIR (+ cloud mask) over an AOI."""

    provider_name: str

    def fetch(self, request: AnalysisRequest) -> BandData:
        ...

    def fetch_pair(self, request: AnalysisRequest) -> TemporalPair:
        """Two observations of the same AOI: before (older) and after (newer)."""
        ...


# ── AOI helpers ────────────────────────────────────────────────────────────

def _is_default_centre(centre: Optional[List[float]]) -> bool:
    if not centre:
        return True
    return (
        abs(float(centre[0]) - DEFAULT_INDIA_CENTRE[0]) < 1e-4
        and abs(float(centre[1]) - DEFAULT_INDIA_CENTRE[1]) < 1e-4
    )


def requested_aoi(request: AnalysisRequest) -> Optional[Tuple[float, float, float, float]]:
    """
    Returns the AOI bounds the user actually asked for (west, south, east,
    north in lng/lat), or ``None`` when the request only carries the implicit
    default (no geometry, default India centre). Raises typed errors for
    malformed or oversized AOIs.
    """
    geometry = request.aoi_geometry
    has_geometry = isinstance(geometry, (PointGeometry, PolygonGeometry))
    has_explicit_centre = request.centre is not None and not _is_default_centre(request.centre)

    if not has_geometry and not has_explicit_centre:
        return None

    if isinstance(geometry, PolygonGeometry):
        ring = geometry.coordinates[0] if geometry.coordinates else []
        if len(ring) < 3:
            raise InvalidAOI("AOI polygon has fewer than 3 vertices.")
        lngs = [float(pt[0]) for pt in ring]
        lats = [float(pt[1]) for pt in ring]
        w, s, e, n = min(lngs), min(lats), max(lngs), max(lats)
    elif isinstance(geometry, PointGeometry):
        cx, cy = float(geometry.coordinates[0]), float(geometry.coordinates[1])
        w, s, e, n = cx - 0.005, cy - 0.005, cx + 0.005, cy + 0.005
    else:
        # Only an explicit centre -> small box around it.
        cx, cy = float(request.centre[0]), float(request.centre[1])
        w, s, e, n = cx - 0.005, cy - 0.005, cx + 0.005, cy + 0.005

    if not (-180.0 <= w <= 180.0 and -180.0 <= e <= 180.0 and -90.0 <= s <= 90.0 and -90.0 <= n <= 90.0):
        raise InvalidAOI(f"AOI bounds out of range: [{w}, {s}, {e}, {n}].")
    if not (w < e and s < n):
        raise InvalidAOI("AOI bounds are inverted or empty.")
    if (e - w) > MAX_AOI_SPAN_DEG or (n - s) > MAX_AOI_SPAN_DEG:
        raise OversizedAOI(
            f"AOI spans {(e - w):.3f}° x {(n - s):.3f}°, larger than the "
            f"{MAX_AOI_SPAN_DEG}° limit for real-time analysis."
        )
    return w, s, e, n


def intersection(a: Tuple[float, float, float, float], b: Tuple[float, float, float, float]):
    w, s = max(a[0], b[0]), max(a[1], b[1])
    e, n = min(a[2], b[2]), min(a[3], b[3])
    return None if (w >= e or s >= n) else (w, s, e, n)


# ── Sample provider (offline, real Sentinel-2 cutout) ──────────────────────

class SampleSentinel2Provider:
    """Reads the bundled real Sentinel-2 sample (default; no network)."""

    provider_name = "sample"

    def __init__(self, directory: str = SAMPLE_DIR, temporal_directory: Optional[str] = None) -> None:
        self.directory = directory
        self.temporal_directory = temporal_directory or SAMPLE_CHANGE_DIR
        metadata_path = os.path.join(directory, "metadata.json")
        if not os.path.exists(metadata_path):
            raise ImageryError(
                f"Sample imagery is missing metadata.json at {metadata_path}. "
                f"The bundled REAL Sentinel-2 cutout is not present in this "
                f"checkout. Regenerate it with: "
                f"python scripts/fetch_sentinel2_sample.py"
            )
        with open(metadata_path, "r", encoding="utf-8") as fh:
            self.metadata: dict = json.load(fh)
        self._band_paths = self._band_paths_for(directory)

    @staticmethod
    def _band_paths_for(directory: str) -> dict:
        paths = {
            "B02": os.path.join(directory, "B02.tif"),
            "B03": os.path.join(directory, "B03.tif"),
            "B04": os.path.join(directory, "B04.tif"),
            "B08": os.path.join(directory, "B08.tif"),
            "SCL": os.path.join(directory, "SCL.tif"),
        }
        for name, path in paths.items():
            if not os.path.exists(path):
                raise MissingBand(
                    f"Sample band {name} not found at {path}. "
                    f"Run: python scripts/fetch_sentinel2_sample.py"
                )
        return paths

    def sample_bounds(self) -> Tuple[float, float, float, float]:
        """
        Lng/lat coverage of the bundled sample, taken from the stored band's
        own georeferencing so a full-scene read returns exactly the stored
        pixel grid (no off-by-one rows from degree-based round-tripping).
        """
        with rasterio.open(self._band_paths["B04"]) as ds:
            w, s, e, n = transform_bounds(ds.crs, WGS84, *ds.bounds)
        return w, s, e, n

    def fetch(self, request: AnalysisRequest) -> BandData:
        w, s, e, n = self.sample_bounds()

        aoi = requested_aoi(request)
        if aoi is None:
            bounds = (w, s, e, n)  # whole bundled scene
        else:
            clipped = intersection(aoi, (w, s, e, n))
            if clipped is None:
                raise OutsideSampleAOI(
                    f"The requested AOI does not overlap the bundled sample scene "
                    f"(coverage ~[{w:.3f}, {s:.3f}, {e:.3f}, {n:.3f}]). Enable the live "
                    f"provider (SATQUERY_IMAGERY_PROVIDER=sentinel2) or pick an AOI "
                    f"inside the sample."
                )
            bounds = clipped

        return self._read_bands(self.directory, self.metadata, bounds)

    def fetch_pair(self, request: AnalysisRequest) -> TemporalPair:
        """
        Two REAL observations of the same AOI from the bundled temporal
        sample: ``before/`` (dry season, Dec 2025) and ``after/`` (monsoon,
        Aug 2026). Both are stored on the identical 10 m UTM grid, so the
        returned pair is pixel-aligned by construction.
        """
        before_dir = os.path.join(self.temporal_directory, "before")
        after_dir = os.path.join(self.temporal_directory, "after")
        for sub in (before_dir, after_dir):
            if not os.path.isdir(sub):
                raise ImageryError(
                    f"The bi-temporal sample directory {sub} is missing. "
                    f"Run: python scripts/fetch_change_sample.py"
                )

        with open(os.path.join(before_dir, "metadata.json"), "r", encoding="utf-8") as fh:
            before_meta: dict = json.load(fh)
        with open(os.path.join(after_dir, "metadata.json"), "r", encoding="utf-8") as fh:
            after_meta: dict = json.load(fh)

        before_paths = self._band_paths_for(before_dir)
        after_paths = self._band_paths_for(after_dir)

        # Same AOI for both dates. With no explicit AOI, use the sample's own
        # coverage (identical grid for both scenes).
        with rasterio.open(before_paths["B04"]) as ds:
            w, s, e, n = transform_bounds(ds.crs, WGS84, *ds.bounds)
        aoi = requested_aoi(request)
        if aoi is None:
            bounds = (w, s, e, n)
        else:
            clipped = intersection(aoi, (w, s, e, n))
            if clipped is None:
                raise OutsideSampleAOI(
                    f"The requested AOI does not overlap the bundled bi-temporal "
                    f"sample (coverage ~[{w:.3f}, {s:.3f}, {e:.3f}, {n:.3f}]). "
                    f"Enable the live provider or pick an AOI inside the sample."
                )
            bounds = clipped

        before = self._read_bands(before_dir, before_meta, bounds, band_paths=before_paths)
        after = self._read_bands(after_dir, after_meta, bounds, band_paths=after_paths)
        return TemporalPair(before=before, after=after)

    def _read_bands(
        self,
        directory: str,
        metadata: dict,
        bounds: Tuple[float, float, float, float],
        band_paths: Optional[dict] = None,
    ) -> BandData:
        paths = band_paths or self._band_paths
        blue, green, red, nir, scl = self._read_window(paths, bounds)
        cloud = np.isin(scl, list(_SCL_MASKED))
        valid = (red > 0) & (nir > 0) & (~cloud)

        blue_f = blue.astype(np.float32) * SCALE_FACTOR
        red_f = red.astype(np.float32) * SCALE_FACTOR
        green_f = green.astype(np.float32) * SCALE_FACTOR
        nir_f = nir.astype(np.float32) * SCALE_FACTOR
        blue_f[~valid] = np.nan
        red_f[~valid] = np.nan
        green_f[~valid] = np.nan
        nir_f[~valid] = np.nan

        meta = ImageryMetadata(
            provider="sample (bundled Sentinel-2 L2A cutout)",
            satellite="Sentinel-2",
            sensor="MSI",
            acquisition_date=metadata.get("acquisition_datetime"),
            resolution_m=float(metadata.get("pixel_size_m", 10)),
            crs=f"EPSG:{metadata.get('epsg', '')}",
            bands=["B02 (BLUE 10m)", "B03 (GREEN 10m)", "B04 (RED 10m)", "B08 (NIR 10m)", "SCL (cloud mask)"],
            scene_id=metadata.get("scene_id"),
            cloud_cover_percent=metadata.get("cloud_cover_percent"),
            processing_method=(
                "Sentinel-2 L2A surface reflectance (uint16 x10000); "
                "SCL cloud masking; sample provider (offline)."
            ),
        )
        # Georeferencing of the ACTUAL returned grid: the window that the
        # AOI clips out of the stored file (not the full-file transform), so
        # change detection can verify two dates sit on the same grid.
        transform = None
        with rasterio.open(paths["B04"]) as ds:
            target = transform_bounds(WGS84, ds.crs, *bounds)
            win = rasterio.windows.from_bounds(*target, transform=ds.transform)
            win = win.intersection(rasterio.windows.Window(0, 0, ds.width, ds.height))
            if win.width >= 1 and win.height >= 1:
                transform = tuple(round(v, 10) for v in ds.window_transform(win))[:6]
        return BandData(
            red=red_f,
            green=green_f,
            blue=blue_f,
            nir=nir_f,
            valid=valid,
            bounds_lnglat=bounds,
            resolution_m=float(metadata.get("pixel_size_m", 10)),
            metadata=meta,
            centre_lnglat=(float(metadata.get("center_lng", 0.0)),
                           float(metadata.get("center_lat", 0.0))),
            crs=meta.crs,
            transform=transform,
        )

    @staticmethod
    def _read_window(band_paths: dict, bounds: Tuple[float, float, float, float]):
        """Windowed read of the sample bands clipped to `bounds` (lng/lat)."""
        # Sample bands are stored in a projected CRS (UTM); convert the AOI.
        with rasterio.open(band_paths["B02"]) as blue_ds:
            target = transform_bounds(WGS84, blue_ds.crs, *bounds)
            win = rasterio.windows.from_bounds(*target, transform=blue_ds.transform)
            win = win.intersection(rasterio.windows.Window(0, 0, blue_ds.width, blue_ds.height))
            blue = blue_ds.read(1, window=win)
        with rasterio.open(band_paths["B03"]) as green_ds:
            target = transform_bounds(WGS84, green_ds.crs, *bounds)
            win = rasterio.windows.from_bounds(*target, transform=green_ds.transform)
            win = win.intersection(rasterio.windows.Window(0, 0, green_ds.width, green_ds.height))
            green = green_ds.read(1, window=win)
        with rasterio.open(band_paths["B04"]) as red_ds:
            target = transform_bounds(WGS84, red_ds.crs, *bounds)
            win = rasterio.windows.from_bounds(*target, transform=red_ds.transform)
            win = win.intersection(rasterio.windows.Window(0, 0, red_ds.width, red_ds.height))
            red = red_ds.read(1, window=win)
        with rasterio.open(band_paths["B08"]) as nir_ds:
            target = transform_bounds(WGS84, nir_ds.crs, *bounds)
            win = rasterio.windows.from_bounds(*target, transform=nir_ds.transform)
            win = win.intersection(rasterio.windows.Window(0, 0, nir_ds.width, nir_ds.height))
            nir = nir_ds.read(1, window=win)
        with rasterio.open(band_paths["SCL"]) as scl_ds:
            target = transform_bounds(WGS84, scl_ds.crs, *bounds)
            win = rasterio.windows.from_bounds(*target, transform=scl_ds.transform)
            win = win.intersection(rasterio.windows.Window(0, 0, scl_ds.width, scl_ds.height))
            scl = scl_ds.read(
                1, window=win, out_shape=green.shape, resampling=Resampling.nearest
            )
        return blue, green, red, nir, scl


# ── Live provider (Element84 Earth Search STAC, no key) ────────────────────

_STAC_URL = "https://earth-search.aws.element84.com/v1/search"
_COLLECTION = "sentinel-2-l2a"
_BAND_ASSETS = {"B02": "blue", "B03": "green", "B04": "red", "B08": "nir", "SCL": "scl"}


class Sentinel2EarthSearchProvider:
    """
    Live Sentinel-2 L2A COG retrieval via the public Earth Search STAC.

    Free, anonymous, no API key; public service without SLA. If the service is
    unreachable the caller receives a structured ``ImageryUnavailable`` error
    (never fake data). Windowed COG reads keep the download proportional to
    the AOI.
    """

    provider_name = "sentinel2"

    def __init__(self, lookback_days: int = 120, max_cloud: float = 60.0, client: Optional[httpx.Client] = None) -> None:
        self.lookback_days = lookback_days
        self.max_cloud = max_cloud
        self._client = client

    def fetch(self, request: AnalysisRequest) -> BandData:
        aoi = requested_aoi(request)
        if aoi is None:
            raise NoAoiProvided(
                "The live Sentinel-2 provider needs an area: select an AOI on the map "
                "or mention a location in the query (e.g. 'NDVI near Ludhiana')."
            )
        item = self._search_item(aoi)
        if item is None:
            raise NoImageryFound(
                f"No Sentinel-2 scene found for the requested AOI in the last "
                f"{self.lookback_days} days under {self.max_cloud:.0f}% cloud."
            )

        assets = item.get("assets", {})
        try:
            blue = self._read_asset(assets["blue"]["href"], aoi)
            green = self._read_asset(assets["green"]["href"], aoi)
            red = self._read_asset(assets["red"]["href"], aoi)
            nir = self._read_asset(assets["nir"]["href"], aoi)
            scl = self._read_asset(assets["scl"]["href"], aoi, out_shape=green.shape, nearest=True)
        except (KeyError, rasterio.errors.RasterioError) as exc:
            raise ImageryUnavailable(f"Could not read scene bands: {exc}") from exc

        if scl.shape != green.shape:
            scl = np.resize(scl, green.shape)
        valid = (red > 0) & (nir > 0) & (~np.isin(scl, list(_SCL_MASKED)))
        if int(valid.sum()) == 0:
            raise EmptyScene(
                "Scene has no usable (cloud-free, positive-reflectance) pixels for this AOI."
            )

        blue_f = blue.astype(np.float32) * SCALE_FACTOR
        green_f = green.astype(np.float32) * SCALE_FACTOR
        red_f = red.astype(np.float32) * SCALE_FACTOR
        nir_f = nir.astype(np.float32) * SCALE_FACTOR
        blue_f[~valid] = np.nan
        green_f[~valid] = np.nan
        red_f[~valid] = np.nan
        nir_f[~valid] = np.nan

        meta = ImageryMetadata(
            provider="Earth Search STAC (sentinel-2-l2a), live COG fetch",
            satellite="Sentinel-2",
            sensor="MSI",
            acquisition_date=item.get("properties", {}).get("datetime"),
            resolution_m=10.0,
            crs=f"EPSG:{item.get('properties', {}).get('proj:epsg', '')}",
            bands=["B02 (BLUE 10m)", "B03 (GREEN 10m)", "B04 (RED 10m)", "B08 (NIR 10m)", "SCL (cloud mask)"],
            scene_id=item.get("id"),
            cloud_cover_percent=item.get("properties", {}).get("eo:cloud_cover"),
            processing_method=(
                "Sentinel-2 L2A surface reflectance; windowed COG read; SCL cloud masking."
            ),
        )
        return BandData(
            green=green_f,
            red=red_f,
            blue=blue_f,
            nir=nir_f,
            valid=valid,
            bounds_lnglat=aoi,
            resolution_m=10.0,
            metadata=meta,
            centre_lnglat=((aoi[0] + aoi[2]) / 2.0, (aoi[1] + aoi[3]) / 2.0),
        )

    def fetch_pair(self, request: AnalysisRequest) -> TemporalPair:
        """
        Two REAL Sentinel-2 observations of the same AOI at different dates.

        Searches Earth Search for clear scenes and picks the two most recent
        distinct observations; if ``request.date_range`` supplies explicit
        before/after dates, the search is confined to those windows. Both
        scenes are read over the SAME AOI with the SAME target shape so the
        returned grids are pixel-aligned (documented in the result metadata).
        """
        aoi = requested_aoi(request)
        if aoi is None:
            raise NoAoiProvided(
                "The live Sentinel-2 provider needs an area for change detection: "
                "select an AOI on the map or mention a location in the query."
            )

        # Respect an explicit date window when the request carries one.
        before_window = None
        after_window = None
        date_range = request.date_range
        if date_range and (date_range.from_date or date_range.to_date):
            # Reject inverted temporal order instead of silently swapping.
            if date_range.from_date and date_range.to_date and date_range.from_date > date_range.to_date:
                raise InvalidAOI(
                    f"Invalid date range for change detection: from_date "
                    f"{date_range.from_date} is after to_date {date_range.to_date}."
                )
            after_window = (
                f"{date_range.from_date}/{date_range.to_date}"
                if date_range.from_date and date_range.to_date
                else None
            )
            if date_range.from_date:
                before_window = f"{date_range.from_date}/{date_range.to_date or 'now'}"

        before_item = self._search_item(aoi, window=before_window, newest=False)
        if before_item is None:
            raise NoImageryFound(
                f"No clear Sentinel-2 scene found for the 'before' date over this AOI. "
                f"Try widening the date range."
            )
        # Exclude the before scene itself so before/after are distinct dates.
        after_item = self._search_item(aoi, window=after_window, exclude_id=before_item.get("id"))
        if after_item is None:
            raise NoImageryFound(
                f"No clear Sentinel-2 scene found for the 'after' date over this AOI. "
                f"Try widening the date range."
            )

        before = self._read_item(aoi, before_item)
        after = self._read_item(aoi, after_item, target_shape=before.red.shape)
        return TemporalPair(before=before, after=after)

    def _read_item(
        self, aoi: Tuple[float, float, float, float], item: dict, target_shape: Optional[Tuple[int, int]] = None
    ) -> BandData:
        """Read one STAC item over the AOI (shared by fetch/fetch_pair)."""
        assets = item.get("assets", {})
        try:
            blue = self._read_asset(assets["blue"]["href"], aoi)
            green = self._read_asset(assets["green"]["href"], aoi)
            red = self._read_asset(assets["red"]["href"], aoi)
            nir = self._read_asset(assets["nir"]["href"], aoi)
            scl = self._read_asset(assets["scl"]["href"], aoi, out_shape=green.shape, nearest=True)
        except (KeyError, rasterio.errors.RasterioError) as exc:
            raise ImageryUnavailable(f"Could not read scene bands: {exc}") from exc

        if target_shape is not None and green.shape != target_shape:
            green = self._resample(green, target_shape)
            red = self._resample(red, target_shape)
            nir = self._resample(nir, target_shape)
            scl = self._resample(scl, target_shape, nearest=True)

        if scl.shape != green.shape:
            scl = np.resize(scl, green.shape)
        valid = (red > 0) & (nir > 0) & (~np.isin(scl, list(_SCL_MASKED)))
        if int(valid.sum()) == 0:
            raise EmptyScene(
                "Scene has no usable (cloud-free, positive-reflectance) pixels for this AOI."
            )

        blue_f = blue.astype(np.float32) * SCALE_FACTOR
        green_f = green.astype(np.float32) * SCALE_FACTOR
        red_f = red.astype(np.float32) * SCALE_FACTOR
        nir_f = nir.astype(np.float32) * SCALE_FACTOR
        blue_f[~valid] = np.nan
        green_f[~valid] = np.nan
        red_f[~valid] = np.nan
        nir_f[~valid] = np.nan

        meta = ImageryMetadata(
            provider="Earth Search STAC (sentinel-2-l2a), live COG fetch",
            satellite="Sentinel-2",
            sensor="MSI",
            acquisition_date=item.get("properties", {}).get("datetime"),
            resolution_m=10.0,
            crs=f"EPSG:{item.get('properties', {}).get('proj:epsg', '')}",
            bands=["B02 (BLUE 10m)", "B03 (GREEN 10m)", "B04 (RED 10m)", "B08 (NIR 10m)", "SCL (cloud mask)"],
            scene_id=item.get("id"),
            cloud_cover_percent=item.get("properties", {}).get("eo:cloud_cover"),
            processing_method=(
                "Sentinel-2 L2A surface reflectance; windowed COG read; SCL cloud masking."
            ),
        )
        return BandData(
            green=green_f,
            red=red_f,
            blue=blue_f,
            nir=nir_f,
            valid=valid,
            bounds_lnglat=aoi,
            resolution_m=10.0,
            metadata=meta,
            centre_lnglat=((aoi[0] + aoi[2]) / 2.0, (aoi[1] + aoi[3]) / 2.0),
            crs=meta.crs,
        )

    @staticmethod
    def _resample(arr: np.ndarray, shape: Tuple[int, int], nearest: bool = False) -> np.ndarray:
        """Explicit resample to a target grid (bilinear; nearest for classes)."""
        import scipy.ndimage as ndimage

        src = arr.astype(np.float32)
        scale_y = shape[0] / src.shape[0]
        scale_x = shape[1] / src.shape[1]
        order = 0 if nearest else 1
        out = ndimage.zoom(src, (scale_y, scale_x), order=order)
        return out.astype(arr.dtype)

    # ── internals ────────────────────────────────────────────────────────

    def _search_item(
        self,
        aoi: Tuple[float, float, float, float],
        window: Optional[str] = None,
        newest: bool = True,
        exclude_id: Optional[str] = None,
    ):
        end = datetime.now(timezone.utc)
        start = end - timedelta(days=self.lookback_days)
        if window:
            dt_range = window
        else:
            dt_range = f"{start.isoformat()}/{end.isoformat()}"
        query = {
            "collections": [_COLLECTION],
            "bbox": list(aoi),
            "datetime": dt_range,
            "limit": 16,
            "sortby": [
                {"field": "properties.datetime", "direction": "desc" if newest else "asc"}
            ],
        }
        try:
            if self._client is not None:
                resp = self._client.post(_STAC_URL, json=query)
            else:
                resp = httpx.post(_STAC_URL, json=query, timeout=45.0)
            resp.raise_for_status()
            features = resp.json().get("features", [])
        except Exception as exc:  # noqa: BLE001 - surface as structured error
            raise ImageryUnavailable(f"Earth Search STAC unreachable: {exc}") from exc

        usable = [
            f for f in features
            if (f.get("properties", {}).get("eo:cloud_cover") or 0) < self.max_cloud
            and (exclude_id is None or f.get("id") != exclude_id)
        ]
        if not usable:
            usable = [f for f in features if exclude_id is None or f.get("id") != exclude_id]
        return usable[0] if usable else None

    @staticmethod
    def _read_asset(href: str, aoi: Tuple[float, float, float, float], out_shape=None, nearest: bool = False):
        try:
            with rasterio.Env():
                with rasterio.open(href) as ds:
                    crs = ds.crs if ds.crs else WGS84
                    target = transform_bounds(WGS84, crs, *aoi)
                    window = rasterio.windows.from_bounds(*target, transform=ds.transform)
                    window = window.intersection(
                        rasterio.windows.Window(0, 0, ds.width, ds.height)
                    )
                    if window.width < 1 or window.height < 1:
                        raise EmptyScene("AOI does not intersect the scene extent.")
                    resampling = Resampling.nearest if nearest else Resampling.average
                    if out_shape is not None:
                        data = ds.read(1, window=window, out_shape=out_shape, resampling=resampling)
                    else:
                        data = ds.read(1, window=window, resampling=resampling)
            return data
        except rasterio.errors.RasterioError as exc:
            raise ImageryUnavailable(f"Failed to read COG {href}: {exc}") from exc


# ── Provider factory (cached) ──────────────────────────────────────────────

_PROVIDER_CACHE: dict = {}


def get_imagery_provider(name: Optional[str] = None) -> ImageryProvider:
    """Return the configured imagery provider instance (cached)."""
    provider_name = (name or settings.IMAGERY_PROVIDER or "sample").strip().lower()
    if provider_name not in _PROVIDER_CACHE:
        if provider_name == "sample":
            _PROVIDER_CACHE[provider_name] = SampleSentinel2Provider()
        elif provider_name == "sentinel2":
            _PROVIDER_CACHE[provider_name] = Sentinel2EarthSearchProvider(
                lookback_days=settings.SENTINEL2_LOOKBACK_DAYS,
                max_cloud=settings.SENTINEL2_MAX_CLOUD_PERCENT,
            )
        else:
            raise ImageryError(
                f"Unknown imagery provider '{provider_name}'. Use 'sample' or 'sentinel2'."
            )
    return _PROVIDER_CACHE[provider_name]
