#!/usr/bin/env python3
"""
Fetch a small, REAL Sentinel-2 L2A cutout for SatQuery's offline/demo path.

Why this exists
---------------
SatQuery Phase 2 computes NDVI from genuine multispectral bands (B04 = RED,
B08 = NIR at 10 m, plus the 20 m Scene Classification Layer for cloud
masking) and NDWI for water detection (B03 = GREEN, B08 = NIR). Live
retrieval over the network is not always possible during an SIH demo or in
CI, so the repo ships a small real sample produced by this script under
``backend/app/analysis/data/sample_ndvi/``. The sample is used by the
"sample" imagery provider (the default); the "sentinel2" provider retrieves
imagery live over the same STAC service.

Data source (free, no API key)
------------------------------
Element84 Earth Search STAC: https://earth-search.aws.element84.com
Collection ``sentinel-2-l2a`` (Sentinel-2 L2A surface reflectance). STAC
search is public/anonymous; the item asset COGs are served anonymously from
``sentinel-cogs.s3.us-west-2.amazonaws.com``. No account or key is required.

Limits / reliability
--------------------
- Public service without SLA: it may be slow or briefly unavailable. The
  script retries a handful of scenes and fails loudly otherwise.
- Sentinel-2 revisits a given area roughly every 5 days; cloudy scenes are
  skipped via ``eo:cloud_cover``.
- Data license: Sentinel-2 data is free under the Copernicus Programme
  (see https://dataspace.copernicus.eu/terms-and-conditions).

Usage
-----
    python scripts/fetch_sentinel2_sample.py            # default AOI (Punjab)
    python scripts/fetch_sentinel2_sample.py --center-lat 19.076 --center-lng 72.8777 --days 120
    python scripts/fetch_change_sample.py               # bi-temporal pair (Phase 2E)

The bi-temporal change-detection sample (``sample_change/before|after``) is
fetched by ``scripts/fetch_change_sample.py``; both observations are cut from
the same Sentinel-2 tile at the same centre so the pair shares one 10 m UTM
grid and is pixel-aligned by construction.
"""

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import transform as warp_transform
from rasterio.crs import CRS

# Network-safety defaults for GDAL's HTTP (COG) driver. Without these a dead
# connection can hang reads for a very long time.
os.environ.setdefault("GDAL_HTTP_TIMEOUT", "40")
os.environ.setdefault("CPL_TIMEOUT", "40")
os.environ.setdefault("GDAL_HTTP_MAX_RETRY", "2")

STAC_SEARCH_URL = "https://earth-search.aws.element84.com/v1/search"
COLLECTION = "sentinel-2-l2a"
WGS84 = CRS.from_epsg(4326)

DEFAULT_OUT_DIR = Path(__file__).resolve().parent.parent / "backend" / "app" / "analysis" / "data" / "sample_ndvi"


def _scene_valid_fraction(red: np.ndarray, nir: np.ndarray, scl: np.ndarray) -> float:
    """Fraction of pixels that are (a) positive reflectance and (b) not
    cloud/shadow/snow per the Sentinel-2 SCL class codes."""
    cloud_mask = np.isin(scl, (0, 1, 3, 8, 9, 10, 11))  # nodata/sat/cloud shadow/clouds/cirrus/snow
    valid = (red > 0) & (nir > 0) & (~cloud_mask)
    return float(np.count_nonzero(valid)) / float(red.size)


# Earth Search uses semantic asset names; map our band names onto them.
ASSET_NAMES = {"B02": "blue", "B03": "green", "B04": "red", "B08": "nir", "SCL": "scl"}


def _fetch_item_bands(bbox, lookback_days):
    """Search Earth Search for scenes over bbox, newest first."""
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=lookback_days)
    query = {
        "collections": [COLLECTION],
        "bbox": list(bbox),
        "datetime": f"{start.isoformat()}/{end.isoformat()}",
        "limit": 20,
        "sortby": [{"field": "properties.datetime", "direction": "desc"}],
    }
    with httpx.Client(timeout=60.0) as client:
        resp = client.post(STAC_SEARCH_URL, json=query)
        resp.raise_for_status()
        return resp.json().get("features", [])


def _read_band_window(href, lon, lat, pixels):
    """Read a square window of `pixels`x`pixels` around (lon, lat) from a COG."""
    with rasterio.Env():
        with rasterio.open(href) as ds:
            x, y = warp_transform(WGS84, ds.crs, [lon], [lat])
            x, y = x[0], y[0]
            col, row = ~ds.transform * (x, y)
            col, row = int(round(col)), int(round(row))
            col = min(max(col - pixels // 2, 0), max(ds.width - pixels, 0))
            row = min(max(row - pixels // 2, 0), max(ds.height - pixels, 0))
            window = rasterio.windows.Window(col_off=col, row_off=row, width=pixels, height=pixels)
            resampling = Resampling.average if ds.count == 1 and ds.dtypes[0] not in ("uint8",) else Resampling.nearest
            arr = ds.read(1, window=window, out_shape=(pixels, pixels), resampling=resampling)
            transform = ds.window_transform(window)
            crs = ds.crs
            nodata = ds.nodata if ds.nodata is not None else 0
    return arr, transform, crs, nodata


def _save_band(arr, transform, crs, nodata, path, band_name, item):
    profile = {
        "driver": "GTiff",
        "width": arr.shape[1],
        "height": arr.shape[0],
        "count": 1,
        "dtype": arr.dtype.name,
        "crs": crs,
        "transform": transform,
        "compress": "deflate",
        "nodata": nodata,
        "tiled": True,
    }
    with rasterio.open(path, "w", **profile) as dst:
        dst.write(arr, 1)
        dst.update_tags(ns="satquery", **{
            "band": band_name,
            "scene_id": item["id"],
            "datetime": item["properties"].get("datetime", ""),
            "source": item["assets"].get(band_name, {}).get("href", ""),
        })
    return path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--center-lat", type=float, default=30.901, help="AOI centre latitude")
    parser.add_argument("--center-lng", type=float, default=75.8573, help="AOI centre longitude")
    parser.add_argument("--pixels", type=int, default=224, help="Sample width/height in pixels")
    parser.add_argument("--days", type=int, default=120, help="Look-back window in days")
    parser.add_argument("--max-cloud", type=float, default=25.0, help="Max eo:cloud_cover")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    args = parser.parse_args()

    half_deg = 0.05
    bbox = [
        args.center_lng - half_deg,
        args.center_lat - half_deg,
        args.center_lng + half_deg,
        args.center_lat + half_deg,
    ]

    print(f"Searching {COLLECTION} around ({args.center_lat}, {args.center_lng}) "
          f"over the last {args.days} days (cloud < {args.max_cloud}%)...")
    items = _fetch_item_bands(bbox, args.days)
    if not items:
        print("ERROR: no Sentinel-2 scenes found. Widen --days or move the AOI.", file=sys.stderr)
        return 2

    # Client-side cloud filter (no server-side query needed).
    items = [it for it in items if (it.get("properties", {}).get("eo:cloud_cover") or 0) < args.max_cloud]
    if not items:
        print(f"ERROR: no scenes below {args.max_cloud}% cloud found. "
              f"Raise --max-cloud or move the AOI.", file=sys.stderr)
        return 2

    args.out_dir.mkdir(parents=True, exist_ok=True)

    for item in items:
        assets = item.get("assets", {})
        names = {key: ASSET_NAMES[key] for key in ASSET_NAMES if ASSET_NAMES[key] in assets}
        if not all(k in assets for k in names.values()):
            continue
        try:
            print(f"Trying scene {item['id']} "
                  f"(cloud {item['properties'].get('eo:cloud_cover')}%) ...")
            blue, t_blue, _, _ = _read_band_window(assets[names["B02"]]["href"], args.center_lng, args.center_lat, args.pixels)
            green, t_green, _, _ = _read_band_window(assets[names["B03"]]["href"], args.center_lng, args.center_lat, args.pixels)
            red, t_red, _, _ = _read_band_window(assets[names["B04"]]["href"], args.center_lng, args.center_lat, args.pixels)
            nir, t_nir, _, _ = _read_band_window(assets[names["B08"]]["href"], args.center_lng, args.center_lat, args.pixels)
            scl, t_scl, _, _ = _read_band_window(assets[names["SCL"]]["href"], args.center_lng, args.center_lat, args.pixels // 2)

            if red.shape != nir.shape:
                scl = np.repeat(np.repeat(scl, 2, axis=0), 2, axis=1)[: args.pixels, : args.pixels]
            if scl.shape != red.shape:
                scl = np.resize(scl, red.shape)

            fraction = _scene_valid_fraction(red.astype(np.float64), nir.astype(np.float64), scl)
            if fraction < 0.05:
                print(f"  skip: only {fraction:.1%} valid pixels (clouds/edges)")
                continue

            paths = {
                "B02": args.out_dir / "B02.tif",
                "B03": args.out_dir / "B03.tif",
                "B04": args.out_dir / "B04.tif",
                "B08": args.out_dir / "B08.tif",
                "SCL": args.out_dir / "SCL.tif",
            }
            _save_band(blue.astype("uint16"), t_blue, crs, nodata, paths["B02"], "B02", item)
            _save_band(green.astype("uint16"), t_green, crs, nodata, paths["B03"], "B03", item)
            _save_band(red.astype("uint16"), t_red, crs, nodata, paths["B04"], "B04", item)
            _save_band(nir.astype("uint16"), t_nir, crs, nodata, paths["B08"], "B08", item)
            _save_band(scl.astype("uint8"), t_scl, crs, 0, paths["SCL"], "SCL", item)

            scale = 1.0 / 10000.0
            ndvi = ((nir.astype(np.float32) - red.astype(np.float32)) /
                    (nir.astype(np.float32) + red.astype(np.float32) + 1e-6))
            mean = float(np.nanmean(np.where((red > 0) & (nir > 0), ndvi, np.nan)))

            meta = {
                "source": "Earth Search STAC (https://earth-search.aws.element84.com) — sentinel-2-l2a",
                "authentication": "none",
                "license": "Copernicus Programme terms — free to use (https://dataspace.copernicus.eu/terms-and-conditions)",
                "scene_id": item["id"],
                "acquisition_datetime": item["properties"].get("datetime"),
                "cloud_cover_percent": item["properties"].get("eo:cloud_cover"),
                "epsg": item["properties"].get("proj:epsg"),
                "crs": str(crs),
                "pixel_size_m": 10,
                "bands": ["B02 (BLUE 10m)", "B03 (GREEN 10m)", "B04 (RED 10m)", "B08 (NIR 10m)", "SCL (cloud mask)"],
                "scale_factor": scale,
                "center_lat": args.center_lat,
                "center_lng": args.center_lng,
                "pixels": args.pixels,
                "sample_ndvi_mean": round(mean, 4),
                "regenerate_command": "python scripts/fetch_sentinel2_sample.py"
                + (f" --center-lat {args.center_lat} --center-lng {args.center_lng}" if args.center_lat != 30.901 else ""),
                "provider_note": "Free public STAC; anonymous reads; no SLA; may be rate-limited.",
            }
            with open(args.out_dir / "metadata.json", "w", encoding="utf-8") as f:
                json.dump(meta, f, indent=2)

            for name, p in paths.items():
                print(f"  wrote {p.relative_to(Path.cwd())} ({p.stat().st_size // 1024} KB)")
            print(f"  sample NDVI mean: {mean:.4f}")
            print("Sample dataset ready (includes B03 GREEN for NDWI water detection).")
            return 0
        except Exception as exc:  # noqa: BLE001 - surface which scene failed
            print(f"  failed: {exc!r}")

    print("ERROR: could not fetch a usable scene.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
