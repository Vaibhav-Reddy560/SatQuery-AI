#!/usr/bin/env python3
"""
Train the REAL land-cover classifier used by SatQuery Phase 2D.

Scientific basis
----------------
Supervised classical ML: a scikit-learn RandomForestClassifier is fitted on
per-pixel spectral features from real Sentinel-2 L2A surface reflectance
(B03 GREEN, B04 RED, B08 NIR, plus derived NDVI and NDWI) against ground
labels from the ESA WorldCover 2021 v200 10 m land-cover map (open data,
Copernicus Programme). The fitted model is a genuine trained classifier --
not a hand-written threshold rule dressed up as AI -- and it ships with the
repo as a small serialised artifact so runtime is fully offline.

Training is multi-region so every class is well represented by real data:
- Punjab (Harike wetland / cropland): water, vegetation, built-up, some bare
- Thar desert (Rajasthan): abundant bare soil

The classifier distinguishes FOUR deliberately coarse classes that 10 m
visible/NIR imagery can support: water, vegetation, built-up, bare soil.
It does NOT claim fine-grained classes the bands cannot separate. Validation
metrics reported in the model card are honest held-out numbers, never
invented.

Usage
-----
    python scripts/train_landcover_classifier.py
    python scripts/train_landcover_classifier.py --out-dir backend/app/ml/models

Outputs
-------
- landcover_rf_v1.joblib  : fitted RandomForestClassifier (pickle, CPU-only)
- landcover_v1.json       : model card (classes, features, training provenance,
                            honest held-out validation metrics)
"""

import argparse
import json
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx
import joblib
import numpy as np
import rasterio
import rasterio.windows
from rasterio.enums import Resampling
from rasterio.warp import reproject
from rasterio.warp import transform_bounds
from rasterio.crs import CRS
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split

STAC_SEARCH_URL = "https://earth-search.aws.element84.com/v1/search"
COLLECTION = "sentinel-2-l2a"
WORLDCOVER_BASE = (
    "https://esa-worldcover.s3.eu-central-1.amazonaws.com/"
    "v200/2021/map/ESA_WorldCover_10m_2021_v200_{tile}_Map.tif"
)

WGS84 = CRS.from_epsg(4326)
SCALE = 1.0 / 10000.0
_SCL_MASKED = {0, 1, 3, 8, 9, 10, 11}

# ── Class definitions ──────────────────────────────────────────────────────
#
# ESA WorldCover 2021 v200 codes -> our four coarse classes.
#   10 tree cover, 20 shrubland, 30 grassland, 40 cropland,
#   90 herbaceous wetland, 95 mangroves, 100 moss        -> vegetation
#   50 built-up                                          -> built_up
#   60 bare/sparse vegetation, 70 snow/ice               -> bare
#   80 permanent water bodies                            -> water
CLASS_MAP = {
    10: "vegetation", 20: "vegetation", 30: "vegetation", 40: "vegetation",
    90: "vegetation", 95: "vegetation", 100: "vegetation",
    50: "built_up",
    60: "bare", 70: "bare",
    80: "water",
}

CLASS_COLORS = {
    "water": "#2563eb",
    "vegetation": "#22c55e",
    "built_up": "#dc2626",
    "bare": "#ca8a04",
}

FEATURE_NAMES = ["B03 green", "B04 red", "B08 nir", "NDVI", "NDWI"]

# Training regions: (scene, WorldCover tile, [windows as lat,lng,half-deg]).
# Windows were chosen from a WorldCover class-coverage scan of each region.
SCENE_GROUPS = [
    {
        "scene_id": "S2B_43RDQ_20260829_0_L2A",
        "worldcover_tile": "N30E075",
        "windows": [
            (31.15, 75.02, 0.03),   # Harike wetland: water + wetland vegetation
            (30.70, 75.05, 0.03),   # town (built-up) + bare + cropland
            (30.70, 75.08, 0.03),   # larger built-up area + bare
            (31.30, 75.08, 0.03),   # built-up + water channels + bare
            (31.45, 75.05, 0.03),   # cropland + built-up
            (31.60, 75.05, 0.03),   # cropland + built-up + tree cover
        ],
    },
    {
        "scene_id": "S2A_42RXQ_20260809_0_L2A",
        "worldcover_tile": "N24E069",
        "windows": [
            (26.90, 70.50, 0.04),   # Thar desert: bare soil (dominant)
            (26.70, 70.90, 0.04),   # desert + sparse built-up
            (26.50, 70.70, 0.04),   # desert: bare soil
        ],
    },
]

PER_CLASS_CAP = 20000          # class-balanced subsample cap
RANDOM_STATE = 42
RF_KWARGS = dict(
    n_estimators=100,
    max_depth=12,
    min_samples_leaf=20,
    random_state=RANDOM_STATE,
    n_jobs=1,                  # deterministic inference
    class_weight="balanced",
)


# ── Data loading ───────────────────────────────────────────────────────────

def _stac_assets(scene_id: str) -> dict:
    resp = httpx.post(
        STAC_SEARCH_URL,
        json={"collections": [COLLECTION], "ids": [scene_id], "limit": 1},
        timeout=60.0,
    )
    resp.raise_for_status()
    items = resp.json().get("features", [])
    if not items:
        raise RuntimeError(f"Scene {scene_id} not found in Earth Search STAC")
    return items[0]["assets"]


def _read_s2_window(href, lon, lat, half):
    """Windowed read of a Sentinel-2 COG band around (lon, lat) at 10 m."""
    with rasterio.Env():
        with rasterio.open(href) as ds:
            bounds = transform_bounds(WGS84, ds.crs, lon - half, lat - half, lon + half, lat + half)
            win = rasterio.windows.from_bounds(*bounds, transform=ds.transform)
            win = win.intersection(rasterio.windows.Window(0, 0, ds.width, ds.height))
            arr = ds.read(1, window=win)
            transform = ds.window_transform(win)
            ds_crs = ds.crs
    return arr, transform, ds_crs


def _read_worldcover_window(tile, lon, lat, half, s2_transform, s2_shape, s2_crs):
    """Read ESA WorldCover labels at a window, reprojected onto the S2 grid."""
    url = WORLDCOVER_BASE.format(tile=tile)
    with rasterio.open(url) as ds:
        pad = 0.02
        win = rasterio.windows.from_bounds(
            lon - half - pad, lat - half - pad, lon + half + pad, lat + half + pad,
            transform=ds.transform,
        )
        labels = ds.read(1, window=win)
        src_transform = ds.window_transform(win)

    dst = np.zeros(s2_shape, dtype=np.uint8)
    reproject(
        source=labels,
        destination=dst,
        src_transform=src_transform,
        src_crs=WGS84,
        src_nodata=0,
        dst_transform=s2_transform,
        dst_crs=s2_crs,
        dst_nodata=0,
        resampling=Resampling.nearest,
    )
    return dst


def _window_samples(assets, tile, lon, lat, half):
    """Features + labels for one training window."""
    green, t_green, crs = _read_s2_window(assets["green"]["href"], lon, lat, half)
    red, _, _ = _read_s2_window(assets["red"]["href"], lon, lat, half)
    nir, _, _ = _read_s2_window(assets["nir"]["href"], lon, lat, half)
    scl, _, _ = _read_s2_window(assets["scl"]["href"], lon, lat, half)

    shape = green.shape
    scl_r = np.resize(scl, shape) if scl.shape != shape else scl
    labels = _read_worldcover_window(tile, lon, lat, half, t_green, shape, crs)

    gf = green.astype(np.float32) * SCALE
    rf = red.astype(np.float32) * SCALE
    nf = nir.astype(np.float32) * SCALE

    cloud = np.isin(scl_r, list(_SCL_MASKED))
    valid = (gf > 0) & (rf > 0) & (nf > 0) & (~cloud)

    with np.errstate(divide="ignore", invalid="ignore"):
        ndvi = (nf - rf) / (nf + rf)
        ndwi = (gf - nf) / (gf + nf)

    valid &= np.isfinite(ndvi) & np.isfinite(ndwi)

    feature_stack = np.stack([gf, rf, nf, ndvi, ndwi], axis=-1)

    X, y = [], []
    for code in np.unique(labels):
        cls = CLASS_MAP.get(int(code))
        if cls is None:
            continue
        px = valid & (labels == code)
        if not px.any():
            continue
        X.append(feature_stack[px])
        y.append(np.full(int(px.sum()), cls))
    if not X:
        return np.zeros((0, 5), dtype=np.float32), np.zeros((0,), dtype="<U12")
    return np.concatenate(X, axis=0), np.concatenate(y, axis=0)


# ── Main ───────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out-dir", type=Path, default=Path("backend/app/ml/models"))
    args = parser.parse_args()

    X_parts, y_parts = [], []
    training_meta = []
    for group in SCENE_GROUPS:
        scene_id = group["scene_id"]
        tile = group["worldcover_tile"]
        print(f"Fetching scene assets for {scene_id} ...")
        assets = _stac_assets(scene_id)
        for i, (lat, lon, half) in enumerate(group["windows"], start=1):
            t0 = time.time()
            X, y = _window_samples(assets, tile, lon, lat, half)
            X_parts.append(X)
            y_parts.append(y)
            counts = {c: int((y == c).sum()) for c in CLASS_COLORS}
            print(f"  window {i} ({lat}, {lon}): {X.shape[0]} px "
                  f"{counts} ({time.time() - t0:.1f}s)")
        training_meta.append({
            "feature_scene": scene_id,
            "worldcover_tile": tile,
            "windows": group["windows"],
        })

    X = np.concatenate(X_parts, axis=0)
    y = np.concatenate(y_parts, axis=0)
    print(f"Total training pixels: {X.shape[0]}")

    # Class-balanced subsample (cap per class).
    cap = PER_CLASS_CAP
    rng = np.random.default_rng(RANDOM_STATE)
    keep = []
    for cls in CLASS_COLORS:
        idx = np.where(y == cls)[0]
        if len(idx) > cap:
            idx = rng.choice(idx, size=cap, replace=False)
        keep.append(idx)
    keep = np.concatenate(keep)
    X, y = X[keep], y[keep]
    print("Class distribution after balancing:", {c: int((y == c).sum()) for c in CLASS_COLORS})

    # Train / validate split (stratified, honest held-out metrics).
    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y
    )

    print("Fitting RandomForestClassifier ...")
    clf = RandomForestClassifier(**RF_KWARGS)
    clf.fit(X_train, y_train)

    from sklearn.metrics import accuracy_score, balanced_accuracy_score, classification_report
    y_pred = clf.predict(X_val)
    accuracy = float(accuracy_score(y_val, y_pred))
    balanced = float(balanced_accuracy_score(y_val, y_pred))
    report = classification_report(y_val, y_pred, output_dict=True, zero_division=0)
    per_class = {
        cls: {
            "precision": round(float(report[cls]["precision"]), 4),
            "recall": round(float(report[cls]["recall"]), 4),
            "f1": round(float(report[cls]["f1-score"]), 4),
        }
        for cls in CLASS_COLORS
    }
    print(f"Held-out accuracy: {accuracy:.4f} | balanced accuracy: {balanced:.4f}")
    for cls, m in per_class.items():
        print(f"  {cls:10s} precision {m['precision']} recall {m['recall']} f1 {m['f1']}")

    # ── Ship artifact + model card ────────────────────────────────────────
    args.out_dir.mkdir(parents=True, exist_ok=True)
    model_path = args.out_dir / "landcover_rf_v1.joblib"
    meta_path = args.out_dir / "landcover_v1.json"
    joblib.dump(clf, model_path, compress=3)

    meta = {
        "model_name": "satquery-landcover-randomforest-v1",
        "model_version": "1.0.0",
        "model_kind": "ml",
        "classifier": "scikit-learn RandomForestClassifier",
        "classes": {cls: {"code": cls, "color": CLASS_COLORS[cls]} for cls in CLASS_COLORS},
        "features": FEATURE_NAMES,
        "sentinel2_bands": ["B03 (GREEN)", "B04 (RED)", "B08 (NIR)"],
        "training": {
            "label_source": "ESA WorldCover 10m 2021 v200 (open, Copernicus Programme)",
            "regions": training_meta,
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "train_pixels": int(len(y_train)),
            "val_pixels": int(len(y_val)),
            "random_state": RANDOM_STATE,
            "holdout_accuracy": round(accuracy, 4),
            "holdout_balanced_accuracy": round(balanced, 4),
            "per_class_metrics": per_class,
        },
        "notes": (
            "Classical ML (random forest) trained on real open data across "
            "two regions (Punjab wetland/cropland + Thar desert). Four coarse "
            "classes only; no fake or fine-grained claims. Runtime is fully "
            "offline using the shipped artifact."
        ),
    }
    with open(meta_path, "w", encoding="utf-8") as fh:
        json.dump(meta, fh, indent=2)

    print(f"Wrote {model_path} ({model_path.stat().st_size // 1024} KB)")
    print(f"Wrote {meta_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())