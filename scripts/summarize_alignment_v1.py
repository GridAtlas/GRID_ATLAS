from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))
import analyze_alignment_v1 as analysis


csv_path = Path("C:/Users/jimas/Documents/GRID_ATLAS_WEB/docs/data/candidate-sites-200-v3/candidate-sites-200-shrines-temples-v3.csv")
output_path = Path("C:/Users/jimas/Documents/GRID_ATLAS_WEB/docs/data/candidate-sites-200-v3/alignment-anchor-summary.txt")
sites = analysis.load_sites(csv_path)
points, _ = analysis.project(sites)
lines = []
for tolerance in (5.0, 10.0, 15.0):
    candidates = analysis.find_candidates(sites, points, tolerance, 6, 300.0)
    candidates = [analysis.serialize_candidate(candidate) for candidate in candidates if candidate["anchor_count"] >= 2]
    candidates.sort(key=lambda item: (-item["count"], -item["span_km"], item["mean_error_km"]))
    lines.append(f"TOL={tolerance:g} / 候補数={len(candidates)}")
    for rank, candidate in enumerate(candidates[:10], 1):
        names = " → ".join(site["name"] for site in candidate["sites"])
        lines.append(
            f"{rank}. {candidate['count']}地点 / 全長{candidate['span_km']:.1f}km / "
            f"平均誤差{candidate['mean_error_km']:.1f}km / 最大空白{candidate['max_gap_km']:.1f}km / "
            f"固定アンカー{candidate['anchor_count']}地点"
        )
        lines.append(names)
    lines.append("")
output_path.write_text("\n".join(lines), encoding="utf-8")
