"""Build the 500-point shrine/temple candidate set used by GRID ATLAS.

The source exports are the official Agency for Cultural Affairs records already
stored under docs/data/candidate-sites-200-v2/raw.  The five pentagram anchors
remain explicit, while the other 495 points are selected from shrine and temple
architecture records.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import math
import re
from collections import Counter, defaultdict
from pathlib import Path


OFFICIAL_URL = "https://kunishitei.bunka.go.jp/bsys/index"
ANCHOR_SOURCE = "provided:近畿五芒星の5地点"
TARGET_TOTAL = 500
TARGET_BACKGROUND = 495
MIN_DISTANCE_KM = 2.0


def normalize_text(value: str) -> str:
    return re.sub(r"[\s　・･（）()「」『』、,./／]", "", value or "").lower()


def region_for(prefecture: str) -> str:
    groups = {
        "北海道": ["北海道"],
        "東北": ["青森", "岩手", "宮城", "秋田", "山形", "福島"],
        "関東": ["茨城", "栃木", "群馬", "埼玉", "千葉", "東京", "神奈川"],
        "北陸甲信": ["新潟", "富山", "石川", "福井", "山梨", "長野", "岐阜"],
        "東海": ["静岡", "愛知", "三重"],
        "近畿": ["滋賀", "京都", "大阪", "兵庫", "奈良", "和歌山"],
        "中国": ["鳥取", "島根", "岡山", "広島", "山口"],
        "四国": ["徳島", "香川", "愛媛", "高知"],
        "九州": ["福岡", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島"],
        "沖縄": ["沖縄"],
    }
    for region, prefixes in groups.items():
        if any(prefix in prefecture for prefix in prefixes):
            return region
    return "不明"


def sha_rank(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def distance_km(a: dict, b: dict) -> float:
    radius = math.pi / 180
    phi1 = a["latitude"] * radius
    phi2 = b["latitude"] * radius
    dphi = (b["latitude"] - a["latitude"]) * radius
    dlambda = (b["longitude"] - a["longitude"]) * radius
    hav = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    return 6371.0088 * 2 * math.atan2(math.sqrt(hav), math.sqrt(1 - hav))


def read_official_rows(source_dir: Path) -> list[dict]:
    rows: list[dict] = []
    for filename, category, source_label in (
        ("102-shrine.csv", "神社建築", "shrine"),
        ("102-temple.csv", "寺院建築", "temple"),
    ):
        path = source_dir / filename
        if not path.exists():
            raise FileNotFoundError(f"公式データがありません: {path}")
        with path.open(encoding="utf-8-sig", newline="") as handle:
            for raw in csv.DictReader(handle):
                if not raw.get("緯度", "").strip() or not raw.get("経度", "").strip():
                    continue
                raw["_category"] = category
                raw["_source_label"] = source_label
                rows.append(raw)
    return rows


def make_candidates(raw_rows: list[dict]) -> list[dict]:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in raw_rows:
        key = f"{normalize_text(row.get('名称', ''))}|{row.get('都道府県', '')}"
        grouped[key].append(row)

    candidates: list[dict] = []
    for rows in grouped.values():
        preferred = sorted(
            rows,
            key=lambda row: (
                0
                if re.search(r"本殿|本堂|正殿|拝殿|天守|門", row.get("棟名", ""))
                else 1,
                row.get("名称", ""),
                row.get("棟名", ""),
            ),
        )[0]
        name = preferred.get("名称", "").strip()
        prefecture = preferred.get("都道府県", "").strip()
        if not name or not prefecture:
            continue
        latitude = float(preferred["緯度"])
        longitude = float(preferred["経度"])
        source_id = (
            f"{preferred['_source_label']}-{preferred.get('台帳ID', '')}-"
            f"{preferred.get('管理対象ID', '')}"
        )
        candidate = {
            "name": name,
            "category": preferred["_category"],
            "designation": preferred.get("種別1", ""),
            "prefecture": prefecture,
            "region": region_for(prefecture),
            "latitude": latitude,
            "longitude": longitude,
            "source_type": "文化庁・国指定文化財等DB",
            "source_url": OFFICIAL_URL,
            "source_record_id": source_id,
            "coordinate_source": "文化庁DBの緯度・経度欄",
            "selection_role": "official-background",
        }
        candidate["rank"] = sha_rank(
            f"{candidate['category']}|{source_id}|{latitude:.12f}|{longitude:.12f}"
        )
        candidates.append(candidate)
    return candidates


def anchors() -> list[dict]:
    values = (
        ("伊勢神宮 内宮", "三重県", 34.4550, 136.7252, "anchor-001"),
        ("熊野本宮大社", "和歌山県", 33.8406, 135.7734, "anchor-002"),
        ("伊弉諾神宮", "兵庫県", 34.4601, 134.8525, "anchor-003"),
        ("元伊勢皇大神社", "京都府", 35.4304, 135.1543, "anchor-004"),
        ("伊吹山", "滋賀県", 35.4178, 136.4064, "anchor-005"),
    )
    return [
        {
            "name": name,
            "category": "近畿五芒星・固定アンカー",
            "designation": "記事の検証対象",
            "prefecture": prefecture,
            "region": region_for(prefecture),
            "latitude": latitude,
            "longitude": longitude,
            "source_type": "記事の固定アンカー",
            "source_url": ANCHOR_SOURCE,
            "source_record_id": source_id,
            "coordinate_source": "記事で先に固定した座標",
            "selection_role": "target-anchor",
        }
        for name, prefecture, latitude, longitude, source_id in values
    ]


def largest_remainder_targets(candidates: list[dict], total: int) -> dict[str, int]:
    """Make region targets proportional to the eligible official pool."""
    counts = Counter(row["region"] for row in candidates)
    regions = sorted(counts)
    total_candidates = sum(counts.values())
    if total_candidates == 0:
        raise ValueError("候補地点がありません")
    raw = {region: total * counts[region] / total_candidates for region in regions}
    targets = {region: int(math.floor(raw[region])) for region in regions}
    remaining = total - sum(targets.values())
    for region in sorted(regions, key=lambda item: (-(raw[item] - targets[item]), item))[:remaining]:
        targets[region] += 1
    return targets


def select_background(candidates: list[dict], fixed: list[dict]) -> list[dict]:
    available = [
        row
        for row in candidates
        if all(distance_km(row, anchor) >= MIN_DISTANCE_KM for anchor in fixed)
    ]
    if len(available) < TARGET_BACKGROUND:
        raise ValueError(f"2km除外後の候補が不足しています: {len(available)}")

    category_target = {"神社建築": 247, "寺院建築": 248}
    region_target = largest_remainder_targets(available, TARGET_BACKGROUND)
    category_used = Counter()
    region_used = Counter()
    selected: list[dict] = []
    blocked: set[str] = set()

    def eligible() -> list[dict]:
        return [
            row
            for row in available
            if row["source_record_id"] not in blocked
            and category_used[row["category"]] < category_target.get(row["category"], 0)
        ]

    def take(row: dict) -> None:
        selected.append(row)
        category_used[row["category"]] += 1
        region_used[row["region"]] += 1
        for candidate in available:
            if distance_km(row, candidate) < MIN_DISTANCE_KM:
                blocked.add(candidate["source_record_id"])

    # First fill the proportional regional targets.  Ranking by the remaining
    # regional deficit keeps the 500-point set spread across the official pool.
    while len(selected) < TARGET_BACKGROUND:
        options = eligible()
        if not options:
            break
        under_target = [
            row for row in options if region_used[row["region"]] < region_target.get(row["region"], 0)
        ]
        if under_target:
            options = under_target
        row = min(
            options,
            key=lambda item: (
                -(region_target.get(item["region"], 0) - region_used[item["region"]]),
                -(category_target[item["category"]] - category_used[item["category"]]),
                item["rank"],
            ),
        )
        take(row)

    if len(selected) < TARGET_BACKGROUND:
        raise ValueError(
            f"2km間隔を保ったまま背景地点を495件選べませんでした: {len(selected)}; "
            f"category={dict(category_used)} region={dict(region_used)}"
        )
    if dict(category_used) != category_target:
        raise ValueError(f"カテゴリ配分エラー: {dict(category_used)}")
    return selected


def ordered_row(row: dict, number: int) -> dict:
    return {
        "no": number,
        "name": row["name"],
        "category": row["category"],
        "designation": row["designation"],
        "prefecture": row["prefecture"],
        "region": row["region"],
        "latitude": f"{row['latitude']:.6f}",
        "longitude": f"{row['longitude']:.6f}",
        "source_type": row["source_type"],
        "source_url": row["source_url"],
        "source_record_id": row["source_record_id"],
        "coordinate_source": row["coordinate_source"],
        "selection_role": row["selection_role"],
        "selection_rule": (
            "shrine/temple official pool; proportional regional target; "
            "2km spacing; deterministic SHA-256 rank"
            if row["selection_role"] == "official-background"
            else "fixed before official background sampling"
        ),
    }


def write_method(path: Path, raw_count: int, dedup_count: int, available_count: int, rows: list[dict]) -> None:
    region_summary = Counter(row["region"] for row in rows)
    category_summary = Counter(row["category"] for row in rows)
    region_lines = "\n".join(
        f"| {region} | {region_summary[region]} |" for region in sorted(region_summary)
    )
    category_lines = "\n".join(
        f"| {category} | {category_summary[category]} |" for category in sorted(category_summary)
    )
    text = f"""# candidate-sites-500-shrines-temples-v4 選定メモ

取得元: [文化庁 国指定文化財等データベース]({OFFICIAL_URL})  
背景母集団: 102「近世以前／神社」および102「近世以前／寺院」の座標付きレコード {raw_count}件  
名称・都道府県で整理した候補: {dedup_count}件  
固定アンカーから2km以上の候補: {available_count}件  
最終構成: 固定アンカー5地点＋公式データ由来の神社・寺院495地点 = 500地点

## 方針

前版と同じく、背景候補は文化庁DBの神社建築・寺院建築に限定した。動植物、ホタル、地質、景観、城郭などは含めていない。伊吹山を含む近畿五芒星の5地点は、記事で先に固定した比較対象として別区分で残している。

## 選定ルール

- 神社建築247地点、寺院建築248地点を選んだ。これは2,793件の公式レコードを建物単位の重複整理後に作った候補から、両カテゴリをほぼ同数にする配分である。
- 地域配分は、固定アンカーを除いた公式候補の地域別件数に比例させ、最大剰余法で495枠に配分した。
- 同一名称・同一都道府県の建物別レコードは1地点に整理し、本殿・本堂などを優先した。
- 固定アンカーおよび採用済み地点から2km未満の候補は除外した。
- 採用順位はSHA-256で固定し、実行時刻や通常の乱数に依存しない。

## 注意

この500地点版は、日本のすべての神社・寺院を網羅した名所ランキングではない。文化庁の国指定文化財等DBで、位置情報を確認できる神社建築・寺院建築を再現可能な入口として使った比較用リストである。また、5つの固定アンカーだけは公式候補からの抽出ではなく、記事の検証対象として先に固定した地点である。

## 地域別集計

| 地域 | 件数 |
|---|---:|
{region_lines}

## カテゴリ別集計

| カテゴリ | 件数 |
|---|---:|
{category_lines}
"""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source-dir",
        type=Path,
        default=Path("C:/Users/jimas/Documents/GRID_ATLAS_WEB/docs/data/candidate-sites-200-v2/raw"),
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("C:/Users/jimas/Documents/GRID_ATLAS_WEB/docs/data/candidate-sites-500-v4"),
    )
    args = parser.parse_args()
    raw_rows = read_official_rows(args.source_dir)
    candidates = make_candidates(raw_rows)
    fixed = anchors()
    selected = select_background(candidates, fixed)
    all_rows = [ordered_row(row, index) for index, row in enumerate(fixed + selected, 1)]
    if len(all_rows) != TARGET_TOTAL:
        raise ValueError(f"最終件数エラー: {len(all_rows)}")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    csv_path = args.output_dir / "candidate-sites-500-shrines-temples-v4.csv"
    method_path = args.output_dir / "candidate-sites-500-shrines-temples-v4-method.md"
    with csv_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(all_rows[0]))
        writer.writeheader()
        writer.writerows(all_rows)
    available_count = sum(
        all(distance_km(row, anchor) >= MIN_DISTANCE_KM for anchor in fixed)
        for row in candidates
    )
    write_method(method_path, len(raw_rows), len(candidates), available_count, all_rows)
    print(f"CSV: {csv_path}")
    print(f"METHOD: {method_path}")
    print(f"raw={len(raw_rows)} dedup={len(candidates)} available={available_count}")
    print(f"total={len(all_rows)} category={dict(Counter(row['category'] for row in all_rows))}")
    print(f"region={dict(Counter(row['region'] for row in all_rows))}")


if __name__ == "__main__":
    main()
