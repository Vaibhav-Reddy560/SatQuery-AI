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
    """Real RED/NIR reflectance + cloud/valid mask + provenance for one AOI."""

    red: np.ndarray            # float32 reflectance 0..1 (masked pixels: NaN)
    nir: np.ndarray            # float32 reflectance 0..1 (masked pixels: NaN)
    valid: np.ndarray          # bool; True where surface pixels are usable
    bounds_lnglat: Tuple[float, float, float, float]  # [west, south, east, north]
    resolution_m: float
    metadata: ImageryMetadata
    centre_lnglat: Tuple[float, float] = (0.0, 0.0)


class ImageryProvider(Protocol):
    """Fetches RED+NIR (+ cloud mask) over an AOI."""

    provider_name: str

    def fetch(self, request: AnalysisRequest) -> BandData:
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

    def __init__(self, directory: str = SAMPLE_DIR) -> None:
        self.directory = directory
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
        self._band_paths = {
            "B04": os.path.join(directory, "B04.tif"),
            "B08": os.path.join(directory, "B08.tif"),
            "SCL": os.path.join(directory, "SCL.tif"),
        }
        for name, path in self._band_paths.items():
            if not os.path.exists(path):
                raise MissingBand(
                    f"Sample band {name} not found at {path}. "
                    f"Run: python scripts/fetch_sentinel2_sample.py"
                )

    def sample_bounds(self) -> Tuple[float, float, float, float]:
        """Lng/lat coverage of the bundled sample."""
        lat = float(self.metadata.get("center_lat", 0.0))
        lng = float(self.metadata.get("center_lng", 0.0))
        pixels = float(self.metadata.get("pixels", 224))
        res = float(self.metadata.get("pixel_size_m", 10))
        half_lat = pixels * res / 2.0 / 111320.0
        half_lng = pixels * res / 2.0 / (111320.0 * max(0.2, float(np.cos(np.radians(lat)))))
        return lng - half_lng, lat - half_lat, lng + half_lng, lat + half_lat

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

        red, nir, scl = self._read_window(bounds)
        cloud = np.isin(scl, list(_SCL_MASKED))
        valid = (red > 0) & (nir > 0) & (~cloud)

        red_f = red.astype(np.float32) * SCALE_FACTOR
        nir_f = nir.astype(np.float32) * SCALE_FACTOR
        red_f[~valid] = np.nan
        nir_f[~valid] = np.nan

        meta = ImageryMetadata(
            provider="sample (bundled Sentinel-2 L2A cutout)",
            satellite="Sentinel-2",
            sensor="MSI",
            acquisition_date=self.metadata.get("acquisition_datetime"),
            resolution_m=float(self.metadata.get("pixel_size_m", 10)),
            crs=f"EPSG:{self.metadata.get('epsg', '')}",
            bands=["B04 (RED 10m)", "B08 (NIR 10m)", "SCL (cloud mask)"],
            scene_id=self.metadata.get("scene_id"),
            cloud_cover_percent=self.metadata.get("cloud_cover_percent"),
            processing_method=(
                "Sentinel-2 L2A surface reflectance (uint16 x10000); "
                "SCL cloud masking; sample provider (offline)."
            ),
        )
        return BandData(
            red=red_f,
            nir=nir_f,
            valid=valid,
            bounds_lnglat=bounds,
            resolution_m=float(self.metadata.get("pixel_size_m", 10)),
            metadata=meta,
            centre_lnglat=(float(self.metadata.get("center_lng", 0.0)),
                           float(self.metadata.get("center_lat", 0.0))),
        )

    def _read_window(self, bounds: Tuple[float, float, float, float]):
        """Windowed read of the sample bands clipped to `bounds` (lng/lat)."""
        # Sample bands are stored in a projected CRS (UTM); convert the AOI.
        with rasterio.open(self._band_paths["B04"]) as red_ds:
            target = transform_bounds(WGS84, red_ds.crs, *bounds)
            win = rasterio.windows.from_bounds(*target, transform=red_ds.transform)
            win = win.intersection(rasterio.windows.Window(0, 0, red_ds.width, red_ds.height))
            red = red_ds.read(1, window=win)
        with rasterio.open(self._band_paths["B08"]) as nir_ds:
            target = transform_bounds(WGS84, nir_ds.crs, *bounds)
            win = rasterio.windows.from_bounds(*target, transform=nir_ds.transform)
            win = win.intersection(rasterio.windows.Window(0, 0, nir_ds.width, nir_ds.height))
            nir = nir_ds.read(1, window=win)
        with rasterio.open(self._band_paths["SCL"]) as scl_ds:
            target = transform_bounds(WGS84, scl_ds.crs, *bounds)
            win = rasterio.windows.from_bounds(*target, transform=scl_ds.transform)
            win = win.intersection(rasterio.windows.Window(0, 0, scl_ds.width, scl_ds.height))
            scl = scl_ds.read(
                1, window=win, out_shape=red.shape, resampling=Resampling.nearest
            )
        return red, nir, scl


# ── Live provider (Element84 Earth Search STAC, no key) ────────────────────

_STAC_URL = "https://earth-search.aws.element84.com/v1/search"
_COLLECTION = "sentinel-2-l2a"
_BAND_ASSETS = {"B04": "red", "B08": "nir", "SCL": "scl"}


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
            red = self._read_asset(assets["red"]["href"], aoi)
            nir = self._read_asset(assets["nir"]["href"], aoi)
            scl = self._read_asset(assets["scl"]["href"], aoi, out_shape=red.shape, nearest=True)
        except (KeyError, rasterio.errors.RasterioError) as exc:
            raise ImageryUnavailable(f"Could not read scene bands: {exc}") from exc

        if scl.shape != red.shape:
            scl = np.resize(scl, red.shape)
        valid = (red > 0) & (nir > 0) & (~np.isin(scl, list(_SCL_MASKED)))
        if int(valid.sum()) == 0:
            raise EmptyScene(
                "Scene has no usable (cloud-free, positive-reflectance) pixels for this AOI."
            )

        red_f = red.astype(np.float32) * SCALE_FACTOR
        nir_f = nir.astype(np.float32) * SCALE_FACTOR
        red_f[~valid] = np.nan
        nir_f[~valid] = np.nan

        meta = ImageryMetadata(
            provider="Earth Search STAC (sentinel-2-l2a), live COG fetch",
            satellite="Sentinel-2",
            sensor="MSI",
            acquisition_date=item.get("properties", {}).get("datetime"),
            resolution_m=10.0,
            crs=f"EPSG:{item.get('properties', {}).get('proj:epsg', '')}",
            bands=["B04 (RED 10m)", "B08 (NIR 10m)", "SCL (cloud mask)"],
            scene_id=item.get("id"),
            cloud_cover_percent=item.get("properties", {}).get("eo:cloud_cover"),
            processing_method=(
                "Sentinel-2 L2A surface reflectance; windowed COG read; SCL cloud masking."
            ),
        )
        return BandData(
            red=red_f,
            nir=nir_f,
            valid=valid,
            bounds_lnglat=aoi,
            resolution_m=10.0,
            metadata=meta,
            centre_lnglat=((aoi[0] + aoi[2]) / 2.0, (aoi[1] + aoi[3]) / 2.0),
        )

    # ── internals ────────────────────────────────────────────────────────

    def _search_item(self, aoi: Tuple[float, float, float, float]):
        end = datetime.now(timezone.utc)
        start = end - timedelta(days=self.lookback_days)
        query = {
            "collections": [_COLLECTION],
            "bbox": list(aoi),
            "datetime": f"{start.isoformat()}/{end.isoformat()}",
            "limit": 8,
            "sortby": [{"field": "properties.datetime", "direction": "desc"}],
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
        ]
        if not usable:
            usable = features
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
