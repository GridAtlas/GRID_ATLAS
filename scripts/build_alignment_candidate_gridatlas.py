import csv
import hashlib
import json
import zipfile
from pathlib import Path


CSV_PATH = Path("C:/Users/jimas/Documents/GRID_ATLAS_WEB/docs/data/candidate-sites-200-v3/candidate-sites-200-shrines-temples-v3.csv")
OUTPUT_PATH = Path("C:/Users/jimas/Documents/GRID_ATLAS_WEB/docs/data/candidate-sites-200-v3/alignment-izanagi-ibuki-12.gridatlas")
NAMES = [
    "久津八幡宮本殿",
    "伊吹山",
    "長命寺護摩堂",
    "日吉大社東本宮本殿及び拝殿",
    "延暦寺転法輪堂",
    "園城寺唐院",
    "高台寺表門",
    "寶塔寺本堂",
    "教王護国寺北大門",
    "伊弉諾神宮",
    "土佐神社本殿、幣殿及び拝殿",
    "朝倉神社本殿",
]


with CSV_PATH.open(encoding="utf-8-sig", newline="") as handle:
    rows = {row["name"]: row for row in csv.DictReader(handle)}

if any(name not in rows for name in NAMES):
    missing = [name for name in NAMES if name not in rows]
    raise SystemExit(f"CSVに地点がありません: {missing}")

places = []
for index, name in enumerate(NAMES, 1):
    row = rows[name]
    places.append({
        "id": f"alignment-izanagi-ibuki-{index:02d}",
        "name": name,
        "position": {
            "latitude": float(row["latitude"]),
            "longitude": float(row["longitude"]),
        },
        "note": " / ".join(filter(None, [row["category"], row["designation"], row["prefecture"], row["selection_role"]])),
    })

document = {
    "type": "place-list",
    "schemaVersion": 1,
    "id": "alignment-izanagi-ibuki-12",
    "name": "直線候補 伊弉諾神宮—伊吹山 12地点",
    "description": "最新版200地点から探索した直線候補。測地線再確認で線から5km以内に残った12地点。",
    "attribution": {
        "name": "文化庁 国指定文化財等データベース／GRID ATLAS",
        "url": "https://kunishitei.bunka.go.jp/bsys/index",
    },
    "places": places,
}

document_bytes = (json.dumps(document, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
manifest = {
    "format": "gridatlas-package",
    "formatVersion": 1,
    "exportedAt": "2026-08-11T00:00:00.000Z",
    "document": {
        "path": "document.json",
        "mediaType": "application/vnd.gridatlas.place-list+json",
        "byteLength": len(document_bytes),
        "sha256": hashlib.sha256(document_bytes).hexdigest(),
    },
    "resources": [],
    "requiredExtensions": [],
    "extensions": {},
}
manifest_bytes = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(OUTPUT_PATH, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    archive.writestr("manifest.json", manifest_bytes)
    archive.writestr("document.json", document_bytes)
print(f"出力: {OUTPUT_PATH}")
print(f"地点数: {len(places)}")
