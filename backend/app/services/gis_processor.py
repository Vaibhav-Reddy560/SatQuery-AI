import math
from typing import List, Dict, Any, Tuple

def calculate_polygon_area_km2(points: List[List[float]]) -> float:
    """
    Calculates approximate spherical surface area of a polygon defined by [lng, lat] vertices.
    """
    if len(points) < 3:
        return 0.0
    
    R = 6371.0  # Earth radius in km
    area = 0.0
    n = len(points)
    
    for i in range(n):
        j = (i + 1) % n
        lon1, lat1 = math.radians(points[i][0]), math.radians(points[i][1])
        lon2, lat2 = math.radians(points[j][0]), math.radians(points[j][1])
        area += (lon2 - lon1) * (2 + math.sin(lat1) + math.sin(lat2))
        
    area = abs(area * R * R / 2.0)
    return round(area, 3)

def calculate_polyline_distance_km(points: List[List[float]]) -> float:
    """
    Calculates total length of a polyline defined by [lng, lat] coordinates in km.
    """
    if len(points) < 2:
        return 0.0

    R = 6371.0
    total_dist = 0.0

    for i in range(len(points) - 1):
        lon1, lat1 = math.radians(points[i][0]), math.radians(points[i][1])
        lon2, lat2 = math.radians(points[i+1][0]), math.radians(points[i+1][1])
        
        dlon = lon2 - lon1
        dlat = lat2 - lat1
        
        a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        total_dist += R * c

    return round(total_dist, 3)

def compute_spectral_indices(nir: float, red: float, green: float, swir: float) -> Dict[str, float]:
    """
    Computes key multispectral remote sensing indices (Sentinel-2 B4, B3, B8, B11).
    - NDVI: Normalized Difference Vegetation Index (NIR - Red) / (NIR + Red)
    - NDWI: Normalized Difference Water Index (Green - NIR) / (Green + NIR)
    - NDBI: Normalized Difference Built-up Index (SWIR - NIR) / (SWIR + NIR)
    """
    ndvi = (nir - red) / (nir + red + 1e-6)
    ndwi = (green - nir) / (green + nir + 1e-6)
    ndbi = (swir - nir) / (swir + nir + 1e-6)

    return {
        "NDVI": round(float(ndvi), 4),
        "NDWI": round(float(ndwi), 4),
        "NDBI": round(float(ndbi), 4)
    }

def process_sar_vv_vh_ratio(vv_db: float, vh_db: float) -> Dict[str, Any]:
    """
    Processes Sentinel-1 Dual-Pol SAR backscatter intensity (VV, VH in dB).
    Calculates VV/VH ratio, cross-polarization index, and surface roughness indicator.
    """
    ratio = vv_db - vh_db  # in log space (dB)
    roughness = "High (Urban/Forest Canopy)" if vh_db > -12.0 else "Low (Water/Bare Ground)"
    return {
        "vv_db": vv_db,
        "vh_db": vh_db,
        "vv_vh_ratio_db": round(ratio, 2),
        "roughness": roughness
    }
