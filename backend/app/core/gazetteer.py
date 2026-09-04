"""
Deterministic location gazetteer for SatQuery's supported Indian places.

The frontend parser resolves a handful of known places to coordinates, but a
backend-only client (or a place the frontend did not map) must still resolve
an explicit place name from query text to an analysis centre. This module is
that resolution table: name -> approximate [lng, lat] city/region centre
(WGS84). It is intentionally small, deterministic and honest — coordinates
are approximate city/region centres (same values the frontend gazetteer in
src/services/queryParser.ts uses), never a "smart" geocoder.

Places NOT in this table are deliberately unresolved: the planner leaves the
centre unset and the imagery layer raises a structured NO_AOI error asking
for a selectable AOI or a place we know, instead of silently analysing the
default sample scene under a wrong place label.
"""

from typing import Dict, Optional, Tuple

# Canonical name (lowercase) -> (lng, lat). Mirrors the frontend gazetteer.
_GAZETTEER: Dict[str, Tuple[float, float]] = {
    # Maharashtra
    "mumbai": (72.8777, 19.076),
    "navi mumbai": (73.0297, 19.037),
    "pune": (73.8567, 18.5204),
    "nagpur": (79.0882, 21.1458),
    "nashik": (73.7898, 19.9975),
    "aurangabad": (75.3433, 19.8762),
    "thane": (72.9781, 19.2183),
    "maharashtra": (75.7139, 19.7515),
    # Rajasthan
    "jaipur": (75.7873, 26.9124),
    "jodhpur": (73.0243, 26.2389),
    "udaipur": (73.7125, 24.5854),
    "kota": (75.8648, 25.2138),
    "bikaner": (73.3119, 28.0229),
    "ajmer": (74.6399, 26.4499),
    "jaisalmer": (70.9, 27.0),
    "thar desert": (70.9, 27.02),
    "rajasthan": (74.2179, 27.0238),
    # Karnataka
    "bengaluru": (77.5946, 12.9716),
    "bangalore": (77.5946, 12.9716),
    "mysuru": (76.6394, 12.2958),
    "mysore": (76.6394, 12.2958),
    "mangaluru": (74.856, 12.9141),
    "karnataka": (75.7139, 15.3173),
    "western ghats": (75.5, 13.5),
    # Kerala
    "kochi": (76.2673, 9.9312),
    "thiruvananthapuram": (76.9366, 8.5241),
    "trivandrum": (76.9366, 8.5241),
    "kozhikode": (75.7804, 11.2588),
    "alleppey": (76.3388, 9.4981),
    "alappuzha": (76.3388, 9.4981),
    "wayanad": (76.0834, 11.603),
    "kerala": (76.2711, 10.8505),
    # Punjab
    "ludhiana": (75.8573, 30.901),
    "amritsar": (74.8723, 31.634),
    "jalandhar": (75.5762, 31.326),
    "patiala": (76.3869, 30.3398),
    "chandigarh": (76.7794, 30.7333),
    "wheat belt": (75.8573, 30.901),
    "punjab": (75.3412, 31.1471),
    # West Bengal
    "kolkata": (88.3639, 22.5726),
    "calcutta": (88.3639, 22.5726),
    "sundarbans": (89.1833, 21.9497),
    "sundarban": (89.1833, 21.9497),
    "siliguri": (88.3953, 26.7271),
    "darjeeling": (88.2663, 27.041),
    "west bengal": (87.855, 22.9868),
    # Other major cities / regions
    # Delhi: approximate city-level centre, matched to the bundled real
    # Delhi sample scene (S2B_43RGM_20250324_0_L2A, West Delhi ~28.66 N /
    # 77.10 E) so offline city queries resolve to the actual bundled scene.
    "delhi": (77.10, 28.66),
    "new delhi": (77.10, 28.66),
    "west delhi": (77.10, 28.66),
    "hyderabad": (78.4867, 17.385),
    "ahmedabad": (72.5714, 23.0225),
    "lucknow": (80.9462, 26.8467),
    "goa": (74.124, 15.2993),
    "assam": (92.9376, 26.2006),
    "odisha": (85.0985, 20.9517),
    "chennai": (80.2707, 13.0827),
    "india": (78.9629, 20.5937),
    "indi": (78.9629, 20.5937),
    # Bundled sample scene aliases (used by the offline sample provider).
    "harike": (75.009229, 31.1162),
    "harike wetland": (75.009229, 31.1162),
}


def lookup(name: Optional[str]) -> Optional[Tuple[float, float]]:
    """Return (lng, lat) for a place name, or None when unknown."""
    if not name:
        return None
    key = name.strip().lower()
    # Fall back to the leading word so "Mumbai port" -> "mumbai" resolves.
    if key not in _GAZETTEER:
        first = key.split()[0] if key.split() else ""
        key = first
    return _GAZETTEER.get(key)


def known_place(name: Optional[str]) -> bool:
    return lookup(name) is not None
