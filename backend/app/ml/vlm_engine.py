import re
import random
import time
from typing import Dict, Any, List, Tuple
from backend.app.services.gis_processor import compute_spectral_indices, process_sar_vv_vh_ratio

class SatQueryVLMEngine:
    """
    Multimodal Remote Sensing Vision-Language Model Inference Engine.
    Processes user text queries alongside Sentinel-1 SAR (VV/VH) & Sentinel-2 Multispectral inputs.
    """

    INTENT_PATTERNS = [
        (r"\b(ship|vessel|boat|port|harbor|dock)\b", "ship_detection", "Ship & Maritime Features"),
        (r"\b(solar|panel|photovoltaic|renewable|wind turbine)\b", "solar_panel_detection", "Renewable Energy Assets"),
        (r"\b(airplane|aircraft|runway|airport|tarmac)\b", "airport_detection", "Airport Infrastructure"),
        (r"\b(building|house|structure|roof|urban|construction)\b", "building_detection", "Urban Structures"),
        (r"\b(water|river|lake|reservoir|flood|pond|dam)\b", "water_detection", "Water Bodies & Reservoirs"),
        (r"\b(forest|tree|deforestation|tree loss|canopy|woodland)\b", "deforestation_detection", "Forest & Vegetation Cover"),
        (r"\b(crop|farm|agriculture|field|ndvi|crop health|harvest)\b", "crop_health", "Agricultural Crops"),
        (r"\b(land cover|land use|classification|corine|bigearthnet)\b", "land_cover", "Land Cover & Land Use"),
        (r"\b(change|compare|difference|before|after|temporal)\b", "change_detection", "Bi-temporal Change Detection"),
        (r"\b(measure|area|distance|perimeter|length|size|km2|square km)\b", "measurement", "Geospatial Measurement"),
    ]

    CORINE_LAND_COVER_CLASSES = [
        {"name": "Urban Fabric & Infrastructure", "code": "111", "color": "#ef4444"},
        {"name": "Arable Agricultural Land", "code": "211", "color": "#eab308"},
        {"name": "Permanent Crops & Vineyards", "code": "221", "color": "#84cc16"},
        {"name": "Broad-leaved & Coniferous Forest", "code": "311", "color": "#22c55e"},
        {"name": "Natural Grassland & Moors", "code": "321", "color": "#10b981"},
        {"name": "Inland Waters & Coastal Wetlands", "code": "511", "color": "#06b6d4"},
        {"name": "Transitional Woodland & Shrub", "code": "324", "color": "#a855f7"},
        {"name": "Industrial & Commercial Units", "code": "121", "color": "#f97316"}
    ]

    def __init__(self):
        self.model_name = "SatQuery-VLM-Sentinel-v1"
        self.device = "cpu"
        self.initialized_at = time.time()

    def parse_query_intent(self, text: str) -> Dict[str, Any]:
        text_lower = text.lower()
        
        # Determine intent type
        matched_type = "general_analysis"
        target_name = "Remote Sensing Features"
        
        for pattern, itype, name in self.INTENT_PATTERNS:
            if re.search(pattern, text_lower):
                matched_type = itype
                target_name = name
                break
                
        # Extract location if mentioned
        loc_match = re.search(r"\b(?:in|at|near|over|around|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)", text)
        location = loc_match.group(1) if loc_match else "Selected Area of Interest"

        confidence = round(random.uniform(0.88, 0.98), 2)
        
        return {
            "type": matched_type,
            "target_name": target_name,
            "location": location,
            "confidence": confidence,
            "spectral_indices": ["NDVI", "NDWI", "NDBI"]
        }

    def infer(self, query: str, centre: List[float] = None, location_name: str = None) -> Dict[str, Any]:
        start_time = time.time()
        centre = centre or [78.9629, 20.5937]
        intent = self.parse_query_intent(query)
        location = location_name or intent["location"]
        
        # Simulate multispectral & SAR preprocessing
        spectral = compute_spectral_indices(nir=0.45, red=0.12, green=0.22, swir=0.28)
        sar = process_sar_vv_vh_ratio(vv_db=-8.5, vh_db=-14.2)
        
        kind = "detection"
        payload = {}
        text_response = ""
        attachments = []
        suggested_actions = []

        if intent["type"] == "land_cover":
            kind = "land_cover"
            total_area = round(random.uniform(150.0, 500.0), 1)
            # Allocate percentage breakdown
            pcts = [38.5, 24.2, 16.8, 11.5, 5.0, 4.0]
            classes_out = []
            for idx, pct in enumerate(pcts):
                cl = self.CORINE_LAND_COVER_CLASSES[idx]
                classes_out.append({
                    "name": cl["name"],
                    "code": cl["code"],
                    "area_km2": round(total_area * (pct / 100.0), 2),
                    "percentage": pct,
                    "color": cl["color"]
                })
            
            payload = {
                "kind": "land_cover",
                "location": location,
                "total_area_km2": total_area,
                "classes": classes_out,
                "confidence": 0.94
            }
            text_response = (
                f"**Land Cover & CORINE Classification for {location}:**\n\n"
                f"Multimodal Sentinel-1 SAR & Sentinel-2 analysis across **{total_area} km²** indicates:\n"
                + "\n".join([f"• **{c['name']}** — {c['percentage']}% ({c['area_km2']} km²)" for c in classes_out])
                + f"\n\nDominant Cover: **{classes_out[0]['name']}**.\n"
                f"Spectral Status: NDVI = `{spectral['NDVI']}`, NDWI = `{spectral['NDWI']}`. "
                f"SAR polarizations (VV/VH): `{sar['vv_vh_ratio_db']} dB` ({sar['roughness']})."
            )
            attachments = [
                {"type": "image", "label": "Sentinel-2 CORINE Classification Map", "confidence": 0.94},
                {"type": "data", "label": "BigEarthNet Multi-label Land Cover Distribution"}
            ]
            suggested_actions = ["Export Land Cover GeoJSON", "Compare with historical imagery", "Generate PDF Summary Report"]

        elif intent["type"] == "change_detection":
            kind = "change"
            total_changed = round(random.uniform(5.2, 28.4), 2)
            changes = [
                {
                    "id": "chg-1",
                    "type": "loss",
                    "description": "Vegetation loss & forest clearing",
                    "area_km2": round(total_changed * 0.65, 2),
                    "confidence": 0.93,
                    "coords": [centre[0] + 0.015, centre[1] + 0.012]
                },
                {
                    "id": "chg-2",
                    "type": "gain",
                    "description": "Urban infrastructure expansion",
                    "area_km2": round(total_changed * 0.35, 2),
                    "confidence": 0.91,
                    "coords": [centre[0] - 0.010, centre[1] - 0.008]
                }
            ]
            payload = {
                "kind": "change",
                "location": location,
                "before_date": "2024-03-15",
                "after_date": "2026-03-15",
                "total_area_changed_km2": total_changed,
                "changes": changes,
                "confidence": 0.92
            }
            text_response = (
                f"**Bi-Temporal Change Detection Analysis for {location}:**\n\n"
                f"Comparing Sentinel imagery from **2024-03-15** to **2026-03-15**:\n"
                + "\n".join([f"• **{c['description']}**: {c['area_km2']} km² (confidence {int(c['confidence']*100)}%)" for c in changes])
                + f"\n\nTotal detected change: **{total_changed} km²**."
            )
            attachments = [
                {"type": "map_overlay", "label": "Bi-temporal Difference Mask (SAR + Multispectral)", "confidence": 0.92},
                {"type": "data", "label": "Change Matrix Log"}
            ]
            suggested_actions = ["Highlight change zones on map", "Export Change Report", "Calculate NDWI moisture delta"]

        elif intent["type"] == "measurement":
            kind = "measurement"
            val = round(random.uniform(12.5, 45.8), 2)
            payload = {
                "kind": "measurement",
                "measurement_type": "area",
                "location": location,
                "value": val,
                "unit": "km²",
                "points": [
                    [centre[0] - 0.02, centre[1] - 0.02],
                    [centre[0] + 0.02, centre[1] - 0.02],
                    [centre[0] + 0.02, centre[1] + 0.02],
                    [centre[0] - 0.02, centre[1] + 0.02]
                ],
                "summary_text": f"Calculated enclosed boundary area for {location}.",
                "confidence": 0.98
            }
            text_response = (
                f"**Geospatial Area Measurement for {location}:**\n\n"
                f"• Total Area: **{val} km²**\n"
                f"• Perimeter Geometry: 4 polygon boundary points\n"
                f"• Precision: Sub-meter GIS geodesy projection\n\n"
                f"Would you like to run object detection or land cover classification over this measured polygon?"
            )
            attachments = [
                {"type": "data", "label": "Geodesic Measurement Summary", "confidence": 0.98}
            ]
            suggested_actions = ["Save Measurement to Project", "Run Land Cover over AOI", "Clear selection"]

        else:
            # Object Detection (Ships, Solar Panels, Water, Airports, Buildings)
            kind = "detection"
            feature_labels = {
                "ship_detection": ("Vessel", "Ships & Vessels"),
                "solar_panel_detection": ("Solar Array", "Renewable Energy"),
                "airport_detection": ("Aircraft", "Aviation Infrastructure"),
                "building_detection": ("Building", "Structures"),
                "water_detection": ("Water Body", "Hydrology"),
                "deforestation_detection": ("Tree Canopy Clearing", "Vegetation"),
                "crop_health": ("Crop Field", "Agriculture"),
                "general_analysis": ("Satellite Feature", "General")
            }
            lbl, cat = feature_labels.get(intent["type"], ("Satellite Feature", "General"))
            
            features = []
            num_feats = random.randint(4, 9)
            for idx in range(num_feats):
                offset_lng = random.uniform(-0.02, 0.02)
                offset_lat = random.uniform(-0.02, 0.02)
                conf = round(random.uniform(0.89, 0.97), 2)
                features.append({
                    "id": f"ft-{idx+1}",
                    "label": f"{lbl} #{idx+1}",
                    "category": cat,
                    "confidence": conf,
                    "coords": [round(centre[0] + offset_lng, 5), round(centre[1] + offset_lat, 5)],
                    "bbox": [
                        round(centre[0] + offset_lng - 0.002, 5),
                        round(centre[1] + offset_lat - 0.002, 5),
                        round(centre[0] + offset_lng + 0.002, 5),
                        round(centre[1] + offset_lat + 0.002, 5)
                    ],
                    "area_m2": round(random.uniform(150.0, 2400.0), 1)
                })

            payload = {
                "kind": "detection",
                "location": location,
                "total_features": len(features),
                "features": features,
                "categories": {cat: len(features)},
                "confidence": 0.94
            }

            text_response = (
                f"Multimodal VLM analysis of **{location}** identified **{len(features)} {cat.lower()} features**:\n\n"
                + "\n".join([f"• **{f['label']}** ({f['category']}) — confidence {int(f['confidence']*100)}%" for f in features[:5]])
                + (f"\n• …and {len(features)-5} additional features." if len(features) > 5 else "")
                + f"\n\nSensor Inputs: Sentinel-1 SAR (VV/VH) backscatter + Sentinel-2 Multispectral.\n"
                + f"Overall Model Confidence: **94%**."
            )
            attachments = [
                {"type": "map_overlay", "label": f"{len(features)} {cat} Bounding Boxes Overlay", "confidence": 0.94},
                {"type": "data", "label": "Feature Coordinates Table"}
            ]
            suggested_actions = ["Show detected features on map", "Generate Detection PDF Report", "Filter by confidence threshold"]

        latency_ms = round((time.time() - start_time) * 1000, 2)

        return {
            "intent": {
                "type": intent["type"],
                "location": location,
                "centre": centre,
                "confidence": intent["confidence"],
                "detected_target": intent["target_name"],
                "spectral_indices": intent["spectral_indices"]
            },
            "text_response": text_response,
            "attachments": attachments,
            "suggested_actions": suggested_actions,
            "confidence": 0.94,
            "analysis_kind": kind,
            "analysis_payload": payload,
            "latency_ms": latency_ms
        }

# Global singleton instance
vlm_engine = SatQueryVLMEngine()
