#!/usr/bin/env python3
"""
Fetch small, REAL Sentinel-2 L2A cutouts for SatQuery's bundled Indian scenes.

Each cutout is a real Sentinel-2 L2A surface-reflectance window (B02 BLUE,
B03 GREEN, B04 RED, B08 NIR at 10 m + the 20 m SCL cloud mask) read from the
public Element84 Earth Search STAC collection ``sentinel-2-l2a`` and stored
in its OWN projected CRS (each scene keeps its own UTM zone / pixel grid —
never re-projected to a shared grid).

Bundled scenes (see backend/app/analysis/imagery.py SAMPLE_SCENES)
-------------------------------------------------------------------
- delhi     : S2B_43RGM_20250324_0_L2A (UTM 43N), centre ~28.66 N, 77.10 E
- jaisalmer : S2B_42RXQ_20250409_0_L2A (UTM 42N), centre ~27.00 N, 70.90 E

Usage
-----
    python scripts/fetch_indian_scene_samples.py --name delhi
    python scripts/fetch_indian_scene_samples.py --name jaisalmer

Output layout (matches what the imagery provider expects)
---------------------------------------------------------
    backend/app/analysis/data/scenes/<name>/{B02,B03,B04,B08,SCL}.tif
    backend/app/analysis/data/scenes/<name>/metadata.json
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
os.environ.setdefault("GDAL_HTTP_MAX_RETRY", "2")

STAC_SEARCH_URL = "https://earth-search.aws.element84.com/v1/search"
COLLECTION = "sentinel-2-l2a"
WGS84 = CRS.from_epsg(4326)
ASSET_NAMES = {"B02": "blue", "B03": "green", "B04": "red", "B08": "nir", "SCL": "scl"}

SCENES_ROOT = Path(__file__).resolve().parent.parent / "backend" / "app" / "analysis" / "data" / "scenes"

# (scene_id, human name, centre lat, centre lng, region label)
SCENE_PRESETS = {
    "delhi": {
        "scene_id": "S2B_43RGM_20250324_0_L2A",
        "center_lat": 28.66,
        "center_lng": 77.10,
        "region": "Delhi / West Delhi, India",
    },
    "jaisalmer": {
        "scene_id": "S2B_42RXQ_20250409_0_L2A",
        "center_lat": 27.0,
        "center_lng": 70.9,
        "region": "Jaisalmer, Rajasthan, India",
    },
    "mumbai": {
        # Cloud-free dry-season 2026 scene over Mumbai city (UTM 43N).
        "scene_id": "S2C_42QZG_20260506_0_L2A",
        "center_lat": 19.076,
        "center_lng": 72.8777,
        "region": "Mumbai, Maharashtra, India",
    },
}


def _item_by_scene_id(scene_id: str) -> dict:
    query = {
        "collections": [COLLECTION],
        "ids": [scene_id],
        "limit": 1,
    }
    with httpx.Client(timeout=60.0) as client:
        resp = client.post(STAC_SEARCH_URL, json=query)
        resp.raise_for_status()
        features = resp.json().get("features", [])
    if not features:
        raise SystemExit(f"ERROR: scene {scene_id} not found in Earth Search.")
    return features[0]


def _read_band_window(href, lon, lat, pixels):
    """Read a square window of `pixels`x`pixels` around (lon, lat) from a COG,
    preserving the scene's OWN CRS/transform."""
    with rasterio.Env():
        with rasterio.open(href) as ds:
            x, y = warp_transform(WGS84, ds.crs, [lon], [lat])
            x, y = x[0], y[0]
            col, row = ~ds.transform * (x, y)
            col, row = int(round(col)), int(round(row))
            col = min(max(col - pixels // 2, 0), max(ds.width - pixels, 0))
            row = min(max(row - pixels // 2, 0), max(ds.height - pixels, 0))
            window = rasterio.windows.Window(col_off=col, row_off=row, width=pixels, height=pixels)
            resampling = Resampling.nearest if ds.dtypes[0] == "uint8" else Resampling.average
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


def _valid_fraction(red, nir, scl) -> float:
    cloud_mask = np.isin(scl, (0, 1, 3, 8, 9, 10, 11))
    valid = (red > 0) & (nir > 0) & (~cloud_mask)
    return float(np.count_nonzero(valid)) / float(red.size)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--name", choices=sorted(SCENE_PRESETS), required=True, help="Bundled scene preset")
    parser.add_argument("--pixels", type=int, default=224)
    parser.add_argument("--out-dir", type=Path, default=None)
    args = parser.parse_args()

    preset = SCENE_PRESETS[args.name]
    scene_id = preset["scene_id"]
    lat, lng = preset["center_lat"], preset["center_lng"]
    out_dir = args.out_dir or (SCENES_ROOT / args.name)
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Locating {scene_id} ...")
    item = _item_by_scene_id(scene_id)
    assets = item.get("assets", {})
    missing = [a for a in ASSET_NAMES.values() if a not in assets]
    if missing:
        print(f"ERROR: scene lacks assets {missing}.", file=sys.stderr)
        return 2

    print(f"Scene {scene_id}: cloud {item['properties'].get('eo:cloud_cover')}%, "
          f"EPSG {item['properties'].get('proj:epsg')}, acquired {item['properties'].get('datetime')}")
    try:
        blue, t_blue, crs, nodata = _read_band_window(assets["blue"]["href"], lng, lat, args.pixels)
        green, t_green, _, _ = _read_band_window(assets["green"]["href"], lng, lat, args.pixels)
        red, t_red, _, _ = _read_band_window(assets["red"]["href"], lng, lat, args.pixels)
        nir, t_nir, _, _ = _read_band_window(assets["nir"]["href"], lng, lat, args.pixels)
        scl, t_scl, _, _ = _read_band_window(assets["scl"]["href"], lng, lat, args.pixels // 2)
        if scl.shape != red.shape:
            scl = np.repeat(np.repeat(scl, 2, axis=0), 2, axis=1)[: args.pixels, : args.pixels]
        if scl.shape != red.shape:
            scl = np.resize(scl, red.shape)
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR reading bands: {exc!r}", file=sys.stderr)
        return 1

    fraction = _valid_fraction(red.astype(np.float64), nir.astype(np.float64), scl)
    if fraction < 0.05:
        print(f"ERROR: only {fraction:.1%} valid pixels (clouds/edges).", file=sys.stderr)
        return 1

    paths = {b: out_dir / f"{b}.tif" for b in ("B02", "B03", "B04", "B08", "SCL")}
    _save_band(blue.astype("uint16"), t_blue, crs, nodata, paths["B02"], "B02", item)
    _save_band(green.astype("uint16"), t_green, crs, nodata, paths["B03"], "B03", item)
    _save_band(red.astype("uint16"), t_red, crs, nodata, paths["B04"], "B04", item)
    _save_band(nir.astype("uint16"), t_nir, crs, nodata, paths["B08"], "B08", item)
    _save_band(scl.astype("uint8"), t_scl, crs, 0, paths["SCL"], "SCL", item)

    scale = 1.0 / 10000.0
    ndvi = (nir.astype(np.float32) - red.astype(np.float32)) / (nir.astype(np.float32) + red.astype(np.float32) + 1e-6)
    ndwi = (green.astype(np.float32) - nir.astype(np.float32)) / (green.astype(np.float32) + nir.astype(np.float32) + 1e-6)
    valid = (red > 0) & (nir > 0) & (~np.isin(scl, (0, 1, 3, 8, 9, 10, 11)))
    ndvi_mean = float(np.nanmean(np.where(valid, ndvi, np.nan)))
    ndwi_mean = float(np.nanmean(np.where(valid, ndwi, np.nan)))

    meta = {
        "source": "Earth Search STAC (https://earth-search.aws.element84.com) — sentinel-2-l2a",
        "authentication": "none",
        "license": "Copernicus Programme terms — free to use (https://dataspace.copernicus.eu/terms-and-conditions)",
        "scene_id": scene_id,
        "region": preset["region"],
        "acquisition_datetime": item["properties"].get("datetime"),
        "cloud_cover_percent": item["properties"].get("eo:cloud_cover"),
        "epsg": item["properties"].get("proj:epsg"),
        "crs": str(crs),
        "pixel_size_m": 10,
        "bands": ["B02 (BLUE 10m)", "B03 (GREEN 10m)", "B04 (RED 10m)", "B08 (NIR 10m)", "SCL (cloud mask)"],
        "scale_factor": scale,
        "center_lat": lat,
        "center_lng": lng,
        "pixels": args.pixels,
        "sample_ndvi_mean": round(ndvi_mean, 4),
        "sample_ndwi_mean": round(ndwi_mean, 4),
        "regenerate_command": f"python scripts/fetch_indian_scene_samples.py --name {args.name}",
        "provider_note": "Free public STAC; anonymous reads; no SLA; may be rate-limited.",
    }
    with open(out_dir / "metadata.json", "w", encoding="utf-8") as fh:
        json.dump(meta, fh, indent=2)

    for b, p in paths.items():
        print(f"  wrote {p.relative_to(Path.cwd())} ({p.stat().st_size // 1024} KB)")
    print(f"  scene NDVI mean: {ndvi_mean:.4f}; NDWI mean: {ndwi_mean:.4f}; valid {fraction:.1%}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
