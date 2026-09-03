#!/usr/bin/env python3
"""
Fetch the small, REAL bi-temporal Sentinel-2 sample for SatQuery Phase 2E.

Why this exists
---------------
Change detection needs TWO genuine observations of the same AOI at different
acquisition dates, stored on the SAME pixel grid so the pipeline can compare
them pixel-by-pixel. This script cuts a ``before`` (dry season) and an
``after`` (monsoon) observation of the Harike-wetland AOI from the public
Earth Search STAC, then writes them under
``backend/app/analysis/data/sample_change/before|after`` (B03/B04/B08/SCL +
metadata.json each). The sample provider's ``fetch_pair`` reads this pair.

Why this pair is suitable
-------------------------
- Same Sentinel-2 tile (43RDQ, UTM 43N / EPSG:32643), same centre, same
  224x224 window at 10 m: the two observations share one grid and are
  pixel-aligned by construction (verified on write).
- Same platform family (S2B) and processing (L2A surface reflectance).
- Genuine temporal difference: the Dec 2025 scene is post-kharif harvest
  (mean NDVI ~0.20, cloud 0%); the Aug 2026 scene is the peak-monsoon green
  crop/wetland (mean NDVI ~0.57, cloud ~9.5%). Delta-NDVI change detection
  over this pair reports a large vegetation-gain signal — a real seasonal
  signal, not synthetic.

Data source
-----------
Element84 Earth Search STAC (https://earth-search.aws.element84.com),
collection ``sentinel-2-l2a``. Free, anonymous, no API key, no SLA.
Sentinel-2 data is free under the Copernicus Programme.

Usage
-----
    python scripts/fetch_change_sample.py            # default Harike pair
    python scripts/fetch_change_sample.py --center-lat 31.1162 --center-lng 75.0092 --before-id S2B_43RDQ_20251202_0_L2A --after-id S2B_43RDQ_20260829_0_L2A
"""

import argparse
import json
import os
import sys
from pathlib import Path

import httpx
import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import transform as warp_transform
from rasterio.crs import CRS

os.environ.setdefault("GDAL_HTTP_TIMEOUT", "40")
os.environ.setdefault("CPL_TIMEOUT", "40")

STAC_SEARCH_URL = "https://earth-search.aws.element84.com/v1/search"
COLLECTION = "sentinel-2-l2a"
WGS84 = CRS.from_epsg(4326)
ASSET = {"B02": "blue", "B03": "green", "B04": "red", "B08": "nir", "SCL": "scl"}

DEFAULT_OUT_DIR = (
    Path(__file__).resolve().parent.parent
    / "backend" / "app" / "analysis" / "data" / "sample_change"
)

DEFAULT_BEFORE_ID = "S2B_43RDQ_20251202_0_L2A"   # dry season, cloud 0%
DEFAULT_AFTER_ID = "S2B_43RDQ_20260829_0_L2A"    # monsoon, cloud ~9.5%


def _read_window(href, lon, lat, pixels):
    """Read a square 10 m window around (lon, lat); return (arr, transform, crs)."""
    with rasterio.Env():
        with rasterio.open(href) as ds:
            x, y = warp_transform(WGS84, ds.crs, [lon], [lat])
            col, row = ~ds.transform * (x[0], y[0])
            col, row = int(round(col)), int(round(row))
            col = min(max(col - pixels // 2, 0), max(ds.width - pixels, 0))
            row = min(max(row - pixels // 2, 0), max(ds.height - pixels, 0))
            window = rasterio.windows.Window(col, row, pixels, pixels)
            resampling = Resampling.average if ds.dtypes[0] != "uint8" else Resampling.nearest
            arr = ds.read(1, window=window, out_shape=(pixels, pixels), resampling=resampling)
            return arr, ds.window_transform(window), ds.crs


def _fetch_item(item_id):
    query = {"collections": [COLLECTION], "ids": [item_id]}
    resp = httpx.post(STAC_SEARCH_URL, json=query, timeout=60.0)
    resp.raise_for_status()
    feats = resp.json().get("features", [])
    if not feats:
        raise SystemExit(f"ERROR: scene {item_id} not found on Earth Search.")
    return feats[0]


def _save_band(arr, transform, crs, path, band_name, item):
    profile = {
        "driver": "GTiff",
        "width": arr.shape[1],
        "height": arr.shape[0],
        "count": 1,
        "dtype": arr.dtype.name,
        "crs": crs,
        "transform": transform,
        "compress": "deflate",
        "nodata": 0 if arr.dtype.name == "uint8" else 0,
        "tiled": True,
    }
    with rasterio.open(path, "w", **profile) as dst:
        dst.write(arr, 1)
        dst.update_tags(ns="satquery", **{
            "band": band_name,
            "scene_id": item["id"],
            "datetime": item["properties"].get("datetime", ""),
        })


def _write_one_observation(out_dir, item, lon, lat, pixels, role):
    out_dir.mkdir(parents=True, exist_ok=True)
    assets = item["assets"]
    meta = item["properties"]
    transforms = {}
    for band in ("B02", "B03", "B04", "B08", "SCL"):
        arr, transform, crs = _read_window(
            assets[ASSET[band]]["href"], lon, lat,
            pixels if band != "SCL" else pixels // 2,
        )
        if band == "SCL":
            arr = np.repeat(np.repeat(arr, 2, axis=0), 2, axis=1)[:pixels, :pixels]
        arr = arr.astype("uint16") if band != "SCL" else arr.astype("uint8")
        _save_band(arr, transform, crs, out_dir / f"{band}.tif", band, item)
        transforms[band] = transform

    # Alignment sanity: every band of one observation shares the grid.
    ref = transforms["B04"]
    for band, transform in transforms.items():
        if abs(transform.c - ref.c) > 1e-6 or abs(transform.f - ref.f) > 1e-6:
            raise SystemExit(f"ERROR: {role} {band} is not aligned with B04.")

    metadata = {
        "source": "Earth Search STAC (https://earth-search.aws.element84.com) - sentinel-2-l2a",
        "authentication": "none",
        "license": "Copernicus Programme terms - free to use",
        "scene_id": item["id"],
        "acquisition_datetime": meta.get("datetime"),
        "cloud_cover_percent": meta.get("eo:cloud_cover"),
        "epsg": meta.get("proj:epsg"),
        "crs": str(crs),
        "pixel_size_m": 10,
        "bands": ["B02 (BLUE 10m)", "B03 (GREEN 10m)", "B04 (RED 10m)", "B08 (NIR 10m)", "SCL (cloud mask)"],
        "scale_factor": 0.0001,
        "center_lat": lat,
        "center_lng": lon,
        "pixels": pixels,
        "region": "Harike Wetland, Sutlej-Beas confluence, Punjab, India",
        "temporal_role": role,
    }
    with open(out_dir / "metadata.json", "w", encoding="utf-8") as fh:
        json.dump(metadata, fh, indent=2, ensure_ascii=False)
    print(f"  wrote {out_dir} (scene {item['id']})")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--center-lat", type=float, default=31.1162)
    parser.add_argument("--center-lng", type=float, default=75.009229)
    parser.add_argument("--pixels", type=int, default=224)
    parser.add_argument("--before-id", default=DEFAULT_BEFORE_ID)
    parser.add_argument("--after-id", default=DEFAULT_AFTER_ID)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    args = parser.parse_args()

    print(f"Fetching before={args.before_id} after={args.after_id} "
          f"around ({args.center_lat}, {args.center_lng})...")
    before_item = _fetch_item(args.before_id)
    after_item = _fetch_item(args.after_id)

    _write_one_observation(args.out_dir / "before", before_item, args.center_lng, args.center_lat, args.pixels, "before")
    _write_one_observation(args.out_dir / "after", after_item, args.center_lng, args.center_lat, args.pixels, "after")

    # Cross-observation alignment check on the stored files.
    with rasterio.open(args.out_dir / "before" / "B04.tif") as b, rasterio.open(args.out_dir / "after" / "B04.tif") as a:
        if b.shape != a.shape:
            raise SystemExit("ERROR: before/after shapes differ - grids are not aligned.")
        if abs(b.transform.c - a.transform.c) > 1e-6 or abs(b.transform.f - a.transform.f) > 1e-6:
            raise SystemExit("ERROR: before/after origins differ - grids are not aligned.")
        if b.crs != a.crs:
            raise SystemExit("ERROR: before/after CRS differ.")
    print("Pair verified: same CRS, shape and grid origin (pixel-aligned).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())