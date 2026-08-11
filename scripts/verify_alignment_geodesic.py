from math import asin, atan2, cos, degrees, hypot, radians, sin, sqrt
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))
import analyze_alignment_v1 as analysis


CSV_PATH = Path("C:/Users/jimas/Documents/GRID_ATLAS_WEB/docs/data/candidate-sites-200-v3/candidate-sites-200-shrines-temples-v3.csv")
OUTPUT_PATH = Path("C:/Users/jimas/Documents/GRID_ATLAS_WEB/docs/data/candidate-sites-200-v3/alignment-geodesic-verification.txt")
EARTH_RADIUS_KM = 6371.0088


def vector(site):
    lat = radians(site["latitude"])
    lon = radians(site["longitude"])
    return (cos(lat) * cos(lon), cos(lat) * sin(lon), sin(lat))


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def norm(v):
    return sqrt(dot(v, v))


def scale(v, factor):
    return (v[0] * factor, v[1] * factor, v[2] * factor)


def verify_segment(sites, tolerance_km):
    start = vector(sites[0])
    end = vector(sites[-1])
    normal = cross(start, end)
    normal = scale(normal, 1 / norm(normal))
    total_angle = atan2(norm(cross(start, end)), dot(start, end))
    retained = []
    cross_track = []
    for site in sites:
        point = vector(site)
        cross_distance = EARTH_RADIUS_KM * abs(asin(max(-1, min(1, dot(point, normal)))))
        along_angle = atan2(dot(point, cross(normal, start)), dot(point, start))
        if cross_distance <= tolerance_km and -radians(2) <= along_angle <= total_angle + radians(2):
            retained.append(site)
            cross_track.append(cross_distance)
    return {
        "count": len(retained),
        "mean_error_km": sum(cross_track) / len(cross_track),
        "max_error_km": max(cross_track),
        "span_km": EARTH_RADIUS_KM * total_angle,
        "sites": retained,
    }


sites = analysis.load_sites(CSV_PATH)
points, _ = analysis.project(sites)
lines = []
for tolerance in (5.0, 10.0):
    candidates = analysis.find_candidates(sites, points, tolerance, 6, 300.0)
    candidates = [candidate for candidate in candidates if candidate["anchor_count"] >= 2 and candidate["max_gap_km"] <= 150]
    candidates.sort(key=lambda item: (-item["count"], -item["span_km"], item["mean_error_km"]))
    lines.append(f"TOL={tolerance:g} / local candidates={len(candidates)}")
    for rank, candidate in enumerate(candidates[:8], 1):
        verified = verify_segment(candidate["sites"], tolerance)
        names = " → ".join(site["name"] for site in verified["sites"])
        lines.append(
            f"{rank}. local {candidate['count']}地点 / geodesic {verified['count']}地点 / "
            f"span {verified['span_km']:.1f}km / mean {verified['mean_error_km']:.2f}km / "
            f"max {verified['max_error_km']:.2f}km / anchors {candidate['anchor_count']}"
        )
        lines.append(names)
    lines.append("")
OUTPUT_PATH.write_text("\n".join(lines), encoding="utf-8")
