from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))
import analyze_alignment_v1 as analysis


csv_path = Path("C:/Users/jimas/Documents/GRID_ATLAS_WEB/docs/data/candidate-sites-200-v3/candidate-sites-200-shrines-temples-v3.csv")
output_path = Path("C:/Users/jimas/Documents/GRID_ATLAS_WEB/docs/data/candidate-sites-200-v3/alignment-filtered-summary.txt")
sites = analysis.load_sites(csv_path)
points, _ = analysis.project(sites)
lines = []
for tolerance in (5.0, 10.0):
    candidates = analysis.find_candidates(sites, points, tolerance, 6, 300.0)
    candidates = [analysis.serialize_candidate(candidate) for candidate in candidates]
    for label, filtered in (
        ("all", candidates),
        ("max_gap_100", [item for item in candidates if item["max_gap_km"] <= 100]),
        ("max_gap_80", [item for item in candidates if item["max_gap_km"] <= 80]),
        ("anchor_2_max_gap_150", [item for item in candidates if item["anchor_count"] >= 2 and item["max_gap_km"] <= 150]),
    ):
        filtered.sort(key=lambda item: (-item["count"], -item["span_km"], item["mean_error_km"]))
        lines.append(f"TOL={tolerance:g} / {label} / 候補数={len(filtered)}")
        for rank, candidate in enumerate(filtered[:5], 1):
            names = " → ".join(site["name"] for site in candidate["sites"])
            lines.append(
                f"{rank}. {candidate['count']}地点 / 全長{candidate['span_km']:.1f}km / "
                f"平均誤差{candidate['mean_error_km']:.1f}km / 最大誤差{candidate['max_error_km']:.1f}km / "
                f"最大空白{candidate['max_gap_km']:.1f}km / 固定アンカー{candidate['anchor_count']}地点"
            )
            lines.append(names)
        lines.append("")
output_path.write_text("\n".join(lines), encoding="utf-8")
