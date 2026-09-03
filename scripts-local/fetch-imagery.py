#!/usr/bin/env python3
"""
Fetch real satellite imagery for the AOIs referenced in src/data/mockData.ts.

Two sources:
  - Esri World Imagery `export` endpoint for current scenes (arbitrary size,
    no stitching).
  - Esri World Imagery *Wayback* for genuine historical scenes, so Change
    Detection shows two real acquisitions rather than one image processed twice.

Output: public/imagery/*.jpg
"""
import io, json, math, os, subprocess, sys, concurrent.futures

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "imagery")
os.makedirs(OUT, exist_ok=True)

from PIL import Image

UA = {"User-Agent": "Mozilla/5.0 (SatQuery asset build)"}
EXPORT = ("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery"
          "/MapServer/export?bbox={bbox}&bboxSR=3857&imageSR=3857"
          "&size={w},{h}&format=jpg&f=image")
WAYBACK = ("https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery"
           "/WMTS/1.0.0/default028mm/MapServer/tile/{rel}/{z}/{y}/{x}")


def merc(lat, lng):
    x = lng * 20037508.34 / 180.0
    y = math.log(math.tan((90 + lat) * math.pi / 360.0)) / (math.pi / 180.0)
    return x, y * 20037508.34 / 180.0


def bbox_for(lat, lng, span_m):
    cx, cy = merc(lat, lng)
    h = span_m / 2.0
    return f"{cx-h},{cy-h},{cx+h},{cy+h}"


def get(url, tries=3):
    """Fetch via curl - python's urllib has no system CA bundle on this machine."""
    last = None
    for _ in range(tries):
        try:
            r = subprocess.run(
                ["curl", "-sSL", "--max-time", "45", "-A", UA["User-Agent"], url],
                capture_output=True, check=True)
            if r.stdout:
                return r.stdout
            last = RuntimeError("empty response")
        except Exception as e:
            last = e
    raise last


def save(img, name, quality=82):
    path = os.path.join(OUT, name)
    img.convert("RGB").save(path, "JPEG", quality=quality, optimize=True,
                            progressive=True)
    return path, os.path.getsize(path)


def fetch_export(name, lat, lng, span_m, size=1024):
    data = get(EXPORT.format(bbox=bbox_for(lat, lng, span_m), w=size, h=size))
    img = Image.open(io.BytesIO(data))
    p, n = save(img, name)
    print(f"  {name:34} {img.size[0]}x{img.size[1]}  {n//1024:>4} KB  (export)")


def deg2tile(lat, lng, z):
    n = 2 ** z
    xt = (lng + 180.0) / 360.0 * n
    r = math.radians(lat)
    yt = (1.0 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2.0 * n
    return xt, yt


def fetch_wayback(name, rel, lat, lng, z, grid=4):
    """Stitch a grid x grid block of Wayback tiles centred on lat/lng."""
    xt, yt = deg2tile(lat, lng, z)
    x0, y0 = int(xt) - grid // 2, int(yt) - grid // 2
    canvas = Image.new("RGB", (256 * grid, 256 * grid))

    def one(ij):
        i, j = ij
        url = WAYBACK.format(rel=rel, z=z, x=x0 + i, y=y0 + j)
        return i, j, get(url)

    coords = [(i, j) for i in range(grid) for j in range(grid)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        for i, j, blob in ex.map(one, coords):
            canvas.paste(Image.open(io.BytesIO(blob)), (i * 256, j * 256))

    p, n = save(canvas, name)
    print(f"  {name:34} {canvas.size[0]}x{canvas.size[1]}  {n//1024:>4} KB  (wayback r{rel})")


def pick_releases():
    """Find Wayback releases closest to the mock data's 2024-03 and 2026-08."""
    cfg = json.loads(get("https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json"))
    rels = []
    for k, v in cfg.items():
        t = v.get("itemTitle", "")
        if "Wayback " in t:
            rels.append((int(k), t.split("Wayback ")[1].rstrip(")")))
    rels.sort(key=lambda r: r[1])
    def nearest(target):
        return min(rels, key=lambda r: abs(
            (int(r[1][:4]) * 12 + int(r[1][5:7])) - target))
    before = nearest(2024 * 12 + 3)
    after = nearest(2026 * 12 + 8)
    return before, after


if __name__ == "__main__":
    print("Current scenes (Esri World Imagery export):")
    # name, lat, lng, span in metres
    scenes = [
        ("navi-mumbai.jpg",  19.0330, 73.0290,  5000),   # urban - object detection
        ("sundarbans.jpg",   21.9490, 88.9000, 22000),   # mangrove delta - land cover
        ("ludhiana.jpg",     30.9000, 75.8500, 14000),   # cropland - classification
        ("jaisalmer.jpg",    27.0500, 71.3000, 16000),   # desert - solar farms
        ("kerala-coast.jpg",  9.5000, 76.3300, 13000),   # coastal - measurements
        ("delhi.jpg",        28.6139, 77.2090,  9000),   # urban - projects
    ]
    for s in scenes:
        try:
            fetch_export(*s)
        except Exception as e:
            print(f"  FAILED {s[0]}: {e}", file=sys.stderr)

    print("\nHistorical pair (Esri Wayback - two real acquisitions):")
    try:
        (rb, tb), (ra, ta) = pick_releases()
        print(f"  before release r{rb} ({tb})   after release r{ra} ({ta})")
        fetch_wayback("change-before.jpg", rb, 19.0330, 73.0290, 15)
        fetch_wayback("change-after.jpg",  ra, 19.0330, 73.0290, 15)
        with open(os.path.join(OUT, "provenance.json"), "w") as f:
            json.dump({"before": {"release": rb, "date": tb},
                       "after": {"release": ra, "date": ta},
                       "aoi": "Navi Mumbai, Maharashtra",
                       "source": "Esri World Imagery Wayback"}, f, indent=2)
        print(f"  provenance.json written")
    except Exception as e:
        print(f"  Wayback FAILED: {e}", file=sys.stderr)
