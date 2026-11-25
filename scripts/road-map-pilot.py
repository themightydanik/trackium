#!/usr/bin/env python3
"""Build a small offline XYZ review set from public OpenStreetMap API extracts.

Requires Python 3 and Pillow 11+. Downloads small, fixed samples once and reuses
them on subsequent runs. Deliberately unsuitable for bulk country extraction.
"""
import argparse
from collections import defaultdict, deque
from datetime import datetime
import hashlib
import json
import math
from pathlib import Path
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from xml.etree import ElementTree
from zoneinfo import ZoneInfo

from PIL import Image, ImageDraw, ImageFont

# Public geographic landmarks and corridors, never tracker observations.
SITES = {
    "kyiv": (50.4504, 30.5236, "UA"),
    "lviv": (49.8419, 24.0315, "UA"),
    "odesa": (46.4845, 30.7385, "UA"),
    "kharkiv": (49.9935, 36.2304, "UA"),
    "dnipro": (48.4647, 35.0462, "UA"),
    "burshtyn": (49.2586, 24.6294, "UA"),
    "rural-holohory": (49.7627, 24.7527, "UA"),
    "shehyni-medyka": (49.7998, 22.9488, "UA/PL"),
    "warsaw": (52.2298, 21.0118, "PL"),
    "berlin": (52.5195, 13.4045, "DE"),
    "brno": (49.1951, 16.6068, "CZ"),
    "bucharest": (44.4334, 26.1025, "RO"),
    "paris": (48.8567, 2.3522, "FR"),
}
PALETTES = {
    "light": ("#f4efe7", "#e0d6cb", "#bdc8b3", "#a5cbdb", "#bfafa0", "#fffcf7", "#efc374", "#362f2b"),
    "dark": ("#102239", "#25364e", "#23443d", "#224d68", "#101829", "#8aadc3", "#efc374", "#f1f4f8"),
}
FONT = ImageFont.truetype('DejaVuSans.ttf', 11)
ROAD_CLASSES = {"motorway", "trunk", "primary", "secondary", "tertiary"}
MAX_EXTRACT_BYTES = 12 * 1024 * 1024


def project(lat, lon, zoom):
    size = 256 * (2 ** zoom)
    return (lon + 180) / 360 * size, (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) * size / 2


def source(site, lat, lon, folder):
    dx = .008 if site == "shehyni-medyka" else .0019
    bbox = ",".join(f"{n:.6f}" for n in (lon - dx, lat - .0014, lon + dx, lat + .0014))
    url = "https://api.openstreetmap.org/api/0.6/map?bbox=" + bbox
    # Changing a sample boundary invalidates its local extract.
    key = hashlib.sha256(bbox.encode()).hexdigest()[:10]
    path = folder / f"{site}-{key}.osm"
    if not path.exists():
        request = Request(url, headers={"User-Agent": "TrackiumRoadReview/1.0 (+https://github.com/themightydanik/trackium)"})
        for attempt in range(3):
            try:
                with urlopen(request, timeout=30) as response:
                    contents = response.read(MAX_EXTRACT_BYTES + 1)
                break
            except HTTPError as exc:
                if exc.code not in (429, 502, 503, 504) or attempt == 2:
                    raise
                time.sleep(3 * (attempt + 1))
        if len(contents) > MAX_EXTRACT_BYTES:
            raise ValueError("OSM sample exceeds the offline review budget")
        ElementTree.fromstring(contents)
        path.write_bytes(contents)
        time.sleep(1)
    content = path.read_bytes()
    retrieved = datetime.fromtimestamp(path.stat().st_mtime, ZoneInfo("Europe/Kyiv")).date()
    return ElementTree.fromstring(content), url, hashlib.sha256(content).hexdigest(), str(retrieved)


def read_features(root):
    nodes = {n.get("id"): (float(n.get("lat")), float(n.get("lon"))) for n in root.findall("node")}
    features = []
    for way in root.findall("way"):
        tags = {t.get("k"): t.get("v") for t in way.findall("tag")}
        coords = [nodes.get(n.get("ref")) for n in way.findall("nd")]
        if len(coords) > 1 and all(coords):
            features.append((tags, coords))
    return features


def crossing_evidence(root):
    """Undirected OSM node connectivity in this extract, without access or routing semantics."""
    graph = defaultdict(set)
    refs = defaultdict(set)
    for way in root.findall("way"):
        tags = {tag.get("k"): tag.get("v") for tag in way.findall("tag")}
        if tags.get("highway") not in ROAD_CLASSES:
            continue
        nodes = [node.get("ref") for node in way.findall("nd")]
        refs[tags.get("ref")].update(nodes)
        for a, b in zip(nodes, nodes[1:]):
            graph[a].add(b)
            graph[b].add(a)
    west, east = refs["28"], refs["М-11"]
    seen = set(west)
    queue = deque(west)
    while queue:
        for node in graph[queue.popleft()] - seen:
            seen.add(node)
            queue.append(node)
    return {"poland_nodes": len(west), "ukraine_nodes": len(east),
            "shared_nodes": len(west & east), "connected_ukraine_nodes": len(seen & east)}


def render(features, zoom, center, target, palette):
    background, building, green, water, casing, street, primary, text = palette
    cx, cy = center
    for x in range(cx - 1, cx + 2):
        for y in range(cy - 1, cy + 2):
            image = Image.new("RGB", (256, 256), background)
            draw = ImageDraw.Draw(image)
            roads = []
            for tags, coords in features:
                points = [(px - x * 256, py - y * 256) for px, py in (project(*p, zoom) for p in coords)]
                if (max(p[0] for p in points) < -12 or min(p[0] for p in points) > 268 or
                        max(p[1] for p in points) < -12 or min(p[1] for p in points) > 268):
                    continue
                highway = tags.get("highway")
                if highway:
                    major = highway in ROAD_CLASSES
                    width = 8 if major else 4 if highway not in {"footway", "path", "steps"} else 2
                    roads.append((width, points, tags.get("name") or tags.get("ref"), major))
                elif "building" in tags:
                    draw.polygon(points, fill=building)
                elif tags.get("natural") == "water":
                    draw.polygon(points, fill=water)
                elif tags.get("leisure") == "park" or tags.get("landuse") in {"grass", "forest"}:
                    draw.polygon(points, fill=green)
            roads.sort(key=lambda road: road[0])
            for width, points, _, _ in roads:
                draw.line(points, fill=casing, width=width + 2, joint="curve")
            for width, points, _, major in roads:
                draw.line(points, fill=primary if major else street, width=width, joint="curve")
            names = set()
            for _, points, name, _ in reversed(roads):
                for px, py in points[len(points) // 3:]:
                    if name and name not in names and 12 < px < 218 and 12 < py < 242:
                        draw.text((px, py), name, fill=text, font=FONT, stroke_width=1, stroke_fill=background)
                        names.add(name)
                        break
            out = target / str(zoom) / str(x)
            out.mkdir(parents=True, exist_ok=True)
            image.save(out / f"{y}.png", optimize=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    raw = args.output / "raw"
    raw.mkdir(parents=True, exist_ok=True)
    review = {}
    for site, (lat, lon, country) in SITES.items():
        root, url, sha256, retrieved = source(site, lat, lon, raw)
        features = read_features(root)
        road_tags = [tags for tags, _ in features if "highway" in tags]
        dates = [element.get("timestamp") for element in root if element.get("timestamp")]
        entry = {"latitude": lat, "longitude": lon, "country": country, "source": url,
                 "sha256": sha256, "retrieved_kyiv_date": retrieved, "last_element_edit": max(dates, default=None),
                 "roads": len(road_tags), "named_roads": sum("name" in tags for tags in road_tags),
                 "major_roads": sum(tags["highway"] in ROAD_CLASSES for tags in road_tags),
                 "explicit_truck_tags": sum(any(key in tags for key in (
                     "hgv", "maxweight", "maxheight", "maxwidth", "maxlength")) for tags in road_tags)}
        if site == "shehyni-medyka":
            entry["crossing"] = crossing_evidence(root)
        if not road_tags:
            raise ValueError(f"{site} has no OSM highways in its sample")
        for zoom in (16, 17, 18):
            center = tuple(int(pos) // 256 for pos in project(lat, lon, zoom))
            entry[str(zoom)] = f"{zoom}/{center[0]}/{center[1]}.png"
            for style, palette in PALETTES.items():
                render(features, zoom, center, args.output / style, palette)
        review[site] = entry
        print(f"{site}: {entry['roads']} highway ways, {entry['named_roads']} named", flush=True)
    (args.output / "samples.json").write_text(json.dumps(review, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
