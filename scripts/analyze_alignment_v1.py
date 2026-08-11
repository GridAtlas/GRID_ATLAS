#!/usr/bin/env python3
"""最新版200地点から、複数地点が近接する長い直線候補を探索する。"""

import argparse
import csv
import json
import math
from pathlib import Path


EARTH_KM_PER_DEG_LAT = 110.57
EARTH_KM_PER_DEG_LON = 111.32


def load_sites(path: Path):
    with path.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    sites = []
    for row in rows:
        sites.append({
            "no": row["no"],
            "name": row["name"],
            "category": row.get("category", ""),
            "prefecture": row.get("prefecture", ""),
            "region": row.get("region", ""),
            "role": row.get("selection_role", ""),
            "latitude": float(row["latitude"]),
            "longitude": float(row["longitude"]),
        })
    return sites


def project(sites):
    lat0 = sum(site["latitude"] for site in sites) / len(sites)
    lon0 = sum(site["longitude"] for site in sites) / len(sites)
    cos_lat0 = math.cos(math.radians(lat0))
    points = []
    for site in sites:
        points.append((
            (site["longitude"] - lon0) * EARTH_KM_PER_DEG_LON * cos_lat0,
            (site["latitude"] - lat0) * EARTH_KM_PER_DEG_LAT,
        ))
    return points, {"latitude": lat0, "longitude": lon0}


def line_candidate(sites, points, i, j, tolerance_km):
    x1, y1 = points[i]
    x2, y2 = points[j]
    dx = x2 - x1
    dy = y2 - y1
    length = math.hypot(dx, dy)
    if length == 0:
        return None
    norm2 = length * length
    distances = []
    projections = []
    for x, y in points:
        vx = x - x1
        vy = y - y1
        distances.append(abs(vx * dy - vy * dx) / length)
        projections.append((vx * dx + vy * dy) / norm2)

    inlier_indices = [
        index for index, (distance, projection) in enumerate(zip(distances, projections))
        if distance <= tolerance_km and -0.02 <= projection <= 1.02
    ]
    if i not in inlier_indices:
        inlier_indices.append(i)
    if j not in inlier_indices:
        inlier_indices.append(j)
    inlier_indices.sort(key=lambda index: projections[index])
    inlier_distances = [distances[index] for index in inlier_indices]
    positions = [projections[index] * length for index in inlier_indices]
    span = max(positions) - min(positions)
    gaps = [right - left for left, right in zip(positions, positions[1:])]
    return {
        "indices": inlier_indices,
        "count": len(inlier_indices),
        "span_km": span,
        "mean_error_km": sum(inlier_distances) / len(inlier_distances),
        "max_error_km": max(inlier_distances),
        "max_gap_km": max(gaps) if gaps else 0.0,
        "endpoint_distance_km": length,
    }


def find_candidates(sites, points, tolerance_km, min_count, min_span_km):
    by_indices = {}
    for i in range(len(sites)):
        for j in range(i + 1, len(sites)):
            candidate = line_candidate(sites, points, i, j, tolerance_km)
            if not candidate or candidate["count"] < min_count or candidate["span_km"] < min_span_km:
                continue
            key = tuple(candidate["indices"])
            previous = by_indices.get(key)
            if previous is None or (
                candidate["mean_error_km"], -candidate["span_km"]
            ) < (
                previous["mean_error_km"], -previous["span_km"]
            ):
                by_indices[key] = candidate
    candidates = list(by_indices.values())
    for candidate in candidates:
        candidate["sites"] = [sites[index] for index in candidate.pop("indices")]
        candidate["anchor_count"] = sum(site["role"] == "target-anchor" for site in candidate["sites"])
    return candidates


def sort_key(candidate):
    return (-candidate["count"], -candidate["span_km"], candidate["mean_error_km"], candidate["max_error_km"])


def serialize_candidate(candidate):
    return {
        "count": candidate["count"],
        "span_km": round(candidate["span_km"], 2),
        "mean_error_km": round(candidate["mean_error_km"], 2),
        "max_error_km": round(candidate["max_error_km"], 2),
        "max_gap_km": round(candidate["max_gap_km"], 2),
        "endpoint_distance_km": round(candidate["endpoint_distance_km"], 2),
        "anchor_count": candidate["anchor_count"],
        "sites": [
            {
                "no": site["no"],
                "name": site["name"],
                "category": site["category"],
                "prefecture": site["prefecture"],
                "region": site["region"],
                "role": site["role"],
            }
            for site in candidate["sites"]
        ],
    }


def render_markdown(sites, origin, thresholds, results):
    lines = [
        "# 最新版200地点の直線候補分析",
        "",
        "各2地点を結ぶ直線について、線分の内側にある地点を数えた。距離は平均緯度を基準にした局所平面近似で、探索用の目安として使っている。",
        "",
        f"- 母集団: {len(sites)}地点",
        f"- 投影中心: 緯度 {origin['latitude']:.4f} / 経度 {origin['longitude']:.4f}",
        f"- 主条件: 線から{thresholds['main_tolerance_km']}km以内、{thresholds['min_count']}地点以上、全長{thresholds['min_span_km']}km以上",
        "- 同じ地点集合を重複掲載しない",
        "",
        "## 主条件の上位候補",
        "",
    ]
    main_result = results[str(thresholds["main_tolerance_km"])]
    if not main_result["top"]:
        lines.append("主条件を満たす候補はありませんでした。")
    else:
        for rank, candidate in enumerate(main_result["top"], 1):
            names = " → ".join(site["name"] for site in candidate["sites"])
            lines.extend([
                f"### {rank}. {candidate['count']}地点 / 全長{candidate['span_km']:.1f}km",
                "",
                f"- 線からの平均誤差: {candidate['mean_error_km']:.1f}km",
                f"- 最大誤差: {candidate['max_error_km']:.1f}km",
                f"- 地点間の最大空白: {candidate['max_gap_km']:.1f}km",
                f"- 固定アンカー: {candidate['anchor_count']}地点",
                f"- 地点: {names}",
                "",
            ])
    lines.extend(["## 条件別の候補数", "", "| 線からの許容誤差 | 条件を満たす地点集合数 | 最大地点数 |", "|---:|---:|---:|"])
    for tolerance in thresholds["tolerances_km"]:
        result = results[str(tolerance)]
        max_count = max((candidate["count"] for candidate in result["all"]), default=0)
        lines.append(f"| {tolerance}km | {len(result['all'])} | {max_count} |")
    lines.extend([
        "",
        "## 注意",
        "",
        "2地点を基準に直線を探しているため、候補線は偶然でも見つかる。長さ、地点数、誤差だけでなく、候補地点の知名度、地域的な偏り、母集団を広げたときの順位も確認が必要。",
        "",
    ])
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("csv_path", type=Path)
    parser.add_argument("output_json", type=Path)
    parser.add_argument("output_md", type=Path)
    args = parser.parse_args()

    sites = load_sites(args.csv_path)
    points, origin = project(sites)
    thresholds = {
        "main_tolerance_km": 10.0,
        "tolerances_km": [5.0, 10.0, 15.0],
        "min_count": 6,
        "min_span_km": 300.0,
    }
    results = {}
    for tolerance in thresholds["tolerances_km"]:
        candidates = find_candidates(
            sites,
            points,
            tolerance,
            thresholds["min_count"],
            thresholds["min_span_km"],
        )
        candidates.sort(key=sort_key)
        serialized = [serialize_candidate(candidate) for candidate in candidates]
        results[str(tolerance)] = {"all": serialized, "top": serialized[:20]}

    output = {
        "method": "pair-defined line segments with perpendicular cross-track tolerance",
        "input_sites": len(sites),
        "projection_origin": origin,
        "thresholds": thresholds,
        "results": results,
    }
    args.output_json.parent.mkdir(parents=True, exist_ok=True)
    args.output_md.parent.mkdir(parents=True, exist_ok=True)
    args.output_json.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    args.output_md.write_text(render_markdown(sites, origin, thresholds, results), encoding="utf-8")
    print(f"地点数: {len(sites)}")
    for tolerance in thresholds["tolerances_km"]:
        result = results[str(tolerance)]
        max_count = max((candidate["count"] for candidate in result["all"]), default=0)
        print(f"誤差{tolerance:g}km: 候補{len(result['all'])}集合 / 最大{max_count}地点")


if __name__ == "__main__":
    main()
