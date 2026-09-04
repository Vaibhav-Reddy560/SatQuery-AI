import json
import os
from typing import List, Dict, Any

BIGEARTHNET_19_CLASSES = [
    "Urban fabric", "Industrial or commercial units", "Arable land",
    "Permanent crops", "Pastures", "Complex cultivation patterns",
    "Land principally occupied by agriculture", "Broad-leaved forest",
    "Coniferous forest", "Mixed forest", "Natural grassland",
    "Moors and heathland", "Sclerophyllous vegetation", "Transitional woodland-shrub",
    "Beaches, dunes, sands", "Inland wetlands", "Coastal wetlands",
    "Inland waters", "Marine waters"
]

class BigEarthNetDatasetManager:
    """
    BigEarthNet reference/evaluation dataset helper (Phase 3C).

    Honest status: SatQuery does NOT bundle the BigEarthNet dataset (it is a
    large external archive of Sentinel-1/2 patches with ``BigEarthNet.txt``
    annotations) and has NOT evaluated or fine-tuned its VLM against it. This
    module only documents the reference dataset (19 Corine-derived classes,
    S1 VV/VH + S2 bands) and serves clearly-labelled DEMO patch metadata for
    the UI — see ``GET /datasets/bigearthnet/samples`` (stamped
    ``mode="mock"``) and ``GET /datasets/bigearthnet/eval`` (stamped
    ``NOT_AVAILABLE``). No real patch tiles and no metrics are fabricated.
    """

    def __init__(self, data_dir: str = "./data/bigearthnet"):
        self.data_dir = data_dir
        self.classes = BIGEARTHNET_19_CLASSES

    def get_sample_patches(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Demo patch metadata ONLY — canned entries, never presented as live
        BigEarthNet tiles (the API stamps ``mode="mock"``).
        """
        samples = []
        sample_locs = [
            ("patch_s2_s1_001", [78.9629, 20.5937], ["Urban fabric", "Arable land"]),
            ("patch_s2_s1_002", [72.8777, 19.0760], ["Industrial or commercial units", "Inland waters"]),
            ("patch_s2_s1_003", [77.5946, 12.9716], ["Urban fabric", "Complex cultivation patterns"]),
            ("patch_s2_s1_004", [88.3639, 22.5726], ["Inland waters", "Broad-leaved forest"]),
            ("patch_s2_s1_005", [76.9558, 8.5241], ["Coastal wetlands", "Permanent crops"]),
            ("patch_s2_s1_006", [75.8577, 26.9124], ["Arable land", "Natural grassland"])
        ]

        for key, coords, labels in sample_locs[:limit]:
            samples.append({
                "sample_key": key,
                "dataset": "BigEarthNet-S1-S2 (demo metadata)",
                "is_demo": True,
                "demo_note": "Canned metadata for UI illustration, not a live BigEarthNet tile.",
                "sentinel_1_polarizations": ["VV", "VH"],
                "sentinel_2_bands": ["B01", "B02", "B03", "B04", "B05", "B06", "B07", "B08", "B8A", "B09", "B11", "B12"],
                "corine_classes": labels,
                "spatial_coords": coords,
                "resolution_meters": 10
            })
        return samples

    def get_class_distribution(self) -> Dict[str, object]:
        """
        DEMO class distribution (mock counts only, for UI illustration).
        NOT a real BigEarthNet statistic — the response flags ``is_demo`` so
        it can never be mistaken for measured class frequencies.
        """
        return {
            "is_demo": True,
            "note": "Illustrative mock counts, not measured BigEarthNet statistics.",
            "counts": {
                cls_name: 120 + idx * 15
                for idx, cls_name in enumerate(BIGEARTHNET_19_CLASSES)
            },
        }

bigearthnet_manager = BigEarthNetDatasetManager()
