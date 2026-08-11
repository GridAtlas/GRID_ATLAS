import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { buildGridAtlasArchive } from "../src/gridatlas-import.js";

const defaultSourcePath = ".tmp-yamanote/data/N02-25_GML/UTF-8/N02-25_Station.geojson";
const defaultOutputPath = "docs/data/yamanote-2025/yamanote-line-stations-2025.gridatlas";
const sourcePath = resolve(process.argv[2] || defaultSourcePath);
const outputPath = resolve(process.argv[3] || defaultOutputPath);

const stationPlan = [
  ["大崎", ["山手線"]],
  ["五反田", ["山手線"]],
  ["目黒", ["山手線"]],
  ["恵比寿", ["山手線"]],
  ["渋谷", ["山手線"]],
  ["原宿", ["山手線"]],
  ["代々木", ["山手線"]],
  ["新宿", ["山手線"]],
  ["新大久保", ["山手線"]],
  ["高田馬場", ["山手線"]],
  ["目白", ["山手線"]],
  ["池袋", ["山手線"]],
  ["大塚", ["山手線"]],
  ["巣鴨", ["山手線"]],
  ["駒込", ["山手線"]],
  ["田端", ["山手線"]],
  ["西日暮里", ["東北線"]],
  ["日暮里", ["東北線"]],
  ["鶯谷", ["東北線"]],
  ["上野", ["東北線"]],
  ["御徒町", ["東北線"]],
  ["秋葉原", ["東北線", "総武線"]],
  ["神田", ["東北線", "中央線"]],
  ["東京", ["東海道線"]],
  ["有楽町", ["東海道線"]],
  ["新橋", ["東海道線"]],
  ["浜松町", ["東海道線"]],
  ["田町", ["東海道線"]],
  ["高輪ゲートウェイ", ["東海道線"]],
  ["品川", ["山手線"]]
];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function dedupeFeatures(features) {
  const seen = new Set();
  return features.filter((feature) => {
    const key = JSON.stringify(feature.geometry?.coordinates ?? null);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function representativeCoordinate(features) {
  const lat0 = features[0].geometry.coordinates[0][1] * Math.PI / 180;
  const cosLat = Math.cos(lat0);
  let totalWeight = 0;
  let longitudeSum = 0;
  let latitudeSum = 0;

  for (const feature of features) {
    const coordinates = asArray(feature.geometry?.coordinates);
    for (let index = 1; index < coordinates.length; index += 1) {
      const [lonA, latA] = coordinates[index - 1];
      const [lonB, latB] = coordinates[index];
      const dx = (lonB - lonA) * cosLat;
      const dy = latB - latA;
      const weight = Math.hypot(dx, dy);
      if (!Number.isFinite(weight) || weight === 0) continue;
      totalWeight += weight;
      longitudeSum += ((lonA + lonB) / 2) * weight;
      latitudeSum += ((latA + latB) / 2) * weight;
    }
  }

  if (totalWeight === 0) throw new Error("駅形状から代表点を計算できません");
  return {
    latitude: Number((latitudeSum / totalWeight).toFixed(6)),
    longitude: Number((longitudeSum / totalWeight).toFixed(6))
  };
}

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const features = asArray(source.features);
const places = stationPlan.map(([name, allowedLines], index) => {
  const candidates = dedupeFeatures(features.filter((feature) => {
    const properties = feature.properties || {};
    return properties.N02_005 === name
      && properties.N02_004 === "東日本旅客鉄道"
      && allowedLines.includes(properties.N02_003)
      && feature.geometry?.type === "LineString";
  }));

  if (candidates.length === 0) {
    throw new Error(`駅形状が見つかりません: ${name} (${allowedLines.join(" / ")})`);
  }

  const firstProperties = candidates[0].properties;
  const position = representativeCoordinate(candidates);
  const selectedLines = [...new Set(candidates.map((feature) => feature.properties.N02_003))];
  return {
    id: `yamanote-2025-${String(index + 1).padStart(2, "0")}`,
    name,
    position,
    note: [
      "国土数値情報 鉄道 N02-25 Station",
      `駅コード ${firstProperties.N02_005c}`,
      `グループコード ${firstProperties.N02_005g}`,
      `採用線形状 ${selectedLines.join(" / ")}`,
      "線長加重の代表点を6桁小数へ丸めた座標"
    ].join(" / ")
  };
});

const document = {
  type: "place-list",
  schemaVersion: 1,
  id: "yamanote-line-stations-2025",
  name: "山手線 駅座標（国土数値情報 N02-25）",
  description: "JR東日本の山手線30駅。国土交通省の国土数値情報 鉄道2025年度版（N02-25）のStation線形状から、駅ごとの線長加重代表点を作成した地点リスト。山手線名義の形状がない駅は、同じ駅グループのJR東日本 東海道線・東北線・中央線形状を採用しています。",
  attribution: {
    name: "国土交通省 国土数値情報（鉄道）",
    url: "https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-2025.html",
    license: "CC BY 4.0"
  },
  createdAt: "2026-08-11T00:00:00.000Z",
  updatedAt: "2026-08-11T00:00:00.000Z",
  places
};

const archive = await buildGridAtlasArchive(document, [], {
  exportedAt: "2026-08-11T00:00:00.000Z"
});

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, archive.bytes);
console.log(`出力: ${outputPath}`);
console.log(`地点数: ${places.length}`);
console.log(`ファイルサイズ: ${archive.bytes.byteLength} bytes`);
for (const place of places) {
  console.log(`${place.name}\t${place.position.latitude},${place.position.longitude}`);
}
