from math import asin, atan2, cos, radians, sin, sqrt
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))
import analyze_alignment_v1 as analysis


CSV_PATH = Path("C:/Users/jimas/Documents/GRID_ATLAS_WEB/docs/data/candidate-sites-200-v3/candidate-sites-200-shrines-temples-v3.csv")
OUTPUT_PATH = Path("C:/Users/jimas/Documents/GRID_ATLAS_WEB/docs/data/candidate-sites-200-v3/anchor-line-summary.txt")
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


def stats(sites, start, end, tolerance):
    first = vector(start)
    last = vector(end)
    normal = cross(first, last)
    normal = tuple(value / norm(normal) for value in normal)
    total_angle = atan2(norm(cross(first, last)), dot(first, last))
    retained = []
    errors = []
    positions = []
    for site in sites:
        point = vector(site)
        error = EARTH_RADIUS_KM * abs(asin(max(-1, min(1, dot(point, normal)))))
        along = atan2(dot(point, cross(normal, first)), dot(point, first))
        if error <= tolerance and -radians(2) <= along <= total_angle + radians(2):
            retained.append(site)
            errors.append(error)
            positions.append(along)
    retained = [site for _, site in sorted(zip(positions, retained))]
    return {
        "count": len(retained),
        "span_km": EARTH_RADIUS_KM * total_angle,
        "mean_error_km": sum(errors) / len(errors),
        "max_error_km": max(errors),
        "sites": retained,
    }


sites = analysis.load_sites(CSV_PATH)
anchors = [site for site in sites if site["role"] == "target-anchor"]
lines = []
for tolerance in (5.0, 10.0, 15.0):
    records = []
    for left_index in range(len(anchors)):
        for right_index in range(left_index + 1, len(anchors)):
            record = stats(sites, anchors[left_index], anchors[right_index], tolerance)
            record["start"] = anchors[left_index]["name"]
            record["end"] = anchors[right_index]["name"]
            records.append(record)
    records.sort(key=lambda item: (-item["count"], item["mean_error_km"]))
    lines.append(f"TOL={tolerance:g}")
    for rank, record in enumerate(records, 1):
        names = " → ".join(site["name"] for site in record["sites"])
        lines.append(
            f"{rank}. {record['start']} — {record['end']} / {record['count']}地点 / "
            f"全長{record['span_km']:.1f}km / 平均誤差{record['mean_error_km']:.2f}km / "
            f"最大誤差{record['max_error_km']:.2f}km"
        )
        lines.append(names)
    lines.append("")
OUTPUT_PATH.write_text("\n".join(lines), encoding="utf-8")
