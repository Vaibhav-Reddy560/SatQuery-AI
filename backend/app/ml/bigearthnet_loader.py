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
    BigEarthNet MLOps dataset loader for co-registered Sentinel-1 SAR (VV/VH)
    and Sentinel-2 multispectral patches.
    """

    def __init__(self, data_dir: str = "./data/bigearthnet"):
        self.data_dir = data_dir
        self.classes = BIGEARTHNET_19_CLASSES

    def get_sample_patches(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Returns mock/parsed BigEarthNet sample patches with Sentinel-1 and Sentinel-2 band metadata.
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

        for idx, (key, coords, labels) in enumerate(sample_locs[:limit]):
            samples.append({
                "sample_key": key,
                "dataset": "BigEarthNet-S1-S2",
                "sentinel_1_polarizations": ["VV", "VH"],
                "sentinel_2_bands": ["B01", "B02", "B03", "B04", "B05", "B06", "B07", "B08", "B8A", "B09", "B11", "B12"],
                "corine_classes": labels,
                "spatial_coords": coords,
                "resolution_meters": 10
            })
        return samples

    def get_class_distribution(self) -> Dict[str, int]:
        return {cls_name: 120 + idx * 15 for idx, cls_name in enumerate(BIGEARTHNET_19_CLASSES)}

bigearthnet_manager = BigEarthNetDatasetManager()
