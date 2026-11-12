#!/usr/bin/env python3
"""Find the closest US transmission lines to an address or lat/lon.

Usage:
    python3 tools/grid_nearest.py "1500 Marilla St, Dallas, TX 75201"
    python3 tools/grid_nearest.py 32.7767,-96.7970

Geocodes with the US Census geocoder, then queries the archived HIFLD
transmission line layer on ArcGIS for lines near the point. Voltage is the
only electrical attribute in the dataset. The MW column is a planning level
rule of thumb for a typical single circuit, not utility data and not
available headroom.
"""
import json, math, re, sys, urllib.parse, urllib.request

LAYER = ("https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/"
         "US_Electric_Power_Transmission_Lines/FeatureServer/0/query")
CENSUS = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress"
CAP = [(100, "30-90"), (138, "100-200"), (161, "150-300"), (220, "200-400"),
       (300, "300-700"), (400, "600-1,200"), (600, "1,200-2,500"), (900, "2,000-4,000")]


def get(url, params):
    with urllib.request.urlopen(url + "?" + urllib.parse.urlencode(params), timeout=60) as r:
        return json.load(r)


def geocode(text):
    m = re.fullmatch(r"\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*", text)
    if m:
        return float(m[1]), float(m[2]), "coordinates as entered"
    d = get(CENSUS, dict(address=text, benchmark="Public_AR_Current", format="json"))
    hits = d["result"]["addressMatches"]
    if not hits:
        sys.exit("No Census match. Try a fuller address or pass lat,lon from your county parcel viewer.")
    h = hits[0]
    return h["coordinates"]["y"], h["coordinates"]["x"], h["matchedAddress"]


def seg_dist_mi(lat0, lon0, pts):
    cx, cy = math.cos(math.radians(lat0)) * 69.17, 69.0  # miles per degree
    best = (1e9, None)
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        ax, ay, bx, by = (x1 - lon0) * cx, (y1 - lat0) * cy, (x2 - lon0) * cx, (y2 - lat0) * cy
        dx, dy = bx - ax, by - ay
        L = dx * dx + dy * dy
        t = 0 if not L else max(0, min(1, -(ax * dx + ay * dy) / L))
        d = math.hypot(ax + t * dx, ay + t * dy)
        if d < best[0]:
            best = (d, (lon0 + (ax + t * dx) / cx, lat0 + (ay + t * dy) / cy))
    return best


def cap(v):
    for m, r in CAP:
        if v < m:
            return r
    return "2,000-4,000"


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    lat, lon, label = geocode(" ".join(sys.argv[1:]))
    print(f"Location: {label}  ({lat:.5f}, {lon:.5f})\n")
    for radius in (3, 10, 25, 60):
        d = get(LAYER, dict(where="VOLTAGE>=69", geometry=f"{lon},{lat}", geometryType="esriGeometryPoint",
                            inSR=4326, spatialRel="esriSpatialRelIntersects", distance=radius,
                            units="esriSRUnit_StatuteMile", outFields="OWNER,VOLTAGE,VOLT_CLASS,SUB_1,SUB_2,STATUS",
                            outSR=4326, f="geojson", resultRecordCount=2000))
        feats = d.get("features", [])
        if feats:
            break
    best = {}
    for f in feats:
        g, p = f["geometry"], f["properties"]
        lines = [g["coordinates"]] if g["type"] == "LineString" else g["coordinates"]
        dist = min(seg_dist_mi(lat, lon, ln)[0] for ln in lines if len(ln) > 1)
        key = p["VOLT_CLASS"]
        if key not in best or dist < best[key][0]:
            best[key] = (dist, p)
    if not best:
        sys.exit("No lines of 69 kV or above found within 60 miles.")
    print(f"{'Class (kV)':<15}{'Dist (mi)':>10}  {'kV':>5}  {'Est. MW':<12} Owner / endpoints")
    for dist, p in sorted(best.values(), key=lambda t: t[0]):
        v = int(p["VOLTAGE"]) if p["VOLTAGE"] and p["VOLTAGE"] > 0 else 0
        ends = " to ".join(x.title() for x in (p["SUB_1"], p["SUB_2"]) if x and x != "NOT AVAILABLE")
        print(f"{p['VOLT_CLASS']:<15}{dist:>10.1f}  {v or 'n/a':>5}  {cap(v) if v else 'n/a':<12} "
              f"{(p['OWNER'] or 'Not listed').title()}" + (f" ({ends})" if ends else ""))
    print("\nMW is a rule of thumb for a typical single circuit, not available headroom. "
          "Confirm with the owning utility or ISO/RTO.")


if __name__ == "__main__":
    main()
