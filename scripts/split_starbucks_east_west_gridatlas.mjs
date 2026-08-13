import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { strFromU8, unzipSync } from "../src/fflate.js";
import { buildGridAtlasArchive } from "../src/gridatlas-import.js";

const defaultSourcePath = "docs/data/starbucks-japan-2026/starbucks-japan-stores-2026.gridatlas";
const defaultOutputDirectory = "docs/data/starbucks-japan-2026";
const sourcePath = resolve(process.argv[2] || defaultSourcePath);
const outputDirectory = resolve(process.argv[3] || defaultOutputDirectory);

const eastPrefectures = new Set([
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "山梨県", "長野県", "富山県", "石川県", "福井県", "静岡県"
]);

const sourceBytes = await readFile(sourcePath);
const entries = unzipSync(sourceBytes);
const sourceDocument = JSON.parse(strFromU8(entries["document.json"]));
const eastPlaces = [];
const westPlaces = [];

for (const place of sourceDocument.places || []) {
  const prefecture = place.extensions?.["io.gridatlas.starbucks"]?.prefecture;
  if (!prefecture) throw new Error(`都道府県情報がありません: ${place.id}`);
  if (eastPrefectures.has(prefecture)) eastPlaces.push(place);
  else westPlaces.push(place);
}

function splitDocument(id, name, places, sideLabel) {
  return {
    type: "place-list",
    schemaVersion: 1,
    id,
    name,
    description: `${sourceDocument.name}を都道府県単位で東西に分割した地点リスト。${sideLabel}の店舗を収録しています。店舗情報は${sourceDocument.updatedAt?.slice(0, 10) || "取得日不明"}時点のスナップショットです。`,
    attribution: sourceDocument.attribution,
    createdAt: sourceDocument.createdAt,
    updatedAt: sourceDocument.updatedAt,
    places
  };
}

const outputs = [
  {
    suffix: "east",
    document: splitDocument(
      "starbucks-japan-stores-2026-east",
      "スターバックス 東日本店舗一覧（2026-08-13取得）",
      eastPlaces,
      "東日本（北海道・東北・関東・甲信越・北陸・静岡）"
    )
  },
  {
    suffix: "west",
    document: splitDocument(
      "starbucks-japan-stores-2026-west",
      "スターバックス 西日本店舗一覧（2026-08-13取得）",
      westPlaces,
      "西日本（愛知・岐阜・三重・近畿・中国・四国・九州・沖縄）"
    )
  }
];

if (eastPlaces.length + westPlaces.length !== sourceDocument.places.length) {
  throw new Error("東西分割後の地点数が全国版と一致しません");
}

await mkdir(outputDirectory, { recursive: true });
for (const { suffix, document } of outputs) {
  const outputPath = resolve(outputDirectory, `starbucks-japan-stores-2026-${suffix}.gridatlas`);
  const archive = await buildGridAtlasArchive(document, [], { exportedAt: document.updatedAt });
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, archive.bytes);
  console.log(`${suffix}: ${document.places.length}店舗 / ${archive.bytes.byteLength} bytes / ${outputPath}`);
}

console.log(`全国版: ${sourceDocument.places.length}店舗`);
console.log(`東西合計: ${eastPlaces.length + westPlaces.length}店舗`);
